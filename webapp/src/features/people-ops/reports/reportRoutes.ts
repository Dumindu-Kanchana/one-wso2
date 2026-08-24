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

// People Ops route paths, in one place. The report table links to employee
// detail and the detail page links back, so without this the same two strings
// would be spelled out in App.tsx, the perspective registry, and both pages —
// four chances for a typo that only shows up as a blank screen at runtime.

import { ChartNoAxesCombinedIcon, DatabaseIcon } from "@wso2/oxygen-ui-icons-react";

export const ACTIVE_EMPLOYEES_REPORT_PATH = "/people-ops/reports/active-employees";
export const RESIGNATIONS_REPORT_PATH = "/people-ops/reports/resignations";
export const ORG_STRUCTURE_PATH = "/people-ops/master-data/org-structure";

// Eyebrow chip descriptor shared by every report screen, mirroring
// FINANCE_EYEBROW. One definition so the report list and the employee detail
// page it links to can't end up labelled differently.
export const REPORTS_EYEBROW = {
  icon: ChartNoAxesCombinedIcon,
  label: "Reports",
} as const;

// Master Data screens sit under People Ops alongside the reports but are a
// different kind of thing — reference data you edit, not a list you export —
// so they carry their own eyebrow rather than being labelled "Reports".
export const MASTER_DATA_EYEBROW = {
  icon: DatabaseIcon,
  label: "Master data",
} as const;

export function employeeDetailPath(employeeId: string): string {
  return `/people-ops/employees/${encodeURIComponent(employeeId)}`;
}
