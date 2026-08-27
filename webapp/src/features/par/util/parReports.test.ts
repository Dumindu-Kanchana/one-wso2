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
  filterReports,
  indirectReports,
  isIndirectReport,
  isReportALead,
  matchesReportSearch,
  parseTextBoolean,
} from "@features/par/util/parReports";
import type { ParReportEntry } from "@features/par/api/parTypes";

function entry(over: Partial<ParReportEntry> = {}): ParReportEntry {
  return {
    parRatingId: 1,
    parCycleId: 7,
    parEmployeeEmail: "ann@wso2.com",
    parEmployeeName: "Ann Perera",
    parEmployeeStatus: "SHARED",
    reportingType: "direct",
    isEmployeeALead: "False",
    ...over,
  } as ParReportEntry;
}

// The source lowercased before comparing in one place and tested `=== "True"`
// exactly in another, two hundred lines apart. With a backend answering "true"
// the filter worked and the lead badge silently never appeared.
describe("booleans carried as text", () => {
  it("reads every case the backend might send", () => {
    for (const raw of ["true", "True", "TRUE", " true "]) {
      expect(parseTextBoolean(raw), JSON.stringify(raw)).toBe(true);
    }
    for (const raw of ["false", "False", "FALSE", ""]) {
      expect(parseTextBoolean(raw), JSON.stringify(raw)).toBe(false);
    }
  });

  it("accepts a real boolean too, in case the field is ever fixed", () => {
    expect(parseTextBoolean(true)).toBe(true);
    expect(parseTextBoolean(false)).toBe(false);
  });

  it("treats absent and unrecognised as false", () => {
    for (const raw of [undefined, null, "yes", "1"]) {
      expect(parseTextBoolean(raw), JSON.stringify(raw)).toBe(false);
    }
  });

  it("gives one answer for whether a report is a lead", () => {
    expect(isReportALead(entry({ isEmployeeALead: "true" }))).toBe(true);
    expect(isReportALead(entry({ isEmployeeALead: "True" }))).toBe(true);
    expect(isReportALead(entry({ isEmployeeALead: undefined }))).toBe(false);
  });
});

describe("direct versus indirect", () => {
  it("recognises indirect in any case", () => {
    for (const raw of ["indirect", "Indirect", "INDIRECT", " indirect "]) {
      expect(isIndirectReport(entry({ reportingType: raw })), raw).toBe(true);
    }
  });

  it("counts anything unrecognised as direct rather than dropping it", () => {
    // Showing someone in the wrong list beats dropping them from both, which
    // is what a strict equality check does to an unexpected value.
    for (const raw of ["direct", "", undefined, "matrix"]) {
      expect(isIndirectReport(entry({ reportingType: raw })), JSON.stringify(raw)).toBe(false);
    }
  });

  it("picks out only the indirect rows", () => {
    const rows = [
      entry({ parEmployeeEmail: "a@wso2.com", reportingType: "direct" }),
      entry({ parEmployeeEmail: "b@wso2.com", reportingType: "Indirect" }),
      entry({ parEmployeeEmail: "c@wso2.com", reportingType: "indirect" }),
    ];
    expect(indirectReports(rows).map((r) => r.parEmployeeEmail)).toEqual([
      "b@wso2.com",
      "c@wso2.com",
    ]);
  });
});

describe("searching", () => {
  it("matches name and email, ignoring case and padding", () => {
    expect(matchesReportSearch(entry(), "perera")).toBe(true);
    expect(matchesReportSearch(entry(), "  ANN  ")).toBe(true);
    expect(matchesReportSearch(entry(), "ann@WSO2")).toBe(true);
  });

  it("matches everything on an empty query", () => {
    // A cleared box restores the list rather than emptying it.
    for (const q of ["", "   "]) expect(matchesReportSearch(entry(), q)).toBe(true);
  });

  it("does not match an unrelated term", () => {
    expect(matchesReportSearch(entry(), "zzz")).toBe(false);
  });

  it("survives a row with no name", () => {
    expect(matchesReportSearch(entry({ parEmployeeName: undefined }), "ann@")).toBe(true);
  });
});

describe("filtering a list", () => {
  const rows = [
    entry({ parEmployeeEmail: "ann@wso2.com", parEmployeeName: "Ann", isEmployeeALead: "true" }),
    entry({ parEmployeeEmail: "bob@wso2.com", parEmployeeName: "Bob", isEmployeeALead: "False" }),
  ];

  it("combines search with the leads-only switch", () => {
    expect(filterReports(rows, {}).length).toBe(2);
    expect(filterReports(rows, { leadsOnly: true }).map((r) => r.parEmployeeName)).toEqual(["Ann"]);
    expect(filterReports(rows, { query: "bob" }).map((r) => r.parEmployeeName)).toEqual(["Bob"]);
    expect(filterReports(rows, { query: "bob", leadsOnly: true })).toEqual([]);
  });
});
