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

import { Box, MenuItem, OutlinedInput, Select, Typography } from "@wso2/oxygen-ui";
import { useUtmSchema } from "../../api/useMarketingOpsSettings";
import type { Pair, UtmSegment } from "../../utilities/utm";
import type { UtmState } from "./utmState";

// The UTM control set shared by both editor dialogs — the single-link builder and
// the tag-many builder. Marketing Ops had these fields written out twice (plus a
// third time in the standalone Utilities tool); one copy here, so a change to the
// field set can't apply to one dialog and not the other.
//
// Options come from /api/settings/utm via the same hook the Utilities page uses, so
// a value retired by an admin disappears from every builder at once.

const labelSx = {
  fontSize: 11,
  fontWeight: 700,
  color: "text.secondary",
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
  mb: 0.5,
};
const inputSx = { height: 38, fontSize: 13, bgcolor: "background.default" } as const;

/** Keep a selection that the schema still offers; otherwise fall back to its first. */
function offered(value: string, opts: Pair[]): string {
  return opts.some(([, code]) => code === value) ? value : (opts[0]?.[1] ?? "");
}

export function UtmControls({
  state,
  onChange,
}: {
  state: UtmState;
  onChange: (patch: Partial<UtmState>) => void;
}) {
  const { schema } = useUtmSchema();
  const selects: { label: string; key: keyof UtmState; opts: Pair[] }[] = [
    { label: "Source", key: "source", opts: schema.source },
    { label: "Medium", key: "medium", opts: schema.medium },
    { label: "Region", key: "region", opts: schema.region },
    { label: "Business Unit", key: "bu", opts: schema.bu },
  ];

  return (
    <>
      <Box
        sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2, mb: 2 }}
      >
        <Box>
          <Typography sx={labelSx}>Campaign Name</Typography>
          <OutlinedInput
            fullWidth
            size="small"
            value={state.campaign}
            placeholder="e.g. API_Platform_Onboarding"
            onChange={(e) => onChange({ campaign: e.target.value })}
            sx={inputSx}
          />
        </Box>
        <Box>
          <Typography sx={labelSx}>Campaign Start Date</Typography>
          <OutlinedInput
            fullWidth
            size="small"
            type="date"
            value={state.startDate}
            onChange={(e) => onChange({ startDate: e.target.value })}
            sx={inputSx}
          />
        </Box>
      </Box>

      <Box
        sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2, mb: 2 }}
      >
        {selects.map((s) => (
          <Box key={s.label}>
            <Typography sx={labelSx}>{s.label}</Typography>
            <Select
              fullWidth
              size="small"
              // Resolved against the live options, the same way the standalone UTM
              // page does it: these default to coded constants, so an admin who
              // retires the default leaves the Select rendering blank while the
              // state still holds the retired code — and the built link ships it.
              value={offered(state[s.key], s.opts)}
              onChange={(e) => onChange({ [s.key]: String(e.target.value) } as Partial<UtmState>)}
              sx={inputSx}
            >
              {s.opts.map(([label, code]) => (
                <MenuItem key={`${label}-${code}`} value={code} sx={{ fontSize: 13 }}>
                  {label}
                </MenuItem>
              ))}
            </Select>
          </Box>
        ))}
      </Box>
    </>
  );
}

// The colour-coded utm_campaign breakdown. Outlined rather than tinted so each
// segment stays legible on either theme's surface.
const SEG_COLORS = [
  "primary.main",
  "info.main",
  "success.main",
  "secondary.main",
  "warning.main",
  "text.secondary",
];

export function UtmSegments({ segments }: { segments: UtmSegment[] }) {
  if (segments.length === 0) return null;
  return (
    <Box
      sx={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 0.5,
        fontFamily: "monospace",
        fontSize: 12.5,
        mb: 2,
      }}
    >
      {segments.map((s, i) => (
        <Box key={s.hint} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Box
            title={s.hint}
            sx={{
              px: 0.9,
              py: 0.3,
              borderRadius: 0.75,
              border: 1,
              borderColor: SEG_COLORS[i % SEG_COLORS.length],
              color: SEG_COLORS[i % SEG_COLORS.length],
              fontWeight: 600,
            }}
          >
            {s.v}
          </Box>
          {i < segments.length - 1 && (
            <Box component="span" sx={{ color: "text.disabled" }}>
              _
            </Box>
          )}
        </Box>
      ))}
    </Box>
  );
}
