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

// Theme-aware chart and table styles for the analytics views. Separate from
// AnalyticsPrimitives so React Fast Refresh keeps working — a module that exports
// both components and hooks loses hot-reload for the components.

import { useTheme } from "@wso2/oxygen-ui";
import { chartChrome, type ChartChrome } from "../chartTheme";

// Resolve the chart chrome for the active theme mode. Every table header, grid
// line and heat ramp goes through this, which is what makes the ported charts
// legible in dark mode — Marketing Ops hardcoded light-mode greys because that
// app has only one theme.
export function useChartChrome(): ChartChrome {
  const theme = useTheme();
  return chartChrome(theme.palette.mode === "dark" ? "dark" : "light");
}

// Table cell + header styles.
//
// `tabular-nums` matters more than it looks: these are columns of currency and
// counts meant to be scanned down the column, and proportional digits make
// figures of the same magnitude fail to line up.
export function useTableSx() {
  const chrome = useChartChrome();
  return {
    chrome,
    cell: {
      fontSize: 11.5,
      fontVariantNumeric: "tabular-nums",
      whiteSpace: "nowrap",
    } as const,
    hdr: {
      fontSize: 9.5,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.06em",
      whiteSpace: "nowrap",
      color: chrome.headerText,
      bgcolor: chrome.headerBg,
    } as const,
  };
}
