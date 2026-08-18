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
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { Copy, Trash2 } from "@wso2/oxygen-ui-icons-react";
import type { FieldDef, MemberStatus } from "../eventsTypes";
import ColumnEditor from "./ColumnEditor";
import { fieldInput, fieldLabel, primaryBtn, quietBtn } from "./eventsStyles";

// One member status: what it is called, what a row on it is worth, and its columns.
//
// The name is the load-bearing field. It is not a label — it is the exact text a
// workbook tab has to carry to import as this status, so renaming it here is a change to
// what MOP will accept from every regional marketing manager. The editor says so, and
// the rename carries the status' columns with it server-side.

export default function StatusEditor({
  status,
  fields,
  onSaveStatus,
  onSaveFields,
  onDuplicate,
  onDelete,
  onError,
}: {
  status: MemberStatus;
  fields: FieldDef[];
  onSaveStatus: (patch: { name: string; score: number; enabled: boolean }) => Promise<void>;
  onSaveFields: (fields: FieldDef[]) => Promise<void>;
  onDuplicate: (name: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onError: (message: string | null) => void;
}) {
  // Seeded from props by a lazy initializer, not synced in an effect: the call site
  // keys this component on the status name, so a different status is a different
  // component instance and there is nothing to sync.
  const [name, setName] = useState(status.name);
  const [score, setScore] = useState(String(status.score));
  const [enabled, setEnabled] = useState(status.enabled);
  const [saving, setSaving] = useState(false);

  const [draft, setDraft] = useState<FieldDef[]>(() => structuredClone(fields));
  const [copyName, setCopyName] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const headerDirty =
    name !== status.name || score !== String(status.score) || enabled !== status.enabled;

  async function run(action: () => Promise<void>, setFlag: (v: boolean) => void) {
    setFlag(true);
    onError(null);
    try {
      await action();
    } catch (e) {
      onError(e instanceof Error ? e.message : "That didn't work.");
    } finally {
      setFlag(false);
    }
  }

  return (
    <Box>
      {/* --- what this status IS ------------------------------------------------- */}
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, flexWrap: "wrap", mb: 1 }}>
        <Box sx={{ flex: "1 1 260px", minWidth: 220 }}>
          <Typography sx={fieldLabel}>Tab name in the workbook</Typography>
          <TextField
            size="small"
            fullWidth
            value={name}
            sx={fieldInput}
            onChange={(e) => setName(e.target.value)}
          />
        </Box>
        <Box sx={{ width: 110 }}>
          <Typography sx={fieldLabel}>Score</Typography>
          <TextField
            size="small"
            fullWidth
            value={score}
            sx={fieldInput}
            onChange={(e) => setScore(e.target.value.replace(/[^0-9]/g, ""))}
          />
        </Box>
        <Box sx={{ pt: 2.2 }}>
          <Tooltip
            arrow
            title={
              enabled
                ? "Retire it: workbooks stop importing this tab, and old submissions stay readable"
                : "Bring it back into use"
            }
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <Switch
                size="small"
                checked={enabled}
                inputProps={{ "aria-label": "In use" }}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>
                {enabled ? "In use" : "Retired"}
              </Typography>
            </Box>
          </Tooltip>
        </Box>
      </Box>

      <Typography sx={{ fontSize: 12, color: "text.secondary", mb: 1.5, maxWidth: 720 }}>
        The name has to be exactly what the workbook tab is called — it is matched, not
        interpreted. Renaming it takes this status' {fields.length} columns with it, and changes
        what MOP will accept from everyone. The score is what one row is worth.
      </Typography>

      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}>
        <Button
          onClick={() =>
            void run(async () => {
              await onSaveStatus({
                name: name.trim(),
                score: Number.parseInt(score, 10) || 0,
                enabled,
              });
            }, setSaving)
          }
          variant="contained"
          size="small"
          sx={primaryBtn}
          disabled={!headerDirty || !name.trim() || saving}
        >
          {saving ? "Saving…" : "Save"}
        </Button>
        {headerDirty && (
          <Button
            size="small"
            sx={quietBtn}
            onClick={() => {
              setName(status.name);
              setScore(String(status.score));
              setEnabled(status.enabled);
            }}
          >
            Discard
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        <Tooltip arrow title="Create a new status with a copy of these columns">
          <Button
            size="small"
            sx={quietBtn}
            onClick={() => setCopyName(`${status.name} copy`)}
            startIcon={<Copy size={14} />}
          >
            Duplicate
          </Button>
        </Tooltip>
        <Button
          size="small"
          onClick={() => setConfirmDelete(true)}
          startIcon={<Trash2 size={15} />}
          sx={{ ...quietBtn, "&:hover": { color: "error.main" } }}
        >
          Delete
        </Button>
      </Box>

      {/* --- and what its columns are -------------------------------------------- */}
      <ColumnEditor
        fields={draft}
        baseline={fields}
        onChange={setDraft}
        onSave={async (next) => {
          await onSaveFields(next);
          setDraft(structuredClone(next));
        }}
        onDiscard={() => setDraft(structuredClone(fields))}
      />

      <Dialog
        // Keyed by whether it is open so the name field resets on each open.
        key={copyName === null ? "closed" : "open"}
        open={copyName !== null}
        onClose={() => !busy && setCopyName(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={TITLE}>Duplicate {status.name}</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13, color: "text.secondary", mb: 2 }}>
            Creates a new member status with a copy of all {fields.length} columns. Its name is what
            a workbook tab has to be called to import as this status, so it has to be the exact
            wording the template uses.
          </Typography>
          <Typography sx={fieldLabel}>Name of the new member status</Typography>
          <TextField
            size="small"
            fullWidth
            autoFocus
            sx={fieldInput}
            value={copyName ?? ""}
            onChange={(e) => setCopyName(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCopyName(null)} disabled={busy} sx={quietBtn}>
            Cancel
          </Button>
          <Button
            variant="contained"
            sx={primaryBtn}
            disabled={!copyName?.trim() || busy}
            onClick={() =>
              void run(async () => {
                const name = copyName?.trim();
                if (!name) return;
                await onDuplicate(name);
                setCopyName(null);
              }, setBusy)
            }
          >
            {busy ? "Copying…" : "Duplicate"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={confirmDelete}
        onClose={() => !busy && setConfirmDelete(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={TITLE}>Delete {status.name}?</DialogTitle>
        <DialogContent>
          <Typography component="div" sx={{ fontSize: 13, color: "text.secondary", lineHeight: 1.55 }}>
            The status and its <b>{fields.length}</b> columns go together — a workbook tab called “
            {status.name}” will no longer be imported at all.
            <Box sx={{ mt: 1.5 }}>
              Submissions that already used it keep their rows and stay readable. If you only want
              new workbooks to stop using it, <b>retire</b> it instead — that is the switch above,
              and it is reversible.
            </Box>
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmDelete(false)} disabled={busy} sx={quietBtn}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await onDelete();
                setConfirmDelete(false);
              }, setBusy)
            }
            sx={primaryBtn}
          >
            {busy ? "Deleting…" : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

const TITLE = { fontSize: 16, fontWeight: 800 };
