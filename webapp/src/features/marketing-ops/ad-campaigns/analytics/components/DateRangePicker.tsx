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
import { Box, Button, OutlinedInput, Typography } from "@wso2/oxygen-ui";
import type { DateWindow, WindowPreset } from "../adAnalyticsTypes";
import { FieldLabel, ToggleChip } from "./AnalyticsPrimitives";

// Date range for all three reports.
//
// The asymmetry here is deliberate and worth preserving: PRESETS apply
// immediately, but a CUSTOM range does not. The two date fields edit a local
// draft and only Apply commits it.
//
// The reason is cost. Every committed change re-runs live Google Ads and
// Salesforce queries that take seconds. Auto-running on each keystroke of a
// half-typed date would fire several expensive reports nobody asked for — and
// `<input type="date">` emits a change event for every partial value as it's
// typed, so this isn't hypothetical.

const PRESETS: { key: WindowPreset; label: string }[] = [
  { key: "1m", label: "Past month" },
  { key: "3m", label: "3 months" },
  { key: "6m", label: "6 months" },
  { key: "ytd", label: "Year to date" },
];

export default function DateRangePicker({
  window,
  onChange,
}: {
  window: DateWindow;
  onChange: (w: DateWindow) => void;
}) {
  const isCustom = window.mode === "custom";

  return (
    <Box>
      <FieldLabel>Date range</FieldLabel>
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
        {PRESETS.map((p) => (
          <ToggleChip
            key={p.key}
            label={p.label}
            active={!isCustom && (window.preset ?? "1m") === p.key}
            onClick={() => onChange({ mode: "preset", preset: p.key })}
          />
        ))}
        <Box sx={{ width: "1px", height: 20, bgcolor: "divider", mx: 0.25 }} />
        <ToggleChip
          label="Custom"
          active={isCustom}
          onClick={() =>
            onChange({ mode: "custom", start: window.start ?? "", end: window.end ?? "" })
          }
        />
      </Box>

      {isCustom && (
        // Keyed on the committed range so the draft RESETS by remounting when the
        // window changes from outside — e.g. clicking a preset while a custom
        // range was half-edited, then clicking Custom again. Doing this with an
        // effect that mirrors props into state is the antipattern React's
        // set-state-in-effect rule exists to catch.
        <CustomRange
          key={`${window.start ?? ""}|${window.end ?? ""}`}
          committedStart={window.start ?? ""}
          committedEnd={window.end ?? ""}
          onApply={(start, end) => onChange({ mode: "custom", start, end })}
        />
      )}
    </Box>
  );
}

function CustomRange({
  committedStart,
  committedEnd,
  onApply,
}: {
  committedStart: string;
  committedEnd: string;
  onApply: (start: string, end: string) => void;
}) {
  const [draftStart, setDraftStart] = useState(committedStart);
  const [draftEnd, setDraftEnd] = useState(committedEnd);

  const bothPicked = Boolean(draftStart && draftEnd);
  // String comparison is correct for ISO yyyy-mm-dd and avoids constructing
  // Dates, which would drag timezone handling into a pure ordering check.
  const validOrder = !bothPicked || draftStart <= draftEnd;
  const changed = draftStart !== committedStart || draftEnd !== committedEnd;
  const canApply = bothPicked && validOrder && changed;

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1.25, flexWrap: "wrap" }}>
      <OutlinedInput
        size="small"
        type="date"
        value={draftStart}
        aria-label="Range start"
        onChange={(e) => setDraftStart(e.target.value)}
        sx={{ fontSize: 12.5 }}
      />
      <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>→</Typography>
      <OutlinedInput
        size="small"
        type="date"
        value={draftEnd}
        aria-label="Range end"
        onChange={(e) => setDraftEnd(e.target.value)}
        sx={{ fontSize: 12.5 }}
      />
      <Button
        variant="contained"
        disableElevation
        size="small"
        disabled={!canApply}
        onClick={() => onApply(draftStart, draftEnd)}
        sx={{ fontSize: 12, fontWeight: 700, textTransform: "none" }}
      >
        Apply
      </Button>
      {bothPicked && !validOrder && (
        <Typography sx={{ fontSize: 11.5, color: "error.main" }}>
          Start must be on or before end.
        </Typography>
      )}
    </Box>
  );
}
