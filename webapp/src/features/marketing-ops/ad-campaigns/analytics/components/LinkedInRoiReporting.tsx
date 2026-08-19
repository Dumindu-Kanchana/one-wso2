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

import type { ReactNode } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { Download } from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import {
  downloadCsv,
  linkedInRoiToCsv,
  type LinkedInBuRow,
  type LinkedInRoiReport,
  type LinkedInRoiTotals,
} from "../adAnalyticsTypes";
import { num, perDollar, usd } from "../chartTheme";
import { EmptyHint, ReportLoading, StatCard } from "./AnalyticsPrimitives";
import { useChartChrome, useTableSx } from "./useChartStyles";

// LinkedIn ROI — business-unit-first, because LinkedIn lead-gen gives us nothing
// finer to attribute by.
//
// Two things shape this view and are worth understanding before changing it:
//
//  1. There is no campaign attribution. LinkedIn lead-gen leads carry no
//     utm_campaign, and the integration stamps a form URN that's reused across
//     many campaigns — so leads roll up by BU (from a form tag), while spend rolls
//     up by BU (from the campaign name). Two different paths to the same grouping,
//     which is why a BU can show spend with zero leads.
//  2. Revenue is ~0 by design. These are top-of-funnel whitepaper downloads that
//     rarely convert, so the headline is spend / leads / cost-per-lead, NOT
//     pipeline. Leading with won-value here would make every campaign look like a
//     failure against a metric it was never meant to move.

const LI_LOADING = [
  "Generating LinkedIn ROI…",
  "Reading spend + lead-gen leads…",
  "Grouping by business unit…",
] as const;

export default function LinkedInRoiReporting({
  query,
}: {
  query: {
    data?: LinkedInRoiReport;
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
  };
}) {
  if (query.isLoading) return <ReportLoading messages={LI_LOADING} />;
  if (query.isError) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {describeError(query.error)}
      </Alert>
    );
  }
  if (!query.data) return <EmptyHint>Pick a date range to see the LinkedIn ROI.</EmptyHint>;
  return <ResultsView report={query.data} />;
}

function ResultsView({ report }: { report: LinkedInRoiReport }) {
  const { cell, hdr } = useTableSx();
  const t = report.totals;
  const mq = report.match_quality;
  const bu = report.bu_rows ?? [];
  const matrix = report.form_region_matrix;
  const regions = report.region_breakdown ?? [];

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 1.5,
          flexWrap: "wrap",
          gap: 1,
        }}
      >
        <Typography sx={{ fontSize: 11, color: "text.secondary", fontVariantNumeric: "tabular-nums" }}>
          {report.window_start} → {report.window_end} · leads by CreatedDate
        </Typography>
        <Button
          size="small"
          variant="outlined"
          disabled={bu.length === 0}
          onClick={() =>
            downloadCsv(
              `linkedin-roi-${report.window_start}_${report.window_end}.csv`,
              linkedInRoiToCsv(report),
            )
          }
          startIcon={<Download size={15} />}
          sx={{ fontSize: 12, fontWeight: 700, textTransform: "none" }}
        >
          Export CSV
        </Button>
      </Box>

      {/* Cost-per-lead leads the strip, not pipeline — see the header note. */}
      {t && (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "repeat(2,1fr)", md: "repeat(4,1fr)" },
            gap: 1,
            mb: 2,
          }}
        >
          <StatCard label="Spend" value={usd(t.spend)} />
          <StatCard label="Leads" value={num(t.leads)} />
          <StatCard label="Cost / lead" value={usd(t.cost_per_lead)} accent="#C85C2E" />
          <StatCard label="Opportunities" value={num(t.opportunities)} />
        </Box>
      )}

      {mq && <AttributionPanel mq={mq} />}

      <SubTitle>ROI by business unit</SubTitle>
      {bu.length === 0 ? (
        <EmptyHint>No LinkedIn activity in this window.</EmptyHint>
      ) : (
        <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1.25, overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 640 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={hdr}>Business unit</TableCell>
                <TableCell align="right" sx={hdr}>Spend</TableCell>
                <TableCell align="right" sx={hdr}>Leads</TableCell>
                <TableCell align="right" sx={hdr}>Cost/lead</TableCell>
                <TableCell align="right" sx={hdr}>Opps</TableCell>
                <TableCell align="right" sx={hdr}>Won $</TableCell>
                <TableCell align="right" sx={hdr}>Value/$</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {bu.map((r, i) => (
                <BuRow key={i} r={r} cell={cell} />
              ))}
              {t && <BuTotalRow t={t} hdrBg={hdr.bgcolor} />}
            </TableBody>
          </Table>
        </Box>
      )}
      <Typography sx={{ fontSize: 11, color: "text.disabled", mt: 1, mb: 3 }}>
        * Spend is exact per campaign (rolled to BU by campaign name); leads roll to BU by form
        tag. A BU with spend but zero leads ran campaigns whose leads were form-captured under
        another BU, so per-BU cost-per-lead is an upper bound. Revenue is ~0 by design — these are
        top-of-funnel leads.
      </Typography>

      {matrix && matrix.rows.length > 0 && (
        <>
          <SubTitle>Leads by form × region</SubTitle>
          <FormRegionMatrix matrix={matrix} />
        </>
      )}

      {regions.length > 0 && (
        <>
          <SubTitle>Leads by region</SubTitle>
          <RegionBars regions={regions} />
        </>
      )}
    </Box>
  );
}

