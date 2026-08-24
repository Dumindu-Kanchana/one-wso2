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

// A report's resting filter state: the status it is for, plus whichever
// toggles it defaults on. "Clear all" returns here rather than to an empty
// object — an Active report with no status filter would not be an Active
// report.
//
// Extracted from the table component because the two reports now differ in a
// way that is easy to break silently: both offer "include marked leavers",
// but Active defaults it ON (people serving notice are still staff) and
// Resignations defaults it OFF (they have not left yet). Getting that
// backwards changes a headline count without any visible error.

import type { EmployeeStatus, Filters } from "../api/peopleOpsTypes";

export interface BaselineOptions {
  employeeStatus: EmployeeStatus;
  showExcludeFutureFilter: boolean;
  showIncludeMarkedLeaversFilter: boolean;
  defaultIncludeMarkedLeavers: boolean;
}

export function baselineFiltersFor({
  employeeStatus,
  showExcludeFutureFilter,
  showIncludeMarkedLeaversFilter,
  defaultIncludeMarkedLeavers,
}: BaselineOptions): Filters {
  const base: Filters = { employeeStatus };
  if (showExcludeFutureFilter) base.excludeFutureStartDate = true;
  // Set only when defaulting ON. Left absent otherwise, so an untouched
  // toggle doesn't count toward the "N filters active" badge.
  if (showIncludeMarkedLeaversFilter && defaultIncludeMarkedLeavers) {
    base.includeMarkedLeavers = true;
  }
  return base;
}
