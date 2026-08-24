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
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { XIcon } from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import EmployeeEmailPicker from "../components/EmployeeEmailPicker";
import type { OrgChartEntity } from "../api/peopleOpsTypes";

// Place an existing entity under a parent in the hierarchy.
//
// It only ever ASSIGNS — creating a new team lives on the entity tabs. That
// separation is the backend's too: a mapping references an entity that must
// already exist, so offering "create one here" would be a second concept
// wearing the same button.

export interface AssignEntityDialogProps {
  open: boolean;
  onClose: () => void;
  /** e.g. "team" — what is being placed. */
  entityLabel: string;
  /** e.g. "AI BU" — what it is being placed under. */
  parentLabel: string;
  /** Assignable entities, already filtered by availableEntities(). */
  options: OrgChartEntity[];
  /** True while the entity list is still being fetched. */
  loadingOptions?: boolean;
  /** Must REJECT on failure so the dialog can stay open and explain. */
  onSubmit: (entityId: number, headEmail: string) => Promise<unknown>;
}

export default function AssignEntityDialog(props: AssignEntityDialogProps) {
  return props.open ? <AssignEntityDialogBody {...props} /> : null;
}

function AssignEntityDialogBody({
  open,
  onClose,
  entityLabel,
  parentLabel,
  options,
  loadingOptions = false,
  onSubmit,
}: AssignEntityDialogProps) {
  const [entity, setEntity] = useState<OrgChartEntity | null>(null);
  const [headEmail, setHeadEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!entity) return;

    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(entity.id, headEmail.trim());
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
            Add {entityLabel} to {parentLabel}
          </Typography>
          <IconButton size="small" onClick={onClose} disabled={submitting} aria-label="Close">
            <XIcon size={18} />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, pt: 0.5 }}>
            {error && <Alert severity="error">{error}</Alert>}

            {/* Three states, and the last two must not be confused: an
                empty list while loading means "not yet", an empty list after
                loading means every active entity is already placed here.
                Both are an empty array, so the flag is what tells them
                apart — and saying which beats an enabled-looking dropdown
                with nothing in it. */}
            {loadingOptions ? (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, py: 1 }}>
                <CircularProgress size={16} />
                <Typography variant="body2" color="text.secondary">
                  Loading {entityLabel}s…
                </Typography>
              </Box>
            ) : options.length === 0 ? (
              <Alert severity="info">
                Every active {entityLabel} is already under {parentLabel}. Create a
                new one on the {entityLabel}s tab first.
              </Alert>
            ) : (
              <Autocomplete<OrgChartEntity, false, false, false>
                options={options}
                value={entity}
                onChange={(_, selected) => setEntity(selected)}
                getOptionLabel={(option) => option.name}
                isOptionEqualToValue={(a, b) => a.id === b.id}
                autoHighlight
                size="small"
                renderInput={(params) => (
                  <TextField {...params} label={`${entityLabel} to add`} required autoFocus />
                )}
              />
            )}

            {!loadingOptions && options.length > 0 && (
              <EmployeeEmailPicker
                label="Functional head"
                value={headEmail}
                onChange={setHeadEmail}
                helperText={`Optional. The head for this ${entityLabel} under ${parentLabel} specifically — not the ${entityLabel}'s own head.`}
              />
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
            disabled={!entity || submitting}
            startIcon={submitting ? <CircularProgress size={14} color="inherit" /> : null}
          >
            Add
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