function BuRow({ r, cell }: { r: LinkedInBuRow; cell: Record<string, unknown> }) {
  // Spend with no leads: not an error, but the thing a reader should notice —
  // see the footnote about cross-BU form capture.
  const noLeads = r.leads === 0 && r.spend > 0;
  const chrome = useChartChrome();
  const n = (v: ReactNode, dim?: boolean) => (
    <TableCell align="right" sx={{ ...cell, color: dim ? "text.disabled" : "text.primary" }}>
      {v}
    </TableCell>
  );
  return (
    <TableRow>
      <TableCell
        sx={{
          fontSize: 12,
          fontWeight: 600,
          maxWidth: 240,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {r.bu}
      </TableCell>
      {n(
        <Box component="span" sx={{ color: noLeads ? "warning.main" : undefined }}>
          {usd(r.spend)}
        </Box>,
      )}
      {n(num(r.leads), r.leads === 0)}
      {n(usd(r.cost_per_lead))}
      {n(num(r.opportunities), r.opportunities === 0)}
      {n(usd(r.won_value), !r.won_value)}
      {n(
        <Box
          component="span"
          sx={{ fontWeight: 700, color: r.value_per_dollar ? chrome.accentBar : undefined }}
        >
          {perDollar(r.value_per_dollar)}
        </Box>,
      )}
    </TableRow>
  );
}

function BuTotalRow({ t, hdrBg }: { t: LinkedInRoiTotals; hdrBg: string }) {
  const c = (v: ReactNode) => (
    <TableCell
      align="right"
      sx={{ fontVariantNumeric: "tabular-nums", fontSize: 11.5, fontWeight: 800, whiteSpace: "nowrap" }}
    >
      {v}
    </TableCell>
  );
  return (
    <TableRow sx={{ bgcolor: hdrBg, "& td": { borderTop: 2, borderColor: "divider" } }}>
      <TableCell sx={{ fontSize: 12, fontWeight: 800 }}>Total</TableCell>
      {c(usd(t.spend))}
      {c(num(t.leads))}
      {c(usd(t.cost_per_lead))}
      {c(num(t.opportunities))}
      {c(usd(t.won_value))}
      {c(perDollar(t.value_per_dollar))}
    </TableRow>
  );
}

// Which asset pulls leads in which region. A heatmap is the right form here —
// magnitude across a grid — and the ramp is a correct single-hue sequential
// encoding, re-stepped for dark mode so "near zero" stays the palest cell.
function FormRegionMatrix({
  matrix,
}: {
  matrix: NonNullable<LinkedInRoiReport["form_region_matrix"]>;
}) {
  const { cell, hdr, chrome } = useTableSx();
  const { regions, rows, column_totals } = matrix;
  const max = Math.max(1, ...rows.flatMap((r) => regions.map((rg) => r.by_region[rg] || 0)));
  const heat = (v: number) => {
    if (!v) return "transparent";
    const idx = Math.min(chrome.heat.length - 1, Math.floor((v / max) * chrome.heat.length));
    return chrome.heat[idx];
  };
  return (
    <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1.25, overflowX: "auto" }}>
      <Table size="small" sx={{ minWidth: 720 }}>
        <TableHead>
          <TableRow>
            <TableCell sx={hdr}>Form</TableCell>
            <TableCell sx={hdr}>BU</TableCell>
            {regions.map((rg) => (
              <TableCell key={rg} align="right" sx={hdr}>{rg}</TableCell>
            ))}
            <TableCell align="right" sx={hdr}>Total</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i}>
              <TableCell
                sx={{
                  fontSize: 11.5,
                  fontWeight: 600,
                  maxWidth: 320,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                <Tooltip title={r.form}>
                  <span>{r.form}</span>
                </Tooltip>
              </TableCell>
              <TableCell>
                <Chip
                  size="small"
                  label={r.bu}
                  sx={{
                    fontSize: 10,
                    height: 18,
                    fontWeight: 600,
                    bgcolor: chrome.headerBg,
                    color: chrome.headerText,
                  }}
                />
              </TableCell>
              {regions.map((rg) => {
                const v = r.by_region[rg] || 0;
                return (
                  <TableCell
                    key={rg}
                    align="right"
                    sx={{
                      ...cell,
                      bgcolor: heat(v),
                      color: v ? "text.primary" : "text.disabled",
                    }}
                  >
                    {v || "·"}
                  </TableCell>
                );
              })}
              <TableCell align="right" sx={{ ...cell, fontWeight: 800 }}>
                {num(r.total)}
              </TableCell>
            </TableRow>
          ))}
          <TableRow sx={{ bgcolor: chrome.headerBg, "& td": { borderTop: 2, borderColor: "divider" } }}>
            <TableCell sx={{ fontSize: 11.5, fontWeight: 800 }}>Total</TableCell>
            <TableCell />
            {regions.map((rg) => (
              <TableCell key={rg} align="right" sx={{ ...cell, fontWeight: 800 }}>
                {num(column_totals[rg])}
              </TableCell>
            ))}
            <TableCell align="right" sx={{ ...cell, fontWeight: 800 }}>
              {num(Object.values(column_totals).reduce((a, b) => a + b, 0))}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </Box>
  );
}

