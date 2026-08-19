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

import { useMemo, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { History, X } from "@wso2/oxygen-ui-icons-react";
import { labelOf, type EventsConfig, type Tab } from "../rules/schema";
import type { Change } from "../rules/model";

// Everything that differs from the workbook that was uploaded.
//
// Fixing a list is an hour of small decisions, most made in bulk — accepting a column of
// country suggestions is one click and forty edits. At the end of that nobody can say
// what they changed, and the only way to check was opening the original spreadsheet side
// by side.
//
// It's derived from a DIFF rather than accumulated as a log, which matters: undo, redo,
// and a value edited back to what it was all resolve correctly for free. A cell that says
// what it always said is not a change, whatever route it took.

export function ChangeListButton({
  changes,
  config,
  onJump,
  sx,
}: {
  changes: Change[];
  config: EventsConfig;
  /** Show me this row — switches tab if the change is on another one. */
  onJump: (tab: Tab, rowId: string, field: string) => void;
  sx?: object;
}) {
  const [open, setOpen] = useState(false);
  if (!changes.length) return null;

  return (
    <>
      <Tooltip arrow title="Everything you changed since the upload">
        <Button
          size="small"
          onClick={() => setOpen(true)}
          startIcon={<History size={15} />}
          sx={{
            textTransform: "none",
            fontSize: 11.5,
            fontWeight: 600,
            minWidth: 0,
            px: 1,
            color: "text.secondary",
            "&:hover": { color: "primary.main" },
            ...sx,
          }}
        >
          {changes.length} change{changes.length === 1 ? "" : "s"}
        </Button>
      </Tooltip>
      <ChangeListDialog
        open={open}
        onClose={() => setOpen(false)}
        changes={changes}
        config={config}
        onJump={onJump}
      />
    </>
  );
}

export function ChangeListDialog({
  open,
  onClose,
  changes,
  config,
  onJump,
}: {
  open: boolean;
  onClose: () => void;
  changes: Change[];
  config: EventsConfig;
  onJump?: (tab: Tab, rowId: string, field: string) => void;
}) {
  // Grouped by tab and column, because that's the shape the work was done in: one
  // accept-all on Country is forty entries that are all the same decision.
  const groups = useMemo(() => {
    const map = new Map<string, { tab: Tab; field: string; label: string; items: Change[] }>();
    for (const c of changes) {
      const key = `${c.tab}|${c.field}`;
      if (!map.has(key)) {
        map.set(key, { tab: c.tab, field: c.field, label: labelOf(config, c.tab, c.field), items: [] });
      }
      map.get(key)!.items.push(c);
    }
    return [...map.values()];
  }, [changes, config]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle
        sx={{ display: "flex", alignItems: "center", gap: 1, fontSize: 16, fontWeight: 800, pb: 1 }}
      >
        What changed
        <Typography
          component="span"
          sx={{
            fontSize: 13,
            fontWeight: 600,
            color: "text.secondary",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {changes.length} cell{changes.length === 1 ? "" : "s"} across {groups.length} column
          {groups.length === 1 ? "" : "s"}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <IconButton size="small" onClick={onClose} aria-label="Close">
          <X size={17} />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pb: 3 }}>
        <Typography sx={{ fontSize: 13, color: "text.secondary", mb: 2 }}>
          Compared with the workbook as it was uploaded. Values filled in automatically aren't
          listed — nobody chose those.
        </Typography>

        {groups.map((g) => (
          <Box key={`${g.tab}|${g.field}`} sx={{ mb: 2.5 }}>
            <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mb: 0.75 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{g.label}</Typography>
              <Typography sx={{ fontSize: 11.5, color: "text.disabled" }}>
                {g.tab} · {g.items.length}
              </Typography>
            </Box>
            <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, overflow: "hidden" }}>
              {g.items.map((c, i) => (
                <Box
                  key={`${c.rowId}-${c.field}`}
                  component={onJump ? "button" : "div"}
                  type={onJump ? "button" : undefined}
                  onClick={() => onJump?.(c.tab, c.rowId, c.field)}
                  sx={{
                    display: "flex",
                    width: "100%",
                    textAlign: "left",
                    alignItems: "center",
                    gap: 1,
                    px: 1.25,
                    py: 0.6,
                    border: 0,
                    borderTop: i === 0 ? 0 : 1,
                    borderColor: "divider",
                    bgcolor: "transparent",
                    fontFamily: "inherit",
                    cursor: onJump ? "pointer" : "default",
                    "&:hover": onJump ? { bgcolor: "action.hover" } : undefined,
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: 12.5,
                      width: 190,
                      flexShrink: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      color: "text.secondary",
                    }}
                  >
                    {c.who}
                  </Typography>
                  {/* Struck-through original, then the new value. The old one stays visible
                      because "what did it say before?" IS the question — a list of new
                      values alone answers nothing. */}
                  <Typography
                    sx={{
                      fontSize: 12.5,
                      flex: 1,
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      color: "text.disabled",
                      textDecoration: "line-through",
                    }}
                  >
                    {c.from || "(empty)"}
                  </Typography>
                  <Typography sx={{ fontSize: 11.5, color: "text.disabled", flexShrink: 0 }}>→</Typography>
                  <Typography
                    sx={{
                      fontSize: 12.5,
                      flex: 1,
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      fontWeight: 600,
                      // Green for a value, red for a clearing — the diff convention.
                      color: c.to ? "success.main" : "error.main",
                    }}
                  >
                    {c.to || "(cleared)"}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        ))}
      </DialogContent>
    </Dialog>
  );
}
