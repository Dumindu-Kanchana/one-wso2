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
import {
  DEFAULT_FILTERS,
  DEFAULT_SORT,
  PAGE_SIZE,
  activeFilterCount,
  buildSearchPayload,
  clearDependentFilters,
  filterKeyOf,
  formatStartDate,
  hasAnyFilter,
  isSortableField,
  validateSearchInput,
} from "./teamSearch";

const base = { filters: DEFAULT_FILTERS, searchQuery: "", sort: DEFAULT_SORT, page: 1 };

describe("buildSearchPayload", () => {
  it("omits unset filters entirely rather than sending undefined", () => {
    const { filters } = buildSearchPayload(base);
    // hasOwn, not toBeUndefined — the latter passes for a key that IS present
    // with an undefined value, which is exactly what we must not send.
    for (const key of ["businessUnitId", "teamId", "managerEmail", "gender"]) {
      expect(Object.hasOwn(filters, key), `${key} should be absent`).toBe(false);
    }
  });

  it("sends set filters", () => {
    const { filters } = buildSearchPayload({
      ...base,
      filters: { ...DEFAULT_FILTERS, businessUnitId: 3, managerEmail: "lead@wso2.com" },
    });
    expect(filters.businessUnitId).toBe(3);
    expect(filters.managerEmail).toBe("lead@wso2.com");
  });

  // The named source regression: "off" was stored as absent, so the filter was
  // invisible to every state check while still changing the result.
  it("sends excludeFutureStartDate as false, never omitted", () => {
    const { filters } = buildSearchPayload({
      ...base,
      filters: { ...DEFAULT_FILTERS, excludeFutureStartDate: false },
    });
    expect(Object.hasOwn(filters, "excludeFutureStartDate")).toBe(true);
    expect(filters.excludeFutureStartDate).toBe(false);
  });

  it("always sends directReports as a boolean", () => {
    expect(buildSearchPayload(base).filters.directReports).toBe(false);
    expect(
      buildSearchPayload({ ...base, filters: { ...DEFAULT_FILTERS, directReports: true } }).filters
        .directReports,
    ).toBe(true);
  });

  it("scopes by leadOnly and never identifies the caller", () => {
    const payload = buildSearchPayload(base);
    expect(payload.leadOnly).toBe(true);
    // managerEmail is a FILTER, not the caller — it must be absent unless set.
    expect(Object.hasOwn(payload.filters, "managerEmail")).toBe(false);
    expect(JSON.stringify(payload)).not.toMatch(/@/);
  });

  it("turns pages into offsets", () => {
    expect(buildSearchPayload(base).pagination).toEqual({ limit: PAGE_SIZE, offset: 0 });
    expect(buildSearchPayload({ ...base, page: 3, pageSize: 25 }).pagination).toEqual({
      limit: 25,
      offset: 50,
    });
  });

  it("clamps nonsense pagination to what the server accepts", () => {
    expect(buildSearchPayload({ ...base, page: 0 }).pagination.offset).toBe(0);
    expect(buildSearchPayload({ ...base, page: -4 }).pagination.offset).toBe(0);
    expect(buildSearchPayload({ ...base, pageSize: 0 }).pagination.limit).toBe(1);
    expect(buildSearchPayload({ ...base, pageSize: 5000 }).pagination.limit).toBe(100);
  });

  it("omits a blank search and trims a real one", () => {
    expect(Object.hasOwn(buildSearchPayload(base), "searchString")).toBe(false);
    expect(Object.hasOwn(buildSearchPayload({ ...base, searchQuery: "   " }), "searchString")).toBe(
      false,
    );
    expect(buildSearchPayload({ ...base, searchQuery: "  jane  " }).searchString).toBe("jane");
  });

  // The single test that guarantees the source's 400 cannot come back.
  it("falls back to employeeId when the sort field is one the server rejects", () => {
    const payload = buildSearchPayload({
      ...base,
      sort: { sortField: "externalDesignation", sortOrder: "DESC" },
    });
    expect(payload.sort.sortField).toBe("employeeId");
    expect(payload.sort.sortOrder).toBe("DESC");
  });

  it("normalises a bogus sort order to ASC", () => {
    const payload = buildSearchPayload({
      ...base,
      sort: { sortField: "designation", sortOrder: "sideways" as "ASC" },
    });
    expect(payload.sort).toEqual({ sortField: "designation", sortOrder: "ASC" });
  });
});

