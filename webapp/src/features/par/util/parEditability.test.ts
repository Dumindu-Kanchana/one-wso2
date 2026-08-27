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
  canEditMyPar,
  canNominateReviewers,
  myParLockReason,
} from "@features/par/util/parEditability";
import type { ParCycle, ParRating } from "@features/par/api/parTypes";

function cycle(over: Partial<ParCycle> = {}): ParCycle {
  return {
    parCycleId: 1,
    parCycleName: "H1 2026",
    parCycleStatus: "OPEN",
    parEmployeeDeadline: "2026-06-30",
    parThreeSixtyRatingDeadline: "2026-07-07",
    parLeadDeadline: "2026-07-14",
    parSpecialRatingDeadline: "2026-07-21",
    parF2FDeadline: "2026-07-28",
    ...over,
  } as ParCycle;
}

function rating(over: Partial<ParRating> = {}): ParRating {
  return {
    parRatingId: 10,
    parCycleId: 1,
    parEmployeeEmail: "me@wso2.com",
    parEmployeeStatus: "DRAFT",
    parLeadStatus: "PENDING",
    parF2fStatus: "PENDING",
    ...over,
  } as ParRating;
}

const BEFORE = new Date("2026-06-01T09:00:00");
const AFTER = new Date("2026-07-01T09:00:00");

describe("while the cycle is open and the deadline is ahead", () => {
  it("is editable", () => {
    expect(myParLockReason(BEFORE, cycle(), rating())).toBeNull();
    expect(canEditMyPar(BEFORE, cycle(), rating())).toBe(true);
  });

  it("is editable before anything has been started", () => {
    expect(canEditMyPar(BEFORE, cycle(), rating({ parEmployeeStatus: "PENDING" }))).toBe(true);
  });
});

describe("what locks it", () => {
  it("names sharing, which is one-way", () => {
    expect(myParLockReason(BEFORE, cycle(), rating({ parEmployeeStatus: "SHARED" }))).toBe(
      "alreadyShared",
    );
  });

  it("treats SHARED_BLOCKED as shared too", () => {
    // It is what SHARED becomes once the lead shares theirs. Reading only
    // SHARED as shared would offer an edit box the backend then refuses.
    expect(myParLockReason(BEFORE, cycle(), rating({ parEmployeeStatus: "SHARED_BLOCKED" }))).toBe(
      "alreadyShared",
    );
  });

  it("names the deadline when it passed with nothing shared", () => {
    expect(myParLockReason(AFTER, cycle(), rating())).toBe("deadlinePassed");
  });

  it("names the closed cycle above everything else", () => {
    const closed = cycle({ parCycleStatus: "CLOSED" });
    expect(myParLockReason(AFTER, closed, rating({ parEmployeeStatus: "SHARED" }))).toBe(
      "cycleClosed",
    );
  });
});

// The order is not arbitrary: each reason sends the reader somewhere different,
// and the wrong one has them querying a deadline that has not passed.
describe("which reason wins", () => {
  it("prefers sharing over a deadline that has also passed", () => {
    expect(myParLockReason(AFTER, cycle(), rating({ parEmployeeStatus: "SHARED" }))).toBe(
      "alreadyShared",
    );
  });

  it("distinguishes no cycle from a deadline that passed", () => {
    // Between cycles there is nothing to edit — but calling that
    // "deadlinePassed" reports a date nobody set, and sends the reader to ask
    // about it. It is its own state.
    expect(myParLockReason(BEFORE, undefined, undefined)).toBe("noCycle");
    expect(canEditMyPar(BEFORE, undefined, undefined)).toBe(false);
  });
});

describe("nominating reviewers", () => {
  it("runs to its own deadline, not the employee's", () => {
    // The 360 deadline is a week later here, so the employee can still ask for
    // feedback after their own answer has locked.
    expect(canEditMyPar(AFTER, cycle(), rating())).toBe(false);
    expect(canNominateReviewers(AFTER, cycle())).toBe(true);
  });

  it("is not stopped by having shared the PAR", () => {
    expect(canNominateReviewers(BEFORE, cycle())).toBe(true);
  });

  it("stops once its own deadline passes", () => {
    expect(canNominateReviewers(new Date("2026-07-08T09:00:00"), cycle())).toBe(false);
  });

  it("stops when the cycle closes", () => {
    expect(canNominateReviewers(BEFORE, cycle({ parCycleStatus: "CLOSED" }))).toBe(false);
  });
});
