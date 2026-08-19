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
  DialogActions,
  MenuItem,
  OutlinedInput,
  Select,
  Typography,
} from "@wso2/oxygen-ui";
import { useAssetGenerators } from "../../api/useMarketingOpsSettings";
import { buildAssetName, initValues, yearOptions } from "../../utilities/assetName";

// Name the template for Pardot using the SAME generator config and builder as the
// standalone Asset Name Generator (ported in Phase 1). That reuse is the point: a
// name generated here is identical to one generated in Utilities, so Pardot template
// names stay consistent regardless of where the marketer happened to be standing.

const labelSx = {
  fontSize: 11,
  fontWeight: 700,
  color: "text.secondary",
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
  mb: 0.5,
};
const inputSx = { height: 38, fontSize: 13, bgcolor: "background.default" } as const;

export default function AssetNameDialog({
  open,
  onApply,
  onClose,
}: {
  open: boolean;
  onApply: (name: string) => void;
  onClose: () => void;
}) {
  const { generators } = useAssetGenerators();
  const [genId, setGenId] = useState(generators[0].id);
  // Fall back to the first generator if the selected id disappears — the list swaps
  // identity when the live settings replace the hardcoded fallback.
  const gen = useMemo(
    () => generators.find((g) => g.id === genId) ?? generators[0],
    [genId, generators],
  );

  // Field values are keyed by generator id, so switching generators and coming back
  // keeps what you typed — and a generator's defaults are computed on first use
  // rather than synced in an effect.
  const [byGen, setByGen] = useState<Record<string, Record<string, string>>>({});
  const values = byGen[gen.id] ?? initValues(gen);
  const set = (key: string, v: string) =>
    setByGen((prev) => ({ ...prev, [gen.id]: { ...(prev[gen.id] ?? initValues(gen)), [key]: v } }));

  const years = useMemo(() => yearOptions(), []);
  const output = buildAssetName(gen, values);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <Box sx={{ p: 3 }}>
        <Typography sx={{ fontSize: 16, fontWeight: 800, mb: 0.5 }}>
          Generate template name
        </Typography>
        <Typography sx={{ fontSize: 13, color: "text.secondary", mb: 2 }}>
          Builds a standardized name to give the template in Pardot. The selected year is added as
          two digits.
        </Typography>

        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mb: 2.5 }}>
          {generators.map((g) => {
            const active = g.id === genId;
            return (
              <Box
                key={g.id}
                component="button"
                type="button"
                aria-pressed={active}
                onClick={() => setGenId(g.id)}
                sx={{
                  px: 1.5,
                  py: 0.75,
                  borderRadius: 1,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 12,
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
              </Box>
            );
          })}
        </Box>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
            gap: 2,
            mb: 2.5,
          }}
        >
          {gen.fields.map((f) => (
            <Box key={f.key}>
              <Typography sx={labelSx}>{f.label}</Typography>
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
            </Box>
          ))}
        </Box>

        <Typography sx={labelSx}>Result</Typography>
        <Box
          sx={{
            p: 1.25,
            borderRadius: 1,
            bgcolor: "background.default",
            border: 1,
            borderColor: "divider",
            fontFamily: "monospace",
            fontSize: 13,
            wordBreak: "break-all",
          }}
        >
          {output}
        </Box>
      </Box>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} sx={{ textTransform: "none", color: "text.secondary" }}>
          Cancel
        </Button>
        <Button
          onClick={() => {
            onApply(output);
            onClose();
          }}
          variant="contained"
          sx={{ textTransform: "none", fontWeight: 700 }}
        >
          Use this name
        </Button>
      </DialogActions>
    </Dialog>
  );
}
