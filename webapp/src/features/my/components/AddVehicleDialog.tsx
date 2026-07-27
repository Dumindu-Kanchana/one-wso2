// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { HttpError } from "@api/http";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { useAddVehicle } from "../api/useVehicles";
import type { VehicleType } from "../api/types";
import { formatPlate, validatePlate } from "../util/numberplate";

// Small form dialog for adding a vehicle. Fields match the backend's
// POST /employees/{email}/vehicles contract: {vehicleRegistrationNumber,
// vehicleType}. The backend enforces plate-format validation (Sri Lankan
// plates only) so we relay any 4xx error message verbatim rather than
// second-guessing the format here.
export default function AddVehicleDialog({
  open,
  ownerEmail,
  onClose,
}: {
  open: boolean;
  ownerEmail?: string;
  onClose: () => void;
}) {
  const [regNumber, setRegNumber] = useState("");
  const [vehicleType, setVehicleType] = useState<VehicleType>("CAR");
  const [error, setError] = useState<string | null>(null);
  const mutation = useAddVehicle(ownerEmail);
  const { showSuccess, showError } = useNotifications();

  useEffect(() => {
    if (open) {
      setRegNumber("");
      setVehicleType("CAR");
      setError(null);
      mutation.reset();
    }
    // We only want to reset when the dialog opens; ignore mutation identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Only run the strict validator once the input has some length AND
  // isn't still visibly "in progress" — otherwise the field flashes an
  // error on every keystroke. Untouched-so-far is treated as UNCERTAIN.
  const plateValidity = regNumber.trim() ? validatePlate(regNumber) : "UNCERTAIN";
  const plateError =
    plateValidity === "INVALID"
      ? "Not a recognised Sri Lankan plate format (e.g. CAA 1111, 12 3456, 1 SRI 1234)."
      : undefined;
  const canSubmit =
    !!ownerEmail &&
    regNumber.trim().length > 0 &&
    plateValidity === "VALID" &&
    !mutation.isPending;

  const handleSubmit = () => {
    if (!canSubmit) return;
    setError(null);
    // Normalize to the exact backend shape (space separator, uppercase).
    // "CAA-1111" → "CAA 1111". Matches the microapp's helper so both
    // frontends hit the backend with the same canonical form.
    const plate = formatPlate(regNumber);
    mutation.mutate(
      {
        vehicleRegistrationNumber: plate,
        vehicleType,
      },
      {
        onSuccess: () => {
          onClose();
          showSuccess(`Vehicle ${plate} added`);
        },
        onError: (err) => {
          const msg = readBackendError(err);
          setError(msg);
          showError(msg);
        },
      },
    );
  };

  return (
    <Dialog open={open} onClose={mutation.isPending ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontSize: 17, fontWeight: 700 }}>Add vehicle</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Box>
            <Typography sx={{ fontSize: 12, fontWeight: 600, color: "text.secondary", mb: 0.75 }}>
              Registration number
            </Typography>
            <TextField
              size="small"
              fullWidth
              autoFocus
              value={regNumber}
              onChange={(e) => setRegNumber(e.target.value)}
              placeholder="e.g. CAA 1111"
              disabled={mutation.isPending}
              error={Boolean(plateError)}
              helperText={
                plateError ??
                "Sri Lankan format — spaces or dashes accepted, we normalise on submit."
              }
              inputProps={{ "aria-label": "Vehicle registration number" }}
            />
          </Box>
          <Box>
            <Typography sx={{ fontSize: 12, fontWeight: 600, color: "text.secondary", mb: 0.75 }}>
              Vehicle type
            </Typography>
            <FormControl fullWidth size="small" disabled={mutation.isPending}>
              <Select
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value as VehicleType)}
                aria-label="Vehicle type"
              >
                <MenuItem value="CAR">Car</MenuItem>
                <MenuItem value="MOTORCYCLE">Motorcycle</MenuItem>
              </Select>
            </FormControl>
          </Box>
          {error && (
            <Alert severity="error" sx={{ fontSize: 12.5 }}>
              {error}
            </Alert>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button size="small" onClick={onClose} disabled={mutation.isPending}>
          Cancel
        </Button>
        <Button
          size="small"
          variant="contained"
          onClick={handleSubmit}
          disabled={!canSubmit}
        >
          {mutation.isPending ? "Adding…" : "Add vehicle"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// Read the friendliest message we can out of a mutation error. When the
// backend rejects with the generic "Payload binding failed!" (which
// Ballerina raises before the friendly @constraint message is available),
// we translate it into something actionable.
function readBackendError(err: Error): string {
  const raw = (() => {
    if (err instanceof HttpError && err.responseBody) {
      try {
        const parsed = JSON.parse(err.responseBody) as { message?: string };
        return parsed.message ?? err.responseBody;
      } catch {
        return err.responseBody;
      }
    }
    return err.message ?? "Failed to add vehicle";
  })();
  if (/payload binding failed/i.test(raw)) {
    return "The registration number didn't match the expected format. Try e.g. CAA 1111, 12 3456, or 1 SRI 1234.";
  }
  return raw;
}
