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
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Typography,
} from "@wso2/oxygen-ui";
import {
  BriefcaseBusinessIcon,
  Building2Icon,
  CalendarDaysIcon,
  IdCardIcon,
  LogOutIcon,
  UsersRoundIcon,
  XIcon,
  type LucideIcon,
} from "@wso2/oxygen-ui-icons-react";
import type { ColumnDef } from "./reportColumns";

// Picks which columns the CSV export contains (and, in preview order, which
// the table shows). Edits a DRAFT and only commits on Apply, so a half-made
// selection never refires the report or reshuffles the table underneath the
// person making it.

const GROUP_ICONS: Record<string, LucideIcon> = {
  Identity: IdCardIcon,
  "Job & Career": BriefcaseBusinessIcon,
  Organisation: Building2Icon,
  "Dates & Service": CalendarDaysIcon,
  Management: UsersRoundIcon,
  Resignation: LogOutIcon,
};

export interface ColumnSelectorDialogProps {
  open: boolean;
  onClose: () => void;
  /** Full ordered column list for this report type. */
  columns: ColumnDef[];
  /** Currently applied selection. */
  selectedKeys: string[];
  /** Receives the new selection, in canonical order, on Apply. */
  onApply: (keys: string[]) => void;
}

// Mounts the body only while open, so the draft is seeded from `selectedKeys`
// by useState on mount and discarded on close. Same wrapper pattern as
// CcEditDialog — it replaces reseeding via an effect, which lints as a
// cascading render and would clobber an in-progress selection if the parent
// re-rendered while the dialog was open.
export default function ColumnSelectorDialog(props: ColumnSelectorDialogProps) {
  return props.open ? <ColumnSelectorDialogBody {...props} /> : null;
}

function ColumnSelectorDialogBody({
  open,
  onClose,
  columns,
  selectedKeys,
  onApply,
}: ColumnSelectorDialogProps) {
  // A Set, for O(1) lookups in the render loop below.
  const [draft, setDraft] = useState<Set<string>>(() => new Set(selectedKeys));

  // Insertion-ordered, so groups appear in the order reportColumns declares
  // them rather than alphabetically.
  const groups = useMemo(() => {
    const map = new Map<string, ColumnDef[]>();
    for (const col of columns) {
      const existing = map.get(col.group);
      if (existing) existing.push(col);
      else map.set(col.group, [col]);
    }
    return Array.from(map.entries());
  }, [columns]);

  const allSelected = draft.size === columns.length;
  const noneSelected = draft.size === 0;

  function toggle(key: string) {
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleGroup(keys: string[], checked: boolean) {
    setDraft((prev) => {
      const next = new Set(prev);
      for (const k of keys) {
        if (checked) next.add(k);
        else next.delete(k);
      }
      return next;
    });
  }

  function handleApply() {
    // Re-derive from `columns` rather than emitting the Set's own order, so
    // column order is always canonical no matter what order they were ticked.
    onApply(columns.map((c) => c.key).filter((k) => draft.has(k)));
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle
        sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1 }}
      >
        <Typography component="span" variant="h6">
          Select columns
        </Typography>
        <IconButton size="small" onClick={onClose} aria-label="Close">
          <XIcon size={18} />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <FormControlLabel
          sx={{ mb: 1.5 }}
          control={
            <Checkbox
              checked={allSelected}
              indeterminate={!noneSelected && !allSelected}
              onChange={(e) =>
                setDraft(e.target.checked ? new Set(columns.map((c) => c.key)) : new Set())
              }
            />
          }
          label={
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {allSelected ? "All columns selected" : `${draft.size} of ${columns.length} selected`}
            </Typography>
          }
        />

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            columnGap: 3,
            rowGap: 2.5,
            alignItems: "start",
          }}
        >
          {groups.map(([groupName, cols]) => {
            const groupKeys = cols.map((c) => c.key);
            const allInGroup = groupKeys.every((k) => draft.has(k));
            const someInGroup = groupKeys.some((k) => draft.has(k));
            const Icon = GROUP_ICONS[groupName] ?? IdCardIcon;

            return (
              <Box key={groupName}>
                {/* Group header: icon, name, a rule out to the group checkbox. */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                  <Box
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 26,
                      height: 26,
                      borderRadius: 1,
                      flexShrink: 0,
                      bgcolor: "action.hover",
                      color: "text.secondary",
                    }}
                  >
                    <Icon size={14} />
                  </Box>
                  <Typography variant="body2" sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                    {groupName}
                  </Typography>
                  <Box sx={{ flex: 1, height: "1px", bgcolor: "divider" }} />
                  <Checkbox
                    size="small"
                    checked={allInGroup}
                    indeterminate={someInGroup && !allInGroup}
                    onChange={(e) => toggleGroup(groupKeys, e.target.checked)}
                    inputProps={{ "aria-label": `Select all ${groupName} columns` }}
                  />
                </Box>

                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                    pl: 0.25,
                  }}
                >
                  {cols.map((col) => (
                    <FormControlLabel
                      key={col.key}
                      sx={{ ml: 0, mr: 0 }}
                      control={
                        <Checkbox
                          size="small"
                          checked={draft.has(col.key)}
                          onChange={() => toggle(col.key)}
                        />
                      }
                      label={<Typography variant="body2">{col.label}</Typography>}
                    />
                  ))}
                </Box>
              </Box>
            );
          })}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button variant="text" color="inherit" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="outlined" disabled={noneSelected} onClick={() => setDraft(new Set())}>
          Deselect all
        </Button>
        {/* A zero-column export would produce an empty file, so Apply is held
            until at least one column is ticked. */}
        <Button variant="contained" disabled={noneSelected} onClick={handleApply}>
          Apply
        </Button>
      </DialogActions>
    </Dialog>
  );
}
