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
import { Alert, Box, MenuItem, OutlinedInput, Select, Typography } from "@wso2/oxygen-ui";
import { TriangleAlert } from "@wso2/oxygen-ui-icons-react";
import MarketingOpsShell from "../../components/MarketingOpsShell";
import CopyField from "../components/CopyField";
import { useUtmSchema } from "../../api/useMarketingOpsSettings";
import { DEFAULTS, buildUtmUrl, type Pair } from "../utm";

const labelSx = {
  fontSize: 11,
  fontWeight: 700,
  color: "text.secondary",
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
  mb: 0.6,
};
const inputSx = { height: 38, fontSize: 13, bgcolor: "background.default" } as const;

function today(): string {
  // Local date, not toISOString's UTC — otherwise the <input type="date">
  // default shows yesterday or tomorrow for anyone far enough from UTC.
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Colour-coded utm_campaign segments, in fixed order. Theme palette keys rather
// than the raw hex tokens Marketing Ops used, so the breakdown stays legible in
// both light and dark themes.
const SEG_COLORS = [
  "primary.main",
  "info.main",
  "success.main",
  "secondary.main",
  "warning.main",
  "text.secondary",
];

export default function UtmGeneratorPage() {
  const [pageUrl, setPageUrl] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [startDate, setStartDate] = useState(today());
  const { schema } = useUtmSchema();
  const [source, setSource] = useState(DEFAULTS.source);
  const [medium, setMedium] = useState(DEFAULTS.medium);
  const [region, setRegion] = useState(DEFAULTS.region);
  const [bu, setBu] = useState(DEFAULTS.bu);

  const hasPercent = pageUrl.includes("%") || campaignName.includes("%");

  const { url, segments } = useMemo(
    () => buildUtmUrl({ pageUrl, campaign: campaignName, startDate, source, medium, region, bu }),
    [pageUrl, campaignName, startDate, source, medium, region, bu],
  );

  const selects: Array<{ label: string; value: string; set: (v: string) => void; opts: Pair[] }> = [
    { label: "Source", value: source, set: setSource, opts: schema.source },
    { label: "Medium", value: medium, set: setMedium, opts: schema.medium },
    { label: "Region", value: region, set: setRegion, opts: schema.region },
    { label: "Business Unit", value: bu, set: setBu, opts: schema.bu },
  ];

  return (
    <MarketingOpsShell
      eyebrow="🧰 Utilities"
      title="UTM Link Generator"
      subtitle="Build consistent campaign tracking URLs. Codes and casing are standardized automatically."
    >
      <Box sx={{ maxWidth: "72ch" }}>
        {/* Text inputs */}
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr", gap: 2, mb: 2 }}>
          <Box>
            <Typography sx={labelSx}>
              Page URL <Box component="span" sx={{ color: "primary.main" }}>*</Box>
            </Typography>
            <OutlinedInput
              fullWidth
              size="small"
              value={pageUrl}
              placeholder="https://wso2.com/..."
              onChange={(e) => setPageUrl(e.target.value)}
              sx={{ ...inputSx, fontFamily: "monospace" }}
            />
          </Box>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
            <Box>
              <Typography sx={labelSx}>
                Campaign Name <Box component="span" sx={{ color: "primary.main" }}>*</Box>
              </Typography>
              <OutlinedInput
                fullWidth
                size="small"
                value={campaignName}
                placeholder="e.g. API_Platform_Onboarding"
                onChange={(e) => setCampaignName(e.target.value)}
                sx={inputSx}
              />
            </Box>
            <Box>
              <Typography sx={labelSx}>
                Campaign Start Date <Box component="span" sx={{ color: "primary.main" }}>*</Box>
              </Typography>
              <OutlinedInput
                fullWidth
                size="small"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                sx={inputSx}
              />
            </Box>
          </Box>
        </Box>

        {/* Dropdowns — options come from /api/settings/utm, falling back to the
            hardcoded schema so the tool works before that call lands. */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
            gap: 2,
            mb: 2,
          }}
        >
          {selects.map((s) => (
            <Box key={s.label}>
              <Typography sx={labelSx}>{s.label}</Typography>
              <Select
                fullWidth
                size="small"
                value={s.value}
                onChange={(e) => s.set(String(e.target.value))}
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

        {/* % warning. Worth surfacing rather than silently stripping: the user
            typed something that isn't in the output, and finding that out later
            from a broken tracking link is much worse. */}
        {hasPercent && (
          <Alert
            severity="warning"
            icon={<TriangleAlert size={16} />}
            sx={{ mb: 2, fontSize: 12 }}
          >
            A <code>%</code> was found and removed — percent signs can break URL routing and
            tracking, so they're stripped from the output automatically.
          </Alert>
        )}

        {/* utm_campaign breakdown */}
        <Box sx={{ mb: 2 }}>
          <Typography sx={{ ...labelSx, mb: 1 }}>utm_campaign breakdown</Typography>
          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 0.5,
              fontFamily: "monospace",
              fontSize: 12.5,
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
          <Typography sx={{ fontSize: 11, color: "text.disabled", mt: 1 }}>
            Order is fixed: source · medium · region · BU · campaign · date (MMDDYY).
          </Typography>
        </Box>

        <CopyField
          label="Parameterized URL"
          value={url}
          placeholder="Enter a Page URL to generate your tracking link…"
        />
      </Box>
    </MarketingOpsShell>
  );
}
