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
  canAssignSpecialRating,
  canEmployeeEdit,
  canLeadEdit,
  canRecordF2f,
  canRequestThreeSixty,
  deadlineViews,
  isCycleClosed,
  isDeadlinePassed,
  isSpecialRatingDeadlinePassed,
} from "./parDeadlines";
import type { ParCycle, ParCycleStatus } from "../api/parTypes";

/** A cycle whose every deadline is the 14th, so one date moves all the gates. */
function cycle(over: Partial<ParCycle> = {}): ParCycle {
  return {
    parCycleId: 1,
    parCycleName: "2026 H1",
    parCycleStartDate: "2026-01-01",
    parCycleEndDate: "2026-06-30",
    parEvaluationStartDate: "2026-07-01",
    parEvaluationEndDate: "2026-07-31",
    parEmployeeDeadline: "2026-07-14",
    parThreeSixtyRatingDeadline: "2026-07-14",
    parLeadDeadline: "2026-07-14",
    parF2FDeadline: "2026-07-14",
    parSpecialRatingDeadline: "2026-07-14",
    parCycleStatus: "OPEN",
    ...over,
  };
}

/** Local-time instants around the 14th. */
const dayBefore = new Date(2026, 6, 13, 12, 0, 0);
const onTheDay = new Date(2026, 6, 14, 12, 0, 0);
const lastMoment = new Date(2026, 6, 14, 23, 59, 59, 999);
const justAfter = new Date(2026, 6, 15, 0, 0, 0, 1);

describe("isDeadlinePassed", () => {
  it("treats the deadline day as open all day", () => {
    expect(isDeadlinePassed(dayBefore, "2026-07-14")).toBe(false);
    expect(isDeadlinePassed(onTheDay, "2026-07-14")).toBe(false);
    expect(isDeadlinePassed(lastMoment, "2026-07-14")).toBe(false);
  });

  it("passes once the day is over", () => {
    expect(isDeadlinePassed(justAfter, "2026-07-14")).toBe(true);
  });

  it("never locks on a missing or unreadable deadline", () => {
    for (const bad of [null, undefined, "", "whenever", "14/07/2026"]) {
      expect(isDeadlinePassed(justAfter, bad), String(bad)).toBe(false);
    }
  });

  // new Date("2026-07-01") is UTC midnight and lands on 30 June west of
  // Greenwich; the components are parsed instead.
  it("uses the calendar day it was given, not a UTC-shifted one", () => {
    expect(isDeadlinePassed(new Date(2026, 6, 1, 12, 0, 0), "2026-07-01")).toBe(false);
    expect(isDeadlinePassed(new Date(2026, 5, 30, 23, 0, 0), "2026-07-01")).toBe(false);
  });
});

describe("each deadline gates its own action", () => {
  const only = (field: keyof ParCycle) => cycle({ [field]: "2026-07-10" } as Partial<ParCycle>);

  it("the employee deadline locks only the employee's own PAR", () => {
    const c = only("parEmployeeDeadline");
    expect(canEmployeeEdit(onTheDay, c)).toBe(false);
    expect(canLeadEdit(onTheDay, c)).toBe(true);
    expect(canRequestThreeSixty(onTheDay, c)).toBe(true);
    expect(canRecordF2f(onTheDay, c)).toBe(true);
  });

  it("the lead deadline locks only the lead review", () => {
    const c = only("parLeadDeadline");
    expect(canLeadEdit(onTheDay, c)).toBe(false);
    expect(canEmployeeEdit(onTheDay, c)).toBe(true);
    expect(canRecordF2f(onTheDay, c)).toBe(true);
  });

  it("the 360 deadline locks only 360 requests", () => {
    const c = only("parThreeSixtyRatingDeadline");
    expect(canRequestThreeSixty(onTheDay, c)).toBe(false);
    expect(canEmployeeEdit(onTheDay, c)).toBe(true);
    expect(canLeadEdit(onTheDay, c)).toBe(true);
  });

  it("the F2F deadline locks only the F2F record", () => {
    const c = only("parF2FDeadline");
    expect(canRecordF2f(onTheDay, c)).toBe(false);
    expect(canLeadEdit(onTheDay, c)).toBe(true);
  });
});

// The decision recorded in the spec §9.1: this date is communicated, not
// enforced. If someone later "fixes" this by adding a check, these fail.
describe("the special-rating deadline is informational", () => {
  it("does not stop a special rating being assigned after it passes", () => {
    const c = cycle({ parSpecialRatingDeadline: "2026-07-01" });
    expect(isSpecialRatingDeadlinePassed(onTheDay, c)).toBe(true);
    expect(canAssignSpecialRating(onTheDay, c)).toBe(true);
  });

  it("gates special ratings by the lead deadline instead", () => {
    const c = cycle({ parLeadDeadline: "2026-07-10" });
    expect(canAssignSpecialRating(onTheDay, c)).toBe(false);
  });
});

describe("a closed cycle overrides every deadline", () => {
  it("refuses all writes even when nothing has expired", () => {
    const c = cycle({ parCycleStatus: "CLOSED" });
    expect(isCycleClosed(c)).toBe(true);
    for (const can of [canEmployeeEdit, canLeadEdit, canRequestThreeSixty, canRecordF2f]) {
      expect(can(dayBefore, c), can.name).toBe(false);
    }
    expect(canAssignSpecialRating(dayBefore, c)).toBe(false);
  });

  it("also refuses in every non-open status", () => {
    for (const status of ["PENDING", "PENDING_QUOTA", "FAILED"] as ParCycleStatus[]) {
      const c = cycle({ parCycleStatus: status });
      // Only CLOSED short-circuits; the others are simply not yet open, which
      // the callers gate on separately. Documented so the difference is a
      // choice rather than an oversight.
      expect(isCycleClosed(c), status).toBe(false);
    }
  });

  it("refuses everything when there is no cycle at all", () => {
    expect(canEmployeeEdit(dayBefore, undefined)).toBe(false);
    expect(canLeadEdit(dayBefore, undefined)).toBe(false);
    expect(canRecordF2f(dayBefore, undefined)).toBe(false);
  });
});

describe("deadlineViews", () => {
  it("marks the special-rating date as not enforced, and the rest as enforced", () => {
    const views = deadlineViews(onTheDay, cycle());
    const special = views.find((v) => v.key === "specialRating");
    expect(special?.enforced).toBe(false);
    expect(views.filter((v) => v.enforced)).toHaveLength(4);
  });

  it("reports which have passed", () => {
    const views = deadlineViews(justAfter, cycle());
    expect(views.every((v) => v.passed)).toBe(true);
  });

  it("survives a cycle with no special-rating date", () => {
    const views = deadlineViews(onTheDay, cycle({ parSpecialRatingDeadline: undefined }));
    expect(views.find((v) => v.key === "specialRating")?.passed).toBe(false);
  });
});