function RegionBars({ regions }: { regions: { region: string; leads: number }[] }) {
  const chrome = useChartChrome();
  const max = Math.max(1, ...regions.map((r) => r.leads));
  return (
    <Box
      sx={{
        border: 1,
        borderColor: "divider",
        borderRadius: 1.25,
        p: 2,
        display: "flex",
        flexDirection: "column",
        gap: 1,
      }}
    >
      {regions.map((r) => (
        <Box key={r.region} sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Typography sx={{ fontSize: 11.5, width: 90, color: "text.secondary", flexShrink: 0 }}>
            {r.region}
          </Typography>
          <Box sx={{ flex: 1, height: 14, bgcolor: "action.hover", borderRadius: 0.5, overflow: "hidden" }}>
            <Box
              sx={{
                width: `${(r.leads / max) * 100}%`,
                height: "100%",
                bgcolor: chrome.accentBar,
                borderRadius: 0.5,
              }}
            />
          </Box>
          <Typography
            sx={{
              fontSize: 11.5,
              fontWeight: 700,
              width: 52,
              textAlign: "right",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {num(r.leads)}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

// How the leads were keyed, and how many forms are untagged. Untagged forms are
// the actionable part — they're leads nobody can attribute until someone adds a
// [BU] tag in LinkedIn, so the count is surfaced rather than buried.
function AttributionPanel({ mq }: { mq: NonNullable<LinkedInRoiReport["match_quality"]> }) {
  const chrome = useChartChrome();
  const unclassifiedLeads = mq.unclassified_forms.reduce((a, f) => a + f.leads, 0);
  return (
    <Box
      sx={{
        border: 1,
        borderColor: "divider",
        borderRadius: 1.25,
        p: 1.75,
        mb: 3,
        display: "flex",
        alignItems: "center",
        gap: 2.5,
        flexWrap: "wrap",
      }}
    >
      <Box>
        <Typography
          sx={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.13em",
            textTransform: "uppercase",
            color: "text.secondary",
            mb: 0.4,
          }}
        >
          Attribution
        </Typography>
        <Typography sx={{ fontSize: 11.5, color: "text.secondary", fontVariantNumeric: "tabular-nums" }}>
          {num(mq.leads_form_keyed)} form-captured · {num(mq.leads_campaign_keyed)} campaign-keyed ·{" "}
          {mq.linkedin_campaigns_in_window} campaigns in window
        </Typography>
      </Box>
      <Tooltip title={mq.note}>
        <Chip
          size="small"
          label="BU-first · why?"
          sx={{
            fontSize: 11,
            height: 22,
            fontWeight: 600,
            bgcolor: chrome.headerBg,
            color: chrome.headerText,
          }}
        />
      </Tooltip>
      {mq.unclassified_forms.length > 0 && (
        <Tooltip
          title={`Forms without a [BU] tag — tag them in LinkedIn to classify:\n${mq.unclassified_forms
            .map((f) => `${f.form} (${f.leads})`)
            .join("\n")}`}
        >
          <Chip
            size="small"
            color="warning"
            variant="outlined"
            label={`${num(unclassifiedLeads)} leads from ${mq.unclassified_forms.length} untagged form${
              mq.unclassified_forms.length === 1 ? "" : "s"
            }`}
            sx={{ fontSize: 11, height: 22, fontWeight: 600 }}
          />
        </Tooltip>
      )}
    </Box>
  );
}

function SubTitle({ children }: { children: ReactNode }) {
  return (
    <Typography
      component="h3"
      sx={{
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: "text.secondary",
        mb: 1,
        mt: 1,
      }}
    >
      {children}
    </Typography>
  );
}
