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
import { DASH, serviceLength } from "@features/my/api/derive";

describe("serviceLength", () => {
  const today = new Date(2026, 7, 24); // 24 Aug 2026

  it("stops counting on the employee's final day", () => {
    // The bug this pins: an intern who left in 2019 was reading as "8y 1m"
    // in 2026, because tenure was measured to today regardless of status.
    expect(serviceLength("2018-07-15", today, "2019-01-15")).toBe("6m");
    // And it stays fixed however long ago that was.
    expect(serviceLength("2018-07-15", new Date(2030, 0, 1), "2019-01-15")).toBe("6m");
  });

  it("measures a current employee to today", () => {
    expect(serviceLength("2018-07-15", today)).toBe("8y 1m");
    expect(serviceLength("2018-07-15", today, null)).toBe("8y 1m");
  });

  it("counts a month only once its day-of-month is reached", () => {
    expect(serviceLength("2020-01-20", new Date(2020, 1, 19))).toBe("< 1m");
    expect(serviceLength("2020-01-20", new Date(2020, 1, 20))).toBe("1m");
  });

  it("borrows a year when the month goes negative", () => {
    // Nov 2019 → Feb 2020 is three months, not "-9".
    expect(serviceLength("2019-11-10", new Date(2020, 1, 10))).toBe("3m");
  });

  it("ignores an unparseable final day rather than blanking the value", () => {
    // A live figure beats no figure when the end date is junk.
    expect(serviceLength("2018-07-15", today, "not-a-date")).toBe("8y 1m");
    expect(serviceLength("2018-07-15", today, "")).toBe("8y 1m");
  });

  it("reports a placeholder for a final day before the start", () => {
    expect(serviceLength("2024-01-01", today, "2020-01-01")).toBe(DASH);
  });

  it("omits a unit that would read as zero", () => {
    // "0y 8m" and "3y 0m" both look like formatting artifacts; neither zero
    // is information anyone needs.
    expect(serviceLength("2018-07-15", new Date(2019, 2, 15))).toBe("8m");
    expect(serviceLength("2018-07-15", new Date(2021, 6, 15))).toBe("3y");
    // Both units present still shows both.
    expect(serviceLength("2018-07-15", new Date(2021, 8, 15))).toBe("3y 2m");
  });

  it("reports a placeholder for a missing or malformed start", () => {
    expect(serviceLength(null, today)).toBe(DASH);
    expect(serviceLength("2018-13-01", today)).toBe(DASH);
  });

  it("reads the date half of an ISO datetime", () => {
    expect(serviceLength("2018-07-15T09:30:00Z", today, "2019-01-15T17:00:00Z")).toBe("6m");
  });
});
