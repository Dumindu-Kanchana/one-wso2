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
import { parPdfFilename, parSummaryRows } from "@features/par/util/parPdf";
import type { ParCycle, ParRating } from "@features/par/api/parTypes";

// The document itself needs jsPDF, which is loaded on demand. What is testable
// without it is the data that goes into it — which is where the wrong label or
// a broken filename would come from.

const CYCLE = { parCycleId: 7, parCycleName: "H1 2026" } as ParCycle;

function rating(over: Partial<ParRating> = {}): ParRating {
  return {
    parRatingId: 42,
    parCycleId: 7,
    parEmployeeEmail: "ann.perera@wso2.com",
    parEmployeeName: "Ann Perera",
    parEmployeeStatus: "SHARED",
    parLeadStatus: "SHARED",
    parF2fStatus: "COMPLETED",
    parF2fDate: "2026-07-20",
    parRating: "Successful",
    ...over,
  } as ParRating;
}

function rowsFor(over: Partial<ParRating> = {}): Record<string, string> {
  return Object.fromEntries(
    parSummaryRows({ cycle: CYCLE, rating: rating(over), reviews: [] }),
  );
}

describe("the summary rows", () => {
  it("carry the appraisal's conclusions", () => {
    const rows = rowsFor();
    expect(rows.Employee).toBe("Ann Perera");
    expect(rows.Cycle).toBe("H1 2026");
    expect(rows.Rating).toBe("Successful");
    expect(rows.Conversation).toBe("Completed · 20 Jul 2026");
  });

  it("says an unrecorded rating in words, not as a wire value", () => {
    expect(rowsFor({ parRating: "NOT_ASSIGNED" }).Rating).toBe("Not recorded");
    expect(rowsFor({ parRating: undefined }).Rating).toBe("Not recorded");
  });

  it("spells out an absent special rating rather than printing a dash", () => {
    // In a table cell an em dash reads as missing data; here it is the common
    // case, and worth saying.
    expect(rowsFor()["Top 5% / 20%"]).toBe("Not assigned");
    expect(rowsFor({ parSpecialRating: "TOP5P" })["Top 5% / 20%"]).toBe("Top 5%");
  });

  it("omits the conversation date when there is none", () => {
    expect(rowsFor({ parF2fStatus: "PENDING", parF2fDate: undefined }).Conversation).toBe(
      "Not scheduled",
    );
  });

  it("falls back to the email when no name is recorded", () => {
    expect(rowsFor({ parEmployeeName: undefined }).Employee).toBe("ann.perera@wso2.com");
  });
});

describe("the filename", () => {
  it("names the person and the cycle", () => {
    expect(parPdfFilename(rating(), CYCLE)).toBe("ann.perera-H1-2026-par.pdf");
  });

  it("strips anything that would be read as a path", () => {
    // A stray slash in a cycle name would otherwise become a directory.
    const odd = { ...CYCLE, parCycleName: "H1/2026 (draft)" } as ParCycle;
    const name = parPdfFilename(rating(), odd);
    expect(name).not.toContain("/");
    expect(name).toBe("ann.perera-H1-2026-draft-par.pdf");
  });

  it("copes with an email that has no local part", () => {
    expect(parPdfFilename(rating({ parEmployeeEmail: "@wso2.com" }), CYCLE)).toBe(
      "employee-H1-2026-par.pdf",
    );
  });
});
