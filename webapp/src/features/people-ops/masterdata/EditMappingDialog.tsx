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

import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Switch,
  Typography,
} from "@wso2/oxygen-ui";
import { XIcon } from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import EmployeeEmailPicker from "../components/EmployeeEmailPicker";
import type { OrgChartNode, UpdateMappingPayload } from "../api/peopleOpsTypes";

// Edit one PLACEMENT: its functional head, and whether it is active in this
// branch.
//
// Everything here is scoped to the mapping, never the entity. Renaming a team
// or retiring it everywhere belongs on the entity tabs; this dialog answers
// "who runs this team inside THIS business unit, and does it still belong
// here?" — which can differ per branch, and is the whole reason mappings
// carry their own head.

export interface EditMappingDialogProps {
  open: boolean;
  onClose: () => void;
  /** e.g. "team". */
  entityLabel: string;
  node: OrgChartNode | null;
  parentLabel: string;
  /** Must REJECT on failure so the dialog can stay open and explain. */
  onSubmit: (mappingId: number, payload: UpdateMappingPayload) => Promise<unknown>;
}

export default function EditMappingDialog(props: EditMappingDialogProps) {
  return props.open && props.node ? <EditMappingDialogBody {...props} /> : null;
}

function EditMappingDialogBody({
  open,
  onClose,
  entityLabel,
  node,
  parentLabel,
  onSubmit,
}: EditMappingDialogProps) {
  // The wrapper guarantees this, but the body is typed independently.
  const current = node!;

  const [headEmail, setHeadEmail] = useState(current.mappingHeadEmail ?? "");
  const [isActive, setIsActive] = useState(current.mappingIsActive);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only what changed, for the same reasons as the entity dialog: a head
  // change should not also re-assert the active flag.
  const payload: UpdateMappingPayload = {};
  const trimmedHead = headEmail.trim();
  if (trimmedHead !== (current.mappingHeadEmail ?? "")) payload.headEmail = trimmedHead;
  if (isActive !== current.mappingIsActive) payload.isActive = isActive;
  const dirty = Object.keys(payload).length > 0;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!dirty) return;

    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(current.mappingId, payload);
      onClose();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={submitting ? undefined : onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle
          sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1 }}
        >
          <Typography component="span" variant="h6">
            {current.name} in {parentLabel}
          </Typography>
          <IconButton size="small" onClick={onClose} disabled={submitting} aria-label="Close">
            <XIcon size={18} />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, pt: 0.5 }}>
            {error && <Alert severity="error">{error}</Alert>}

            {/* An entity deactivated on its own tab is dead in every branch,
                so say so rather than letting someone toggle a placement that
                cannot come back to life from here. */}
            {!current.isActive && (
              <Alert severity="warning">
                This {entityLabel} is deactivated everywhere. Reactivate it on the{" "}
                {entityLabel}s tab to use it here.
              </Alert>
            )}

            <EmployeeEmailPicker
              label="Functional head"
              value={headEmail}
              onChange={setHeadEmail}
              helperText={`The head for ${current.name} under ${parentLabel} specifically. The ${entityLabel}'s own head is set on the ${entityLabel}s tab.`}
            />

            <Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={isActive}
                    disabled={!current.isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                  />
                }
                label={
                  <Typography variant="body2">
                    {isActive ? "Active here" : "Not active here"}
                  </Typography>
                }
              />
              <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                {/* The distinction people most need spelled out: this removes
                    it from one branch, not from the company. */}
                Turning this off removes {current.name} from {parentLabel} only. It
                stays available anywhere else it's used.
              </Typography>
            </Box>
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button variant="text" color="inherit" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={!dirty || submitting}
            startIcon={submitting ? <CircularProgress size={14} color="inherit" /> : null}
          >
            Save
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
