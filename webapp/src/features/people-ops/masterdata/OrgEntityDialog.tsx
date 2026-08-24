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
  TextField,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { XIcon } from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import type {
  CreateOrgChartEntityPayload,
  OrgChartEntity,
  UpdateOrgChartEntityPayload,
} from "../api/peopleOpsTypes";
import {
  deactivationBlockedReason,
  hasErrors,
  initialFormState,
  isDirty,
  NAME_MAX_LENGTH,
  toCreatePayload,
  toUpdatePayload,
  validateOrgEntityForm,
  type OrgEntityFormState,
} from "./orgEntityForm";

// Create or edit one org-chart entity. The same dialog serves all four kinds
// and both modes; `entity` being null is what makes it a create.
//
// Validation, payload diffing and the deactivation rule live in
// orgEntityForm — this file is the presentation of them.

export interface OrgEntityDialogProps {
  open: boolean;
  onClose: () => void;
  /** Singular entity noun, e.g. "team". Used in the title. */
  label: string;
  headEmailLabel: string;
  /** The entity being edited, or null/undefined to create a new one. */
  entity?: OrgChartEntity | null;
  /**
   * Two callbacks rather than one taking a union: create and update hit
   * different endpoints with different payload shapes (name is required on
   * one, optional on the other), and a union would make every caller
   * re-narrow what this component already knows from `entity`.
   *
   * Both must REJECT on failure — the dialog stays open and shows the error.
   */
  onCreate: (payload: CreateOrgChartEntityPayload) => Promise<unknown>;
  onUpdate: (id: number, payload: UpdateOrgChartEntityPayload) => Promise<unknown>;
}

// Mounted only while open, so the form seeds from `entity` on mount and is
// discarded on close — the same wrapper pattern as the report dialogs.
export default function OrgEntityDialog(props: OrgEntityDialogProps) {
  return props.open ? <OrgEntityDialogBody {...props} /> : null;
}

function OrgEntityDialogBody({
  open,
  onClose,
  label,
  headEmailLabel,
  entity,
  onCreate,
  onUpdate,
}: OrgEntityDialogProps) {
  const isEdit = entity != null;
  const [form, setForm] = useState<OrgEntityFormState>(() => initialFormState(entity));
  // Errors are shown per field only after that field has been touched, so a
  // freshly opened create dialog isn't already complaining about a name
  // nobody has had a chance to type.
  const [touched, setTouched] = useState<{ name?: boolean; headEmail?: boolean }>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const errors = validateOrgEntityForm(form);
  const blockedReason = deactivationBlockedReason(entity);
  const canSave = !hasErrors(errors) && isDirty(form, entity) && !submitting;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setTouched({ name: true, headEmail: true });
    if (hasErrors(errors) || !isDirty(form, entity)) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      if (isEdit) {
        await onUpdate(entity.id, toUpdatePayload(form, entity));
      } else {
        await onCreate(toCreatePayload(form));
      }
      onClose();
    } catch (err) {
      // Stay open on failure: the backend's refusals here are actionable
      // (a duplicate name, or employees still assigned), and closing would
      // discard the edit along with the explanation.
      setSubmitError(describeError(err));
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
            {isEdit ? `Edit ${label}` : `Add ${label}`}
          </Typography>
          <IconButton size="small" onClick={onClose} disabled={submitting} aria-label="Close">
            <XIcon size={18} />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, pt: 0.5 }}>
            {submitError && <Alert severity="error">{submitError}</Alert>}

            <TextField
              label="Name"
              required
              autoFocus
              size="small"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              onBlur={() => setTouched((t) => ({ ...t, name: true }))}
              error={Boolean(touched.name && errors.name)}
              helperText={
                (touched.name && errors.name) ||
                `${form.name.trim().length}/${NAME_MAX_LENGTH}`
              }
              slotProps={{ htmlInput: { maxLength: NAME_MAX_LENGTH } }}
            />

            <TextField
              label={headEmailLabel}
              size="small"
              type="email"
              value={form.headEmail}
              onChange={(e) => setForm((f) => ({ ...f, headEmail: e.target.value }))}
              onBlur={() => setTouched((t) => ({ ...t, headEmail: true }))}
              error={Boolean(touched.headEmail && errors.headEmail)}
              helperText={
                (touched.headEmail && errors.headEmail) ||
                "Optional. Leave blank if there's no head yet."
              }
            />

            {/* Only when editing — a new entity is always created active. */}
            {isEdit && (
              <Box>
                <Tooltip title={blockedReason ?? ""} arrow placement="top">
                  {/* A span, because a disabled control emits no pointer
                      events and the tooltip would never appear. */}
                  <Box component="span" sx={{ display: "inline-block" }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={form.isActive}
                          disabled={Boolean(blockedReason) && form.isActive}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, isActive: e.target.checked }))
                          }
                        />
                      }
                      label={
                        <Typography variant="body2">
                          {form.isActive ? "Active" : "Inactive"}
                        </Typography>
                      }
                    />
                  </Box>
                </Tooltip>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                  {blockedReason ??
                    "Inactive entities stay on record but stop appearing in filters and assignment lists."}
                </Typography>
              </Box>
            )}
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button variant="text" color="inherit" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={!canSave}
            startIcon={submitting ? <CircularProgress size={14} color="inherit" /> : null}
          >
            {isEdit ? "Save" : "Create"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
