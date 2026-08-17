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
  Divider,
  FormControlLabel,
  Typography,
} from "@wso2/oxygen-ui";
import { buildUtmUrl, DEFAULTS } from "../../utilities/utm";
import { UtmControls, UtmSegments } from "./UtmControls";
import { today, type UtmState } from "./utmState";

// Build ONE set of UTM parameters and apply it to the body links you pick.
//
// The checkbox list is the whole point: not every link should carry campaign
// tracking, and a blanket "tag everything" would put UTMs on links that shouldn't
// have them. Header/footer, merge-field, mailto and anchor links never reach this
// list — the editor filters to real http(s) links inside the body region.
//
// Each link keeps its OWN base URL; only the utm_* params are replaced. So this is
// "apply this campaign to these links", not "point these links at one URL".

export interface GlobalUtmFields {
  source: string;
  medium: string;
  region: string;
  bu: string;
  campaign: string;
  startDate: string;
}

export interface GlobalUtmLink {
  index: number;
  href: string;
  text: string;
}

const labelSx = {
  fontSize: 11,
  fontWeight: 700,
  color: "text.secondary",
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
  mb: 0.5,
};

export default function GlobalUtmDialog({
  open,
  links,
  onApply,
  onClose,
}: {
  open: boolean;
  links: GlobalUtmLink[];
  onApply: (f: GlobalUtmFields, selected: number[]) => void;
  onClose: () => void;
}) {
  const [utm, setUtm] = useState<UtmState>(() => ({
    campaign: "",
    startDate: today(),
    source: DEFAULTS.source,
    medium: DEFAULTS.medium,
    region: DEFAULTS.region,
    bu: DEFAULTS.bu,
  }));

  // Default to ALL links checked — opting a few out is the common case; opting all
  // out isn't, and starting empty would make the usual path more work.
  const [picked, setPicked] = useState<Set<number>>(() => new Set(links.map((l) => l.index)));

  // Only the segments matter here, not a URL — each link supplies its own base, so
  // the placeholder page URL exists purely to make the builder produce segments.
  const { segments } = useMemo(
    () => buildUtmUrl({ pageUrl: "https://example.com", ...utm }),
    [utm],
  );

  const allChecked = links.length > 0 && picked.size === links.length;
  const someChecked = picked.size > 0 && !allChecked;

  const toggle = (i: number) =>
    setPicked((prev) => {
      const n = new Set(prev);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });

  const toggleAll = () =>
    setPicked(allChecked ? new Set() : new Set(links.map((l) => l.index)));

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <Box sx={{ p: 3 }}>
        <Typography sx={{ fontSize: 16, fontWeight: 800, mb: 0.5 }}>Build tracking URLs</Typography>
        <Typography sx={{ fontSize: 13, color: "text.secondary", mb: 2 }}>
          Standardized UTM parameters are added automatically and applied to the body links you
          select below. Existing UTM parameters on a link are replaced; each link keeps its own base
          URL.
        </Typography>

        <UtmControls state={utm} onChange={(patch) => setUtm((s) => ({ ...s, ...patch }))} />
        <UtmSegments segments={segments} />

        <Divider sx={{ mb: 1.5 }} />

        {links.length === 0 ? (
          <Typography sx={{ fontSize: 13, color: "text.disabled", fontStyle: "italic", py: 1 }}>
            No http/https links found in the body. Add a button or link first.
          </Typography>
        ) : (
          <>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                mb: 0.5,
              }}
            >
              <Typography sx={labelSx}>
                Apply to ({picked.size}/{links.length})
              </Typography>
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={allChecked}
                    indeterminate={someChecked}
                    onChange={toggleAll}
                    sx={{ p: 0.5 }}
                  />
                }
                label={
                  <Typography sx={{ fontSize: 12, color: "text.secondary" }}>Select all</Typography>
                }
                sx={{ m: 0 }}
              />
            </Box>
            <Box
              sx={{
                maxHeight: 220,
                overflowY: "auto",
                border: 1,
                borderColor: "divider",
                borderRadius: 1,
              }}
            >
              {links.map((l, j) => (
                <Box
                  key={l.index}
                  component="button"
                  type="button"
                  onClick={() => toggle(l.index)}
                  sx={{
                    display: "flex",
                    width: "100%",
                    textAlign: "left",
                    alignItems: "flex-start",
                    gap: 1,
                    px: 1.25,
                    py: 1,
                    cursor: "pointer",
                    border: 0,
                    borderTop: j === 0 ? 0 : 1,
                    borderColor: "divider",
                    bgcolor: "transparent",
                    fontFamily: "inherit",
                    "&:hover": { bgcolor: "action.hover" },
                  }}
                >
                  <Checkbox
                    size="small"
                    checked={picked.has(l.index)}
                    // The row is the click target; the checkbox is presentational so a
                    // click doesn't fire the toggle twice.
                    tabIndex={-1}
                    readOnly
                    sx={{ p: 0, mt: 0.2, pointerEvents: "none" }}
                  />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    {l.text && (
                      <Typography
                        sx={{
                          fontSize: 13,
                          fontWeight: 600,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {l.text}
                      </Typography>
                    )}
                    <Typography
                      sx={{
                        fontSize: 11,
                        fontFamily: "monospace",
                        color: "text.secondary",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {l.href}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </>
        )}
      </Box>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} sx={{ textTransform: "none", color: "text.secondary" }}>
          Cancel
        </Button>
        <Button
          onClick={() => {
            onApply({ ...utm }, [...picked]);
            onClose();
          }}
          disabled={picked.size === 0}
          variant="contained"
          sx={{ textTransform: "none", fontWeight: 700 }}
        >
          {picked.size === 0
            ? "Select links"
            : `Apply to ${picked.size} link${picked.size === 1 ? "" : "s"}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
