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
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { labelOf, type EventsConfig, type Field, type Tab } from "../rules/schema";
import type { GridRow } from "../rules/model";
import { primaryBtn, quietBtn } from "./eventsStyles";

// Set one column to one value, across many rows at once.
//
// The shape of a real list isn't a scatter of unrelated mistakes — it's one value
// repeated down a whole column: an event with a single account manager whose name was
// typed instead of their address, or an opt-in column the organiser left blank. One real
// sheet had 55 rows with the same AM name and 54 blank opt-ins: 109 cells holding two
// values between them.
//
// Deliberately a DIALOG rather than an in-grid gesture. Excel-style fill-down needs a
// drag handle, a selection model and an anchor cell, all inside the cell renderer — which
// is exactly the machinery that made the previous grid unfixable. Here the grid only
// gained a checkbox in its gutter; nothing about editing a cell changed.

/** Above this a menu is unusable and type-ahead is better. Matches the grid. */
const LIST_AS_SELECT = 80;

export type FillScope = "flagged" | "selected" | "all";

export interface FillTarget {
  field: Field;
  /** Where the dialog was opened from, so the scope starts on the useful answer. */
  scope: FillScope;
}

export default function FillDialog({
  target,
  rows,
  tab,
  columns,
  selected,
  config,
  optionsFor,
  onClose,
  onApply,
}: {
  target: FillTarget | null;
  rows: GridRow[];
  tab: Tab;
  columns: string[];
  selected: Set<string>;
  config: EventsConfig;
  /** Allowed values for a field, given a representative row. */
  optionsFor?: (field: string, row: GridRow) => string[] | undefined;
  onClose: () => void;
  onApply: (field: Field, value: string, rowIds: string[]) => void;
}) {
  // Seeded from `target`, and the call site keys this component on the target — so
  // reopening for a different column can't inherit the last one's answer, without an
  // effect that mirrors props into state.
  const [field, setField] = useState<Field | "">(target?.field ?? "");
  const [scope, setScope] = useState<FillScope>(target?.scope ?? "flagged");
  const [value, setValue] = useState("");

  const flagged = useMemo(
    () => (field ? rows.filter((r) => r.issues.some((i) => i.field === field)) : []),
    [rows, field],
  );
  const chosen = useMemo(() => {
    if (scope === "selected") return rows.filter((r) => selected.has(r.id));
    if (scope === "all") return rows;
    return flagged;
  }, [scope, rows, selected, flagged]);

  /** A representative row, so `state` can offer the right country's list. */
  const sample = chosen[0] ?? rows[0];
  const options = field && sample ? optionsFor?.(field, sample) : undefined;

  // For `state` the allowed set follows each row's COUNTRY, so a single fill only makes
  // sense when every affected row shares one. Say so rather than offering a list that's
  // wrong for half of them.
  const mixedCountries =
    field === "state" && new Set(chosen.map((r) => (r.data.country ?? "").trim())).size > 1;

  if (!target) return null;

  const targets = chosen.map((r) => r.id);
  const changing = field ? chosen.filter((r) => (r.data[field] ?? "") !== value).length : 0;

  const scopes: { key: FillScope; label: string; n: number; disabled?: boolean }[] = [
    { key: "flagged", label: "Rows that need attention", n: flagged.length, disabled: !flagged.length },
    { key: "selected", label: "Selected rows", n: selected.size, disabled: !selected.size },
    { key: "all", label: "Every row on this tab", n: rows.length },
  ];

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontSize: 16, fontWeight: 800 }}>Fill a column</DialogTitle>
      <DialogContent>
        <Typography sx={{ fontSize: 13, color: "text.secondary", mb: 2 }}>
          Set one column to the same value on many rows of {tab} at once.
        </Typography>

        <Typography sx={LABEL_SX}>Column</Typography>
        <Select
          fullWidth
          size="small"
          value={field}
          onChange={(e) => {
            setField(e.target.value as Field);
            setValue("");
          }}
          sx={{ mb: 2, fontSize: 13 }}
        >
          {columns.map((c) => (
            <MenuItem key={c} value={c} sx={{ fontSize: 13 }}>
              {labelOf(config, tab, c)}
            </MenuItem>
          ))}
        </Select>

        <Typography sx={LABEL_SX}>Apply to</Typography>
        <Select
          fullWidth
          size="small"
          value={scope}
          onChange={(e) => setScope(e.target.value as FillScope)}
          sx={{ mb: 2, fontSize: 13 }}
        >
          {scopes.map((s) => (
            <MenuItem key={s.key} value={s.key} disabled={s.disabled} sx={{ fontSize: 13 }}>
              {s.label}
              <Box
                component="span"
                sx={{ ml: 1, color: "text.disabled", fontVariantNumeric: "tabular-nums" }}
              >
                {s.n}
              </Box>
            </MenuItem>
          ))}
        </Select>

        <Typography sx={LABEL_SX}>Value</Typography>
        <ValueInput field={field} options={options} value={value} onChange={setValue} />

        {mixedCountries && (
          <Typography sx={{ fontSize: 12, color: "warning.main", mt: 1.5 }}>
            These rows are in more than one country, and a state only means something within one.
            Narrow the selection first.
          </Typography>
        )}

        {/* Naming the exact consequence — "27 cells change" — is what makes this
            confirmable. "Are you sure?" would not be. */}
        <Typography sx={{ fontSize: 13, color: "text.secondary", mt: 2 }}>
          {!field || !value.trim() ? (
            "Pick a column and a value."
          ) : changing === 0 ? (
            "Every one of those rows already holds that value."
          ) : (
            <>
              <Box
                component="span"
                sx={{ fontWeight: 700, color: "text.primary", fontVariantNumeric: "tabular-nums" }}
              >
                {changing}
              </Box>{" "}
              {changing === 1 ? "cell changes" : "cells change"}. One undo puts it back.
            </>
          )}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={quietBtn}>
          Cancel
        </Button>
        <Button
          variant="contained"
          sx={primaryBtn}
          disabled={!field || !value.trim() || !changing || mixedCountries}
          onClick={() => {
            if (field) onApply(field, value.trim(), targets);
            onClose();
          }}
        >
          Fill {changing || ""}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** The same three input shapes the grid uses, so a value typed here can't be one the grid
 *  would refuse. */
function ValueInput({
  field,
  options,
  value,
  onChange,
}: {
  field: Field | "";
  options?: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  if (!field) return <TextField fullWidth size="small" disabled placeholder="Pick a column first" />;

  // A country list is ~250 entries; a menu that long is unusable, so type-ahead instead.
  if (options && options.length > LIST_AS_SELECT) {
    return (
      <Autocomplete
        freeSolo
        options={options}
        inputValue={value}
        onInputChange={(_, v) => onChange(v)}
        renderInput={(p) => <TextField {...p} size="small" autoFocus placeholder="Start typing…" />}
      />
    );
  }
  if (options?.length) {
    return (
      <Select
        fullWidth
        size="small"
        value={value}
        displayEmpty
        onChange={(e) => onChange(String(e.target.value))}
        sx={{ fontSize: 13 }}
      >
        <MenuItem value="" disabled sx={{ fontSize: 13 }}>
          Choose a value…
        </MenuItem>
        {options.map((o) => (
          <MenuItem key={o} value={o} sx={{ fontSize: 13 }}>
            {o}
          </MenuItem>
        ))}
      </Select>
    );
  }
  return (
    <TextField
      fullWidth
      size="small"
      autoFocus
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Value"
    />
  );
}

const LABEL_SX = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.14em",
  textTransform: "uppercase" as const,
  color: "text.disabled",
  mb: 0.6,
};
