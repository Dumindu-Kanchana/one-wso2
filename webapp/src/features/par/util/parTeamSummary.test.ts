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
import { allTeamsTotals, completionPercent } from "@features/par/util/parTeamSummary";
import type { ParTeam } from "@features/par/api/parTypes";

function team(over: Partial<ParTeam> = {}): ParTeam {
  return {
    parTeamId: 1,
    parLeadEmail: "lead@wso2.com",
    parBusinessUnit: "Engineering",
    parDepartment: "Platform",
    parTeam: "Integration",
    parSubTeam: "Gateway",
    numberOfTeamMembers: 4,
    numberOf5pSlots: 1,
    numberOf20pSlots: 1,
    summary: {
      employeeParCompletedCount: 3,
      threeSixtyReviewCompletedCount: 2,
      leadsReviewCompletedCount: 1,
      f2fCompletedCount: 0,
    },
    ...over,
  } as ParTeam;
}

describe("allTeamsTotals", () => {
  it("adds every team's counts together", () => {
    const totals = allTeamsTotals([team(), team({ parTeamId: 2 })]);
    expect(totals).toEqual({
      totalMembers: 8,
      employeeParComplete: 6,
      threeSixtyComplete: 4,
      leadReviewComplete: 2,
      f2fComplete: 0,
    });
  });

  it("is all zeroes for no teams at all", () => {
    expect(allTeamsTotals([]).totalMembers).toBe(0);
    expect(allTeamsTotals(undefined).totalMembers).toBe(0);
  });

  it("costs only its own contribution when a team arrives malformed", () => {
    // `summary` is a nested object off the wire. A team missing it should not
    // take the whole figure down with it.
    const broken = { ...team({ parTeamId: 3 }), summary: undefined } as unknown as ParTeam;
    const totals = allTeamsTotals([team(), broken]);
    expect(totals.employeeParComplete).toBe(3);
    expect(totals.totalMembers).toBe(8);
  });

  it("ignores counts that are not finite numbers", () => {
    const odd = {
      ...team({ parTeamId: 4 }),
      numberOfTeamMembers: null,
      summary: { employeeParCompletedCount: "3" },
    } as unknown as ParTeam;
    const totals = allTeamsTotals([odd]);
    expect(totals.totalMembers).toBe(0);
    expect(totals.employeeParComplete).toBe(0);
  });

  it("does not mutate a shared zero between calls", () => {
    // The accumulator seed is spread, not shared — otherwise the first call's
    // totals leak into every later one.
    expect(allTeamsTotals([team()]).totalMembers).toBe(4);
    expect(allTeamsTotals([]).totalMembers).toBe(0);
    expect(allTeamsTotals([team()]).totalMembers).toBe(4);
  });
});

describe("completionPercent", () => {
  it("computes the obvious cases", () => {
    expect(completionPercent(0, 4)).toBe(0);
    expect(completionPercent(1, 4)).toBe(25);
    expect(completionPercent(4, 4)).toBe(100);
  });

  it("returns 0 rather than NaN when there is nothing to complete", () => {
    // The source computed (completed * 100) / total directly, so a team with no
    // members produced NaN and handed it to a progress bar.
    expect(completionPercent(0, 0)).toBe(0);
    expect(Number.isNaN(completionPercent(0, 0))).toBe(false);
  });

  it("clamps rather than overflowing the bar", () => {
    expect(completionPercent(5, 4)).toBe(100);
    expect(completionPercent(-1, 4)).toBe(0);
  });

  it("survives values that are not numbers", () => {
    expect(completionPercent(undefined as unknown as number, 4)).toBe(0);
    expect(completionPercent(2, undefined as unknown as number)).toBe(0);
  });
});
