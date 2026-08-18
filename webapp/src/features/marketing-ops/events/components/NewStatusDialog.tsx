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
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { fieldHint, fieldInput, fieldLabel, primaryBtn, quietBtn } from "./eventsStyles";

// Adding a member status from nothing.
//
// It starts with NO columns, which is said out loud here rather than discovered later:
// until some are defined, every heading on that tab imports as free text under its own
// name. Duplicating an existing status is usually the better move, and the copy says so.

export default function NewStatusDialog({
  open,
  onCancel,
  onCreate,
}: {
  open: boolean;
  onCancel: () => void;
  onCreate: (name: string, score: number) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [score, setScore] = useState("0");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    // `busy` guards re-entry, not just the button's disabled state: Enter in the name
    // field calls this directly, and holding it down fired several creates before the
    // first response came back — the server refuses the duplicate name, so the second
    // reply overwrote the success with an error about a status that had just been
    // created successfully.
    if (busy || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await onCreate(name.trim(), Number.parseInt(score, 10) || 0);
    } catch (e) {
      // The server refuses a name already in use, and names the clash.
      setError(e instanceof Error ? e.message : "That status could not be created.");
    } finally {
      setBusy(false);
    }
  }

  return (
    // Keyed by `open` at the call site so the fields reset on each open, rather than
    // syncing props into state in an effect.
    <Dialog open={open} onClose={() => !busy && onCancel()} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontSize: 17, fontWeight: 800, letterSpacing: "-0.01em", pb: 0.5 }}>
        New member status
      </DialogTitle>
      <DialogContent>
        <Typography sx={{ fontSize: 13, color: "text.secondary", mb: 2.5 }}>
          The name has to be exactly what the workbook tab is called — it's matched, not
          interpreted. It starts with no columns, so every heading on that tab would import as free
          text until you define some; copying an existing status is usually quicker than starting
          from nothing.
        </Typography>
        <Box sx={{ mb: 2 }}>
          <Typography sx={fieldLabel}>Tab name in the workbook</Typography>
          <TextField
            size="small"
            fullWidth
            autoFocus
            sx={fieldInput}
            placeholder="e.g. Booth"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void create();
            }}
          />
        </Box>
        <Box sx={{ width: 140 }}>
          <Typography sx={fieldLabel}>Score</Typography>
          <TextField
            size="small"
            fullWidth
            sx={fieldInput}
            value={score}
            onChange={(e) => setScore(e.target.value.replace(/[^0-9]/g, ""))}
          />
          <Typography sx={fieldHint}>What one row is worth.</Typography>
        </Box>
        {error && <Typography sx={{ fontSize: 12.5, color: "error.main", mt: 1.5 }}>{error}</Typography>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCancel} disabled={busy} sx={quietBtn}>
          Cancel
        </Button>
        <Button
          onClick={() => void create()}
          variant="contained"
          disabled={!name.trim() || busy}
          sx={primaryBtn}
        >
          {busy ? "Creating…" : "Create"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
