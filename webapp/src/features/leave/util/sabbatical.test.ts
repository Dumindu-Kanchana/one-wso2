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
  eligibilityGapDays,
  eligibilityYears,
  exceedsMaxDuration,
  isEligible,
  maxDurationWeeks,
  requestedDurationDays,
} from "./sabbatical";

const d = (iso: string) => new Date(`${iso}T00:00:00`);

// The config carries days; every message speaks in years and weeks.
describe("turning the configured days into the words the user sees", () => {
  it("reads 1095 days as 3 years", () => {
    expect(eligibilityYears(1095)).toBe(3);
  });

  it("reads 42 days as 6 weeks", () => {
    expect(maxDurationWeeks(42)).toBe(6);
  });

  it("keeps one decimal, as the source does", () => {
    // parseFloat((d / 365).toFixed(1)) — 1200/365 is 3.287..., shown as 3.3.
    expect(eligibilityYears(1200)).toBe(3.3);
    expect(eligibilityYears(730)).toBe(2);
  });

  it("does not round the weeks", () => {
    // A plain divide, so a value that is not a whole number of weeks shows as
    // a fraction rather than being tidied up.
    expect(maxDurationWeeks(45)).toBeCloseTo(6.428, 2);
  });
});

// The `- 1` is the source's (ApplyTab.tsx:168) and is reproduced deliberately.
// It makes the check a day stricter than a plain difference. Recorded in the
// spec's §9 as a question for the live tenant, not corrected here.
describe("the eligibility gap", () => {
  it("counts one fewer than the whole days between the dates", () => {
    expect(eligibilityGapDays(d("2026-01-01"), d("2026-01-11"))).toBe(9);
  });

  it("is negative when the start is before the anchor", () => {
    expect(eligibilityGapDays(d("2026-01-11"), d("2026-01-01"))).toBe(-11);
  });

  it("ignores the time of day on either end", () => {
    const anchor = new Date("2026-01-01T23:59:00");
    const start = new Date("2026-01-11T00:01:00");
    expect(eligibilityGapDays(anchor, start)).toBe(9);
  });
});

describe("eligibility at the boundary", () => {
  const anchor = d("2023-01-01");

  // The span 2023-01-01 → 2026-01-01 covers a leap year, so it is 1096 whole
  // days and the -1 brings the gap to exactly 1095. Computed, not guessed: my
  // first attempt at these dates was a day out.
  it("is not met the day before", () => {
    expect(isEligible(anchor, d("2025-12-31"), 1095)).toBe(false);
  });

  it("is met on the day the gap reaches the limit", () => {
    expect(isEligible(anchor, d("2026-01-01"), 1095)).toBe(true);
  });

  it("stays met after it", () => {
    expect(isEligible(anchor, d("2026-06-01"), 1095)).toBe(true);
  });
});

describe("the requested duration", () => {
  it("counts a single day as one", () => {
    expect(requestedDurationDays(d("2026-03-02"), d("2026-03-02"))).toBe(1);
  });

  it("includes both ends", () => {
    expect(requestedDurationDays(d("2026-03-02"), d("2026-03-04"))).toBe(3);
  });

  it("survives a daylight-saving boundary", () => {
    // Europe springs forward on 2026-03-29. A naive hour-based divide would
    // return 6.958 and floor to 6.
    expect(requestedDurationDays(d("2026-03-27"), d("2026-04-02"))).toBe(7);
  });
});

describe("the maximum duration", () => {
  it("allows exactly the limit", () => {
    // 42 days inclusive: 2026-03-02 through 2026-04-12.
    expect(exceedsMaxDuration(d("2026-03-02"), d("2026-04-12"), 42)).toBe(false);
  });

  it("refuses one day more", () => {
    expect(exceedsMaxDuration(d("2026-03-02"), d("2026-04-13"), 42)).toBe(true);
  });
});
