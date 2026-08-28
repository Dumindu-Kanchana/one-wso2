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
import { cellText } from "@features/people-ops/reports/reportCells";
import {
  calculateServiceLength,
  formatReportDate,
  formatServiceLength,
} from "@features/people-ops/reports/reportFormat";
import { EMPLOYEE_COLUMNS, getAllKeys } from "@features/people-ops/reports/reportColumns";
import { EmployeeStatus, type Employee } from "@features/people-ops/api/peopleOpsTypes";

function employee(overrides: Partial<Employee> = {}): Employee {
  return {
    employeeId: "WSO2-1",
    firstName: "Ada",
    lastName: "Lovelace",
    workEmail: "ada@wso2.com",
    employeeThumbnail: null,
    secondaryJobTitle: null,
    jobRole: null,
    externalDesignation: null,
    epf: "E-100",
    workLocation: "Colombo",
    startDate: "2020-03-15",
    managerEmail: "lead@wso2.com",
    managerName: "Grace Hopper",
    additionalManagerEmails: null,
    gender: "Female",
    continuousServiceDate: null,
    jobBand: 7,
    employeeStatus: EmployeeStatus.Active,
    probationEndDate: null,
    agreementEndDate: null,
    resignationDate: null,
    finalDayInOffice: null,
    finalDayOfEmployment: null,
    resignationReason: null,
    employmentType: "Permanent",
    designation: "Senior Engineer",
    company: "WSO2 LLC",
    office: null,
    businessUnit: "Engineering",
    team: "Platform",
    subTeam: null,
    unit: null,
    subordinateCount: 0,
    employmentTypeId: 1,
    careerFunctionId: 2,
    designationId: 3,
    companyId: 4,
    officeId: null,
    businessUnitId: 5,
    teamId: 6,
    subTeamId: null,
    unitId: null,
    house: null,
    houseId: null,
    ...overrides,
  };
}

describe("cellText", () => {
  it("reads the aliased fields the column keys don't name directly", () => {
    // These six keys are wire contract names, not Employee field names —
    // a regression here silently blanks a column in the preview.
    const row = employee({
      epf: "E-777",
      workLocation: "Kandy",
      designation: "Staff Engineer",
      managerName: "Alan Turing",
      managerEmail: "alan@wso2.com",
      additionalManagerEmails: "extra@wso2.com",
    });
    expect(cellText(row, "epfNumber")).toBe("E-777");
    expect(cellText(row, "location")).toBe("Kandy");
    expect(cellText(row, "jobRole")).toBe("Staff Engineer");
    expect(cellText(row, "reportsTo")).toBe("Alan Turing");
    expect(cellText(row, "leadEmail")).toBe("alan@wso2.com");
    expect(cellText(row, "additionalManager")).toBe("extra@wso2.com");
  });

  it("renders a placeholder for null, undefined and blank values", () => {
    const row = employee({ managerName: null, subTeam: "   ", house: null });
    expect(cellText(row, "reportsTo")).toBe("—");
    expect(cellText(row, "subTeam")).toBe("—");
    expect(cellText(row, "house")).toBe("—");
  });

  it("formats date columns and leaves malformed dates as a placeholder", () => {
    expect(cellText(employee({ startDate: "2020-03-15" }), "startDate")).toBe("15 Mar 2020");
    // A datetime, not a plain date — the date half is what matters.
    expect(
      cellText(employee({ resignationDate: "2024-11-01T09:30:00Z" }), "resignationDate"),
    ).toBe("1 Nov 2024");
    expect(cellText(employee({ agreementEndDate: "not-a-date" }), "agreementEndDate")).toBe("—");
  });

  it("prefers continuous service date over start date for length of service", () => {
    const now = new Date(2026, 0, 1);
    // Someone who rejoined: the earlier continuous-service date is the one
    // that counts, so this must not report service from startDate alone.
    const rejoiner = employee({ startDate: "2024-01-01", continuousServiceDate: "2019-01-01" });
    expect(cellText(rejoiner, "lengthOfService", now)).toBe("7 years");
    const firstStint = employee({ startDate: "2024-01-01", continuousServiceDate: null });
    expect(cellText(firstStint, "lengthOfService", now)).toBe("2 years");
  });

  it("stops counting service on the employee's final day", () => {
    // The bug this pins: measuring to today kept a leaver's service growing
    // after they had gone, so the same finished employment reported a
    // different tenure every time the report was run.
    const leaver = employee({
      startDate: "2020-01-01",
      continuousServiceDate: null,
      finalDayOfEmployment: "2023-01-01",
      employeeStatus: EmployeeStatus.Left,
    });
    // Three years served, whether asked in 2026 or 2030.
    expect(cellText(leaver, "lengthOfService", new Date(2026, 0, 1))).toBe("3 years");
    expect(cellText(leaver, "lengthOfService", new Date(2030, 0, 1))).toBe("3 years");
  });

  it("still measures a current employee to today", () => {
    const active = employee({
      startDate: "2020-01-01",
      continuousServiceDate: null,
      finalDayOfEmployment: null,
    });
    expect(cellText(active, "lengthOfService", new Date(2026, 0, 1))).toBe("6 years");
  });

  it("counts a rehired leaver from their continuous service date", () => {
    // Both ends matter at once: original joining through to final day.
    const rehired = employee({
      startDate: "2022-01-01",
      continuousServiceDate: "2018-01-01",
      finalDayOfEmployment: "2024-01-01",
    });
    expect(cellText(rehired, "lengthOfService", new Date(2026, 0, 1))).toBe("6 years");
  });

  it("falls back to today when the final day is unusable", () => {
    // A malformed date must not poison the result — better a live figure
    // than a blank or a wrong one.
    const bad = employee({
      startDate: "2020-01-01",
      continuousServiceDate: null,
      finalDayOfEmployment: "not-a-date",
    });
    expect(cellText(bad, "lengthOfService", new Date(2026, 0, 1))).toBe("6 years");
  });

  it("reports a placeholder when the final day precedes the start", () => {
    // Bad data rather than a negative tenure.
    const impossible = employee({
      startDate: "2024-01-01",
      continuousServiceDate: null,
      finalDayOfEmployment: "2020-01-01",
    });
    expect(cellText(impossible, "lengthOfService", new Date(2026, 0, 1))).toBe("—");
  });

  it("covers every declared column key without throwing", () => {
    const row = employee();
    for (const key of getAllKeys(true)) {
      expect(typeof cellText(row, key)).toBe("string");
    }
  });
});

