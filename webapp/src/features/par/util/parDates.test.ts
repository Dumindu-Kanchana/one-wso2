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
import { formatParDate, formatParPeriod } from "@features/par/util/parDates";

describe("formatParDate", () => {
  it("formats a real date", () => {
    expect(formatParDate("2026-06-30")).toBe("30 Jun 2026");
    expect(formatParDate("2026-01-01")).toBe("1 Jan 2026");
  });

  it("ignores a trailing timestamp", () => {
    expect(formatParDate("2026-06-30T00:00:00Z")).toBe("30 Jun 2026");
  });

  it("does not shift the day in a negative offset", () => {
    // `new Date("2026-06-30")` is UTC midnight, which renders as 29 June west
    // of Greenwich. Parsing the parts avoids it.
    expect(formatParDate("2026-06-30")).toContain("30");
  });

  it("refuses dates that do not exist", () => {
    for (const bad of ["2026-02-31", "2026-04-31", "2026-02-00", "2026-13-01", "2026-00-05"]) {
      expect(formatParDate(bad), bad).toBe("—");
    }
  });

  it("gets leap years right", () => {
    expect(formatParDate("2024-02-29")).toBe("29 Feb 2024");
    expect(formatParDate("2026-02-29")).toBe("—");
    expect(formatParDate("1900-02-29")).toBe("—");
    expect(formatParDate("2000-02-29")).toBe("29 Feb 2000");
  });

  it("refuses nothing and nonsense", () => {
    for (const bad of [undefined, null, "", "   ", "yesterday", "30-06-2026"]) {
      expect(formatParDate(bad), JSON.stringify(bad)).toBe("—");
    }
  });
});

describe("formatParPeriod", () => {
  it("joins both ends", () => {
    expect(formatParPeriod("2026-01-01", "2026-06-30")).toBe("1 Jan 2026 – 30 Jun 2026");
  });

  it("says what it knows when only one end is usable", () => {
    // "— – —" reads as a rendering fault rather than missing data.
    expect(formatParPeriod("2026-01-01", undefined)).toBe("from 1 Jan 2026");
    expect(formatParPeriod(undefined, "2026-06-30")).toBe("to 30 Jun 2026");
  });

  it("collapses to a single dash when neither end is usable", () => {
    expect(formatParPeriod(undefined, null)).toBe("—");
    expect(formatParPeriod("2026-02-31", "nonsense")).toBe("—");
  });
});