describe("isSortableField", () => {
  it("accepts the server's allow-list", () => {
    for (const f of [
      "employeeId",
      "firstName",
      "lastName",
      "fullName",
      "workEmail",
      "startDate",
      "employeeStatus",
      "employmentType",
      "designation",
      "businessUnit",
      "team",
      "company",
    ]) {
      expect(isSortableField(f), f).toBe(true);
    }
  });

  it("rejects everything else, including the column the source app breaks on", () => {
    for (const f of ["externalDesignation", "office", "subTeam", "employeeid", "", "e.employee_id"]) {
      expect(isSortableField(f), f).toBe(false);
    }
  });
});

describe("filterKeyOf", () => {
  const args = { filters: DEFAULT_FILTERS, searchQuery: "", sort: DEFAULT_SORT, pageSize: PAGE_SIZE };

  it("is stable regardless of object key order", () => {
    const reordered = Object.fromEntries(
      Object.entries(DEFAULT_FILTERS).reverse(),
    ) as typeof DEFAULT_FILTERS;
    expect(filterKeyOf({ ...args, filters: reordered })).toBe(filterKeyOf(args));
  });

  it("ignores the order statuses were chosen in", () => {
    // Reordering the status chips must not throw the user back to page 1.
    const swapped = {
      ...DEFAULT_FILTERS,
      employeeStatuses: ["Marked leaver", "Active"] as typeof DEFAULT_FILTERS.employeeStatuses,
    };
    expect(filterKeyOf({ ...args, filters: swapped })).toBe(filterKeyOf(args));
  });

  it("changes for anything that should reset the page", () => {
    const key = filterKeyOf(args);
    expect(filterKeyOf({ ...args, filters: { ...DEFAULT_FILTERS, teamId: 2 } })).not.toBe(key);
    expect(filterKeyOf({ ...args, searchQuery: "jane" })).not.toBe(key);
    expect(filterKeyOf({ ...args, sort: { sortField: "designation", sortOrder: "ASC" } })).not.toBe(key);
    expect(filterKeyOf({ ...args, sort: { sortField: "employeeId", sortOrder: "DESC" } })).not.toBe(key);
    // Included on purpose: the source reset the page for filters but not for
    // page size, which is how it could ask for rows past the end.
    expect(filterKeyOf({ ...args, pageSize: 50 })).not.toBe(key);
  });

  it("ignores whitespace-only differences in the search", () => {
    expect(filterKeyOf({ ...args, searchQuery: "  " })).toBe(filterKeyOf(args));
  });
});

describe("activeFilterCount", () => {
  it("is zero for the default state", () => {
    expect(activeFilterCount(DEFAULT_FILTERS)).toBe(0);
  });

  it("counts a set filter", () => {
    expect(activeFilterCount({ ...DEFAULT_FILTERS, teamId: 4 })).toBe(1);
    expect(activeFilterCount({ ...DEFAULT_FILTERS, teamId: 4, gender: "Female" })).toBe(2);
  });

  it("counts the two switches", () => {
    expect(activeFilterCount({ ...DEFAULT_FILTERS, directReports: true })).toBe(1);
    // The source's invisible filter — it must be visible here.
    expect(activeFilterCount({ ...DEFAULT_FILTERS, excludeFutureStartDate: false })).toBe(1);
  });

  it("treats a changed status selection as one filter, order-insensitively", () => {
    expect(activeFilterCount({ ...DEFAULT_FILTERS, employeeStatuses: ["Marked leaver", "Active"] })).toBe(0);
    expect(activeFilterCount({ ...DEFAULT_FILTERS, employeeStatuses: ["Active"] })).toBe(1);
    expect(activeFilterCount({ ...DEFAULT_FILTERS, employeeStatuses: [] })).toBe(1);
  });
});

describe("hasAnyFilter", () => {
  it("accounts for the search as well as the filters", () => {
    expect(hasAnyFilter(DEFAULT_FILTERS, "")).toBe(false);
    expect(hasAnyFilter(DEFAULT_FILTERS, "  ")).toBe(false);
    expect(hasAnyFilter(DEFAULT_FILTERS, "jane")).toBe(true);
    expect(hasAnyFilter({ ...DEFAULT_FILTERS, unitId: 9 }, "")).toBe(true);
  });
});

