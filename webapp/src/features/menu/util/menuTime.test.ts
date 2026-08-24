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
  cafeteriaMoment,
  formatMenuDate,
  formatMinuteOfDay,
  normalizeSheetDate,
  parseCalendarDate,
} from "./menuTime";

describe("cafeteriaMoment", () => {
  it("shifts an instant onto the cafeteria's clock", () => {
    // 19:00Z is 00:30 IST the following day.
    expect(cafeteriaMoment(new Date("2026-08-24T19:00:00Z"))).toEqual({
      dateIso: "2026-08-25",
      minuteOfDay: 30,
    });
  });

  it("stays on the same IST day right up to midnight", () => {
    // 18:29Z is 23:59 IST on the same date.
    expect(cafeteriaMoment(new Date("2026-08-24T18:29:00Z"))).toEqual({
      dateIso: "2026-08-24",
      minuteOfDay: 23 * 60 + 59,
    });
  });

  it("does not depend on the host timezone", () => {
    // Same instant, two ways of writing it.
    expect(cafeteriaMoment(new Date("2026-08-24T06:30:00Z"))).toEqual(
      cafeteriaMoment(new Date(Date.UTC(2026, 7, 24, 6, 30))),
    );
  });
});

describe("normalizeSheetDate", () => {
  it("accepts the shapes a spreadsheet produces", () => {
    expect(normalizeSheetDate("2026/08/24")).toBe("2026-08-24");
    expect(normalizeSheetDate("2026-08-24")).toBe("2026-08-24");
    expect(normalizeSheetDate("2026-08-24T00:00:00Z")).toBe("2026-08-24");
    expect(normalizeSheetDate("  2026-08-24  ")).toBe("2026-08-24");
  });

  it("returns null for anything it cannot read as a date", () => {
    for (const bad of ["", "   ", "tomorrow", "24/08/2026", "2026-8-4", null, undefined]) {
      expect(normalizeSheetDate(bad)).toBeNull();
    }
  });
});

describe("parseCalendarDate", () => {
  // `new Date("2026-08-01")` is UTC midnight, which renders as 31 July in any
  // negative offset. The parts are split for exactly this reason.
  it("keeps the calendar day it was given", () => {
    const d = parseCalendarDate("2026-08-01");
    expect(d?.getDate()).toBe(1);
    expect(d?.getMonth()).toBe(7);
    expect(d?.getFullYear()).toBe(2026);
  });

  it("rejects a malformed date", () => {
    expect(parseCalendarDate("2026-08")).toBeNull();
    expect(parseCalendarDate("nonsense")).toBeNull();
  });
});

describe("formatMenuDate", () => {
  it("reads long", () => {
    expect(formatMenuDate("2026-08-24")).toBe("Monday, August 24, 2026");
    expect(formatMenuDate("2026/08/24")).toBe("Monday, August 24, 2026");
  });

  it("returns empty rather than 'Invalid Date'", () => {
    expect(formatMenuDate(null)).toBe("");
    expect(formatMenuDate("whenever")).toBe("");
  });
});

describe("formatMinuteOfDay", () => {
  it("formats a 12-hour clock", () => {
    expect(formatMinuteOfDay(0)).toBe("12:00 AM");
    expect(formatMinuteOfDay(720)).toBe("12:00 PM");
    expect(formatMinuteOfDay(975)).toBe("4:15 PM");
    expect(formatMinuteOfDay(1439)).toBe("11:59 PM");
  });
});
