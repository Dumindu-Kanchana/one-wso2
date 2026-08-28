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

import { describe, expect, it } from "vitest";
import { baselineFiltersFor } from "@features/people-ops/reports/reportBaseline";
import { EmployeeStatus } from "@features/people-ops/api/peopleOpsTypes";

// The props each page actually passes, so these tests fail if a page and its
// report's meaning drift apart.
const ACTIVE = {
  employeeStatus: EmployeeStatus.Active,
  showExcludeFutureFilter: true,
  showIncludeMarkedLeaversFilter: true,
  defaultIncludeMarkedLeavers: true,
} as const;

const RESIGNATIONS = {
  employeeStatus: EmployeeStatus.Left,
  showExcludeFutureFilter: false,
  showIncludeMarkedLeaversFilter: true,
  defaultIncludeMarkedLeavers: false,
} as const;

describe("baselineFiltersFor", () => {
  it("counts people serving notice as active by default", () => {
    // Marked leaver = resigned but still employed. Excluding them would
    // undercount the headcount.
    expect(baselineFiltersFor(ACTIVE)).toEqual({
      employeeStatus: EmployeeStatus.Active,
      excludeFutureStartDate: true,
      includeMarkedLeavers: true,
    });
  });

  it("does not fold people serving notice into resignations by default", () => {
    // The same flag on this report widens "who has left" to include people
    // who have not left yet — offered, but never silently.
    const base = baselineFiltersFor(RESIGNATIONS);
    expect(base).toEqual({ employeeStatus: EmployeeStatus.Left });
    expect(base.includeMarkedLeavers).toBeUndefined();
  });

  it("omits a toggle that defaults off rather than setting it false", () => {
    // Absent, not `false`: the active-filter badge counts defined keys, so
    // an untouched toggle must not look like an applied filter.
    const base = baselineFiltersFor({
      ...RESIGNATIONS,
      defaultIncludeMarkedLeavers: false,
    });
    expect("includeMarkedLeavers" in base).toBe(false);
  });

  it("ignores a default for a toggle the report doesn't show", () => {
    // A report that hides the control must not carry its filter regardless.
    const base = baselineFiltersFor({
      ...RESIGNATIONS,
      showIncludeMarkedLeaversFilter: false,
      defaultIncludeMarkedLeavers: true,
    });
    expect(base.includeMarkedLeavers).toBeUndefined();
  });

  it("omits the future-joiner filter where it cannot apply", () => {
    // Everyone on the Resignations report started in the past.
    expect(baselineFiltersFor(RESIGNATIONS).excludeFutureStartDate).toBeUndefined();
  });
});
