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

// Chart palette for Ad Campaigns → Analytics.
//
// The SERIES colours below are ported unchanged from Marketing Ops
// (frontend/operations/ad-campaigns/analytics/theme.ts) so the charts read the
// same as the tool the marketing team uses today.
//
// What did change: Marketing Ops hardcoded its chart CHROME — table header
// backgrounds, panel borders, gridlines, zebra striping — as light-mode hex
// values, because that app only has a light theme. One WSO2 has both, and a
// hardcoded `#F1F4F8` header on a `#141417` card is unreadable. So every chrome
// value is a theme token here, resolved per mode, while the data colours stay
// fixed (a series must not change hue when you flip the theme).
//
// ⚠️ Known deviation from the `dataviz` skill, accepted deliberately for this
// phase (see §8 of the migration findings doc): `colorFor` CYCLES this
// nine-colour list with `i % length`. Business units and regions can exceed nine
// segments, and a cycled tenth hue is indistinguishable from the first — under
// colour-vision deficiency it's indistinguishable much sooner than that. The
// skill's fix is to drop the pies for sequential-hue horizontal bars. That was
// deferred to keep visual continuity with Marketing Ops during the migration;
// the companion tables next to every chart carry exact labels and values, which
// is what keeps the charts readable in the meantime.

// Categorical series colours (pies, table swatches), in order. Desaturated and
// readable on white — brand orange stays an ACCENT for totals, never a
// categorical slot competing in every chart.
export const CHART_COLORS = [
  "#3E6FA3", // blue
  "#4FA39B", // teal
  "#6FA96B", // green
  "#E0A33E", // amber
  "#C9756B", // terracotta
  "#8C79B0", // violet
  "#5C7D99", // steel
  "#B7894C", // ochre
  "#A98DA0", // mauve
];

// Neutral for "Unknown" / "(none)" buckets so they recede instead of taking a
// bright categorical colour and reading as a real segment.
export const NEUTRAL = "#AEB6BF";

// Accent for the single most important figure (totals). Muted, not neon.
export const ACCENT = "#C85C2E";

// Sequential single-hue ramp (light → dark) for matrix-cell heat shading. This
// one IS a correct sequential encoding — magnitude, one hue, monotonic lightness.
export const HEAT_LIGHT = ["#EFF4F9", "#D6E3F0", "#B4CCE2", "#8DB0D2", "#5C7D99"];

// Dark-mode heat steps: the same hue re-stepped for a dark surface rather than an
// inverted light ramp. On `#141417` the light ramp's pale end is brighter than the
// darkest end, so "near zero" would read as the hottest cell — the encoding would
// literally invert.
export const HEAT_DARK = ["#1B2A38", "#22394D", "#2C4C67", "#376284", "#4C7CA3"];

// Labels that should get NEUTRAL rather than a categorical colour.
const MUTED_LABELS = new Set(["(none)", "Unknown", "(unmatched)", "—"]);

// Colour for a named segment at index `i`. See the cycling caveat in the header.
export const colorFor = (name: string, i: number): string =>
  MUTED_LABELS.has(name) ? NEUTRAL : CHART_COLORS[i % CHART_COLORS.length];

// Chart chrome, resolved per theme mode. Passed the MUI palette mode so callers
// can read it off the theme rather than guessing.
export interface ChartChrome {
  headerBg: string;
  headerText: string;
  gridLine: string;
  zebra: string;
  accentBar: string;
  heat: string[];
}

export function chartChrome(mode: "light" | "dark"): ChartChrome {
  return mode === "dark"
    ? {
        headerBg: "#1E1E23",
        headerText: "#B4B4BC",
        gridLine: "rgba(255, 255, 255, 0.08)",
        zebra: "#17171B",
        accentBar: "#5C8FC4",
        heat: HEAT_DARK,
      }
    : {
        headerBg: "#F1F4F8",
        headerText: "#42526B",
        gridLine: "rgba(15, 23, 42, 0.06)",
        zebra: "#FAFBFC",
        accentBar: "#3E6FA3",
        heat: HEAT_LIGHT,
      };
}

// ---- number formatting -----------------------------------------------------
//
// Shared by all three views so a figure reads identically wherever it appears.
// `—` for null rather than 0: these reports distinguish "no data" from "zero",
// and rendering an absent cost-per-lead as $0 would claim the best possible
// result for a campaign that simply has no leads yet.

export const usd = (n: number | null | undefined): string =>
  n == null ? "—" : "$" + Math.round(n).toLocaleString();

export const num = (n: number | null | undefined): string =>
  n == null ? "—" : Math.round(n).toLocaleString();

export const pct = (n: number | null | undefined): string =>
  n == null ? "—" : `${n.toFixed(2)}%`;

export const perDollar = (n: number | null | undefined): string =>
  n == null ? "—" : `${n.toFixed(2)}×`;
