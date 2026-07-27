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
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@wso2/oxygen-ui";
import { HttpError } from "@api/http";
import { useNotifications } from "@context/notifications/NotificationsContext";
import type { Vehicle } from "../api/types";
import { useDeleteVehicle } from "../api/useVehicles";

// Confirmation dialog for soft-deleting a vehicle. Backend endpoint is
// DELETE /employees/{email}/vehicles/{vehicleId}. On success the vehicles
// list query is invalidated by the mutation's onSuccess and the row
// disappears from the card.
export default function DeleteVehicleDialog({
  vehicle,
  ownerEmail,
  onClose,
}: {
  vehicle: Vehicle | null;
  ownerEmail?: string;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const mutation = useDeleteVehicle(ownerEmail);
  const { showSuccess, showError } = useNotifications();

  useEffect(() => {
    if (vehicle) {
      setError(null);
      mutation.reset();
    }
    // Reset only when a fresh target is picked.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicle]);

  const handleConfirm = () => {
    if (!vehicle) return;
    setError(null);
    const plate = vehicle.vehicleRegistrationNumber;
    mutation.mutate(vehicle.vehicleId, {
      onSuccess: () => {
        onClose();
        showSuccess(`Vehicle ${plate} removed`);
      },
      onError: (err) => {
        const msg = readBackendError(err);
        setError(msg);
        showError(msg);
      },
    });
  };

  return (
    <Dialog
      open={!!vehicle}
      onClose={mutation.isPending ? undefined : onClose}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle sx={{ fontSize: 17, fontWeight: 700 }}>Delete vehicle?</DialogTitle>
      <DialogContent dividers>
        <Typography sx={{ fontSize: 13.5, mb: 1 }}>
          This will remove{" "}
          <b>{vehicle?.vehicleRegistrationNumber ?? ""}</b> from your registered
          vehicles. You can add it again later if needed.
        </Typography>
        {error && (
          <Alert severity="error" sx={{ fontSize: 12.5, mt: 1 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button size="small" onClick={onClose} disabled={mutation.isPending}>
          Cancel
        </Button>
        <Button
          size="small"
          color="error"
          variant="contained"
          onClick={handleConfirm}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? "Deleting…" : "Delete"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// Reads the friendliest message we can from a mutation error — parses
// the backend's { message: "..." } body when present, falls back to the
// raw text or the JS error message.
function readBackendError(err: Error): string {
  if (err instanceof HttpError && err.responseBody) {
    try {
      const parsed = JSON.parse(err.responseBody) as { message?: string };
      return parsed.message ?? err.responseBody;
    } catch {
      return err.responseBody;
    }
  }
  return err.message ?? "Failed to delete vehicle";
}