describe("formatReportDate", () => {
  it("parses as local time so the day never shifts backwards", () => {
    // Parsed as UTC midnight this renders as 31 Dec in any negative offset.
    expect(formatReportDate("2026-01-01")).toBe("1 Jan 2026");
  });

  it("rejects a date with trailing junk", () => {
    // An unanchored prefix match would read "2026-01-15invalid" as valid.
    expect(formatReportDate("2026-01-15invalid")).toBe("—");
    expect(formatReportDate("2026-01-15-extra")).toBe("—");
    // A genuine ISO datetime still parses.
    expect(formatReportDate("2026-01-15T09:30:00Z")).toBe("15 Jan 2026");
  });

  it("rejects dates that don't exist rather than rolling them forward", () => {
    expect(formatReportDate("2026-02-30")).toBe("—");
    expect(formatReportDate(null)).toBe("—");
    expect(formatReportDate("")).toBe("—");
  });
});

describe("calculateServiceLength", () => {
  const now = new Date(2026, 5, 15); // 15 Jun 2026

  it("counts a month only once its day-of-month is reached", () => {
    expect(calculateServiceLength("2026-05-16", now)).toEqual({ years: 0, months: 0 });
    expect(calculateServiceLength("2026-05-15", now)).toEqual({ years: 0, months: 1 });
  });

  it("splits whole months into years and months", () => {
    expect(calculateServiceLength("2023-04-15", now)).toEqual({ years: 3, months: 2 });
  });

  it("returns null for a future start date", () => {
    // A future joiner hasn't started accruing service; "0 months" would
    // wrongly imply they had.
    expect(calculateServiceLength("2027-01-01", now)).toBeNull();
    expect(calculateServiceLength(null, now)).toBeNull();
  });
});

describe("formatServiceLength", () => {
  it("pluralises each unit independently", () => {
    expect(formatServiceLength({ years: 1, months: 1 })).toBe("1 year 1 month");
    expect(formatServiceLength({ years: 2, months: 3 })).toBe("2 years 3 months");
    expect(formatServiceLength({ years: 1, months: 0 })).toBe("1 year");
    expect(formatServiceLength({ years: 0, months: 5 })).toBe("5 months");
  });

  it("describes a brand new joiner in words rather than as zero", () => {
    expect(formatServiceLength({ years: 0, months: 0 })).toBe("Less than 1 month");
    expect(formatServiceLength(null)).toBe("—");
  });
});

describe("reportColumns", () => {
  it("keeps the resignation columns out of the non-resignation report", () => {
    expect(getAllKeys(false)).toHaveLength(EMPLOYEE_COLUMNS.length);
    expect(getAllKeys(false)).not.toContain("resignationReason");
    expect(getAllKeys(true)).toContain("resignationReason");
  });

  it("has no duplicate keys — they address backend CSV columns", () => {
    const keys = getAllKeys(true);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