describe("clearDependentFilters", () => {
  const filled = {
    ...DEFAULT_FILTERS,
    businessUnitId: 1,
    teamId: 2,
    subTeamId: 3,
    unitId: 4,
    careerFunctionId: 5,
    designationId: 6,
    companyId: 7,
    officeId: 8,
  };

  it("clears everything below a changed business unit", () => {
    const next = clearDependentFilters(filled, "businessUnitId", 9);
    expect(next).toMatchObject({ businessUnitId: 9, teamId: null, subTeamId: null, unitId: null });
    // Unrelated branches survive.
    expect(next.companyId).toBe(7);
    expect(next.designationId).toBe(6);
  });

  it("clears only the branch below each parent", () => {
    expect(clearDependentFilters(filled, "careerFunctionId", 9)).toMatchObject({ designationId: null, officeId: 8 });
    expect(clearDependentFilters(filled, "companyId", 9)).toMatchObject({ officeId: null, teamId: 2 });
    expect(clearDependentFilters(filled, "subTeamId", 9)).toMatchObject({ unitId: null, teamId: 2 });
  });

  it("re-picking the same value changes nothing", () => {
    expect(clearDependentFilters(filled, "businessUnitId", 1)).toBe(filled);
  });

  it("clearing a parent clears its children too", () => {
    expect(clearDependentFilters(filled, "businessUnitId", null)).toMatchObject({
      businessUnitId: null,
      teamId: null,
      unitId: null,
    });
  });
});

describe("validateSearchInput", () => {
  it("accepts what the server accepts", () => {
    for (const ok of ["", "jane", "o'brien", "jose+test@wso2.com", "José Müller", "EMP-123"]) {
      expect(validateSearchInput(ok), ok).toBeNull();
    }
  });

  it("rejects over-long input", () => {
    expect(validateSearchInput("a".repeat(101))).toBe("length");
    expect(validateSearchInput("a".repeat(100))).toBeNull();
  });

  it("rejects characters the server's pattern excludes", () => {
    expect(validateSearchInput("a<b")).toBe("format");
    expect(validateSearchInput("drop;table")).toBe("format");
  });
});

describe("formatStartDate", () => {
  it("formats a date without shifting the day", () => {
    expect(formatStartDate("2021-03-07")).toBe("7 Mar 2021");
    expect(formatStartDate("2021-03-07T00:00:00Z")).toBe("7 Mar 2021");
    // new Date("2021-01-01") is UTC midnight and renders as 31 Dec in any
    // negative offset. Parsing components avoids that.
    expect(formatStartDate("2021-01-01")).toBe("1 Jan 2021");
    expect(formatStartDate("2021-12-31")).toBe("31 Dec 2021");
  });

  it("returns a dash for anything unusable", () => {
    for (const bad of [null, undefined, "", "garbage", "07/03/2021", "2021-13-01"]) {
      expect(formatStartDate(bad as string | null), String(bad)).toBe("-");
    }
  });
});

describe("formatStartDate on impossible dates", () => {
  it("refuses a day the month does not have", () => {
    // Previously "31 Feb 2021": only the month index was validated.
    expect(formatStartDate("2021-02-31")).toBe("-");
    expect(formatStartDate("2021-04-31")).toBe("-");
  });

  it("refuses a zero day", () => {
    expect(formatStartDate("2021-02-00")).toBe("-");
  });

  it("refuses a month past December, as it already did", () => {
    expect(formatStartDate("2021-13-01")).toBe("-");
    expect(formatStartDate("2021-00-01")).toBe("-");
  });

  it("gets leap years right", () => {
    expect(formatStartDate("2024-02-29")).toBe("29 Feb 2024");
    expect(formatStartDate("2021-02-29")).toBe("-");
  });

  it("still formats real dates, including a trailing timestamp", () => {
    expect(formatStartDate("2021-03-07")).toBe("7 Mar 2021");
    expect(formatStartDate("2021-03-07T00:00:00Z")).toBe("7 Mar 2021");
  });
});

