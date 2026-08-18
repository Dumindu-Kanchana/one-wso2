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
import { Box, ButtonBase, MenuItem, OutlinedInput, Select, Typography } from "@wso2/oxygen-ui";
import MarketingOpsShell from "../../components/MarketingOpsShell";
import CopyField from "../components/CopyField";
import { useAssetGenerators } from "../../api/useMarketingOpsSettings";
import { buildAssetName, initValues, yearOptions } from "../assetName";

const labelSx = {
  fontSize: 11,
  fontWeight: 700,
  color: "text.secondary",
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
  mb: 0.6,
};
const inputSx = { height: 38, fontSize: 13, bgcolor: "background.default" } as const;

/** Stable empty-edits identity — see the note where it's used. */
const NO_EDITS: Record<string, string> = {};

export default function AssetNameGeneratorPage() {
  const { generators } = useAssetGenerators();
  const [genId, setGenId] = useState(generators[0].id);

  // Fall back to the first generator if the selected id vanishes — the
  // generator list can change identity when the live settings load replaces the
  // fallback, and a dangling id would otherwise crash on `gen.fields`.
  const gen = useMemo(
    () => generators.find((g) => g.id === genId) ?? generators[0],
    [genId, generators],
  );

  // Edits over defaults, held together with the generator they were typed into —
  // the same shape as the filter-scoped paging in CRM Upload, and for the same
  // reason: switching generator has to start clean, and that is a derivation
  // rather than an event.
  //
  // This replaced `useEffect(() => setValues(initValues(gen)), [gen])`, which reset
  // EVERY field whenever `gen` changed identity. `gen` changes identity when the
  // live option lists arrive and replace the coded fallback — so a marketer who
  // started typing a campaign name during that first second watched it disappear.
  const [held, setHeld] = useState<{ genId: string; edits: Record<string, string> }>(() => ({
    genId: generators[0].id,
    edits: {},
  }));
  // Memoized, and NO_EDITS is a module constant, so the identity is stable — a fresh
  // `{}` each render would re-run the reconciliation below on every keystroke.
  const edits = useMemo(
    () => (held.genId === gen.id ? held.edits : NO_EDITS),
    [held.genId, held.edits, gen.id],
  );

  const defaults = useMemo(() => initValues(gen), [gen]);

  // A live list can retire the value someone had selected. Only THAT field falls
  // back to its default; free text and still-valid selections are left alone.
  const values = useMemo(() => {
    const merged: Record<string, string> = { ...defaults, ...edits };
    for (const f of gen.fields) {
      if (f.kind === "select" && !(f.options ?? []).includes(merged[f.key])) {
        merged[f.key] = defaults[f.key];
      }
    }
    return merged;
  }, [defaults, edits, gen]);

  const years = useMemo(() => yearOptions(), []);
  const output = buildAssetName(gen, values);
  const set = (key: string, v: string) =>
    setHeld({ genId: gen.id, edits: { ...edits, [key]: v } });

  return (
    <MarketingOpsShell
      eyebrow="🧰 Utilities"
      title="Asset Name Generator"
      subtitle="Generates standardized asset and campaign names. Pick the name type, fill the fields, and the result assembles live below. The selected year is added as two digits (2026 → 26)."
    >
      <Box sx={{ maxWidth: "72ch" }}>
        {/* Generator selector. A row of toggles rather than a dropdown: there
            are only four, and seeing all the name types at once is how someone
            unfamiliar works out which one they need. */}
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mb: 3 }}>
          {generators.map((g) => {
            const active = g.id === genId;
            return (
              <ButtonBase
                key={g.id}
                type="button"
                aria-pressed={active}
                onClick={() => setGenId(g.id)}
                sx={{
                  px: 1.5,
                  py: 0.75,
                  borderRadius: 1,
                  fontSize: 12.5,
                  fontWeight: active ? 700 : 500,
                  border: 1,
                  borderColor: active ? "primary.main" : "divider",
                  color: active ? "primary.main" : "text.secondary",
                  bgcolor: active ? "action.selected" : "transparent",
                  transition: "all .12s",
                  "&:hover": { borderColor: "primary.main", color: "primary.main" },
                }}
              >
                {g.name}
              </ButtonBase>
            );
          })}
        </Box>

        {/* Fields */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
            gap: 2,
            mb: 3,
          }}
        >
          {gen.fields.map((f) => (
            <Box key={f.key}>
              <Typography sx={labelSx}>
                {f.label}
                {f.optional && (
                  <Box
                    component="span"
                    sx={{ color: "text.disabled", textTransform: "none", fontWeight: 500 }}
                  >
                    {" "}
                    · optional
                  </Box>
                )}
              </Typography>
              {f.kind === "text" ? (
                <OutlinedInput
                  fullWidth
                  size="small"
                  value={values[f.key] ?? ""}
                  placeholder={f.placeholder}
                  onChange={(e) => set(f.key, e.target.value)}
                  sx={inputSx}
                />
              ) : (
                <Select
                  fullWidth
                  size="small"
                  value={values[f.key] ?? ""}
                  onChange={(e) => set(f.key, String(e.target.value))}
                  sx={inputSx}
                >
                  {(f.kind === "year" ? years : (f.options ?? [])).map((o) => (
                    <MenuItem key={o} value={o} sx={{ fontSize: 13 }}>
                      {o}
                    </MenuItem>
                  ))}
                </Select>
              )}
              {f.note && (
                <Typography sx={{ fontSize: 11, color: "text.disabled", mt: 0.4 }}>
                  {f.note}
                </Typography>
              )}
            </Box>
          ))}
        </Box>

        <CopyField label={gen.name} value={output} />
      </Box>
    </MarketingOpsShell>
  );
}
