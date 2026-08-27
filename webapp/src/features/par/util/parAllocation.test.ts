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
  allocationTeamLabel,
  groupAllocationsByQuota,
  isFlexibleSlot,
  matchesAllocationSearch,
} from "@features/par/util/parAllocation";
import type { ParSpecialRatingAllocation } from "@features/par/api/parTypes";

function row(over: Partial<ParSpecialRatingAllocation> = {}): ParSpecialRatingAllocation {
  return {
    parQuotaId: 1,
    parSpecialQuotaName: "Platform pool",
    parTop5Quota: 2,
    parTop20Quota: 4,
    parBusinessUnit: "Engineering",
    parDepartment: "Platform",
    parTeam: "Integration",
    ...over,
  } as ParSpecialRatingAllocation;
}

describe("grouping the flat rows", () => {
  it("collects teams under the quota group they draw from", () => {
    const groups = groupAllocationsByQuota([
      row({ parTeam: "Integration" }),
      row({ parTeam: "Registry" }),
      row({ parQuotaId: 2, parSpecialQuotaName: "Apps pool", parTeam: "Console" }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0].name).toBe("Platform pool");
    expect(groups[0].teams.map((t) => t.parTeam)).toEqual(["Integration", "Registry"]);
    expect(groups[1].name).toBe("Apps pool");
  });

  it("keeps the order the backend chose rather than sorting by id", () => {
    const groups = groupAllocationsByQuota([row({ parQuotaId: 9 }), row({ parQuotaId: 3 })]);
    expect(groups.map((g) => g.quotaId)).toEqual([9, 3]);
  });

  it("names an unnamed group by its number, so it can still be referred to", () => {
    const groups = groupAllocationsByQuota([row({ parQuotaId: 7, parSpecialQuotaName: "  " })]);
    expect(groups[0].name).toBe("Group 7");
  });

  it("reads the quota from the first row of each group", () => {
    const groups = groupAllocationsByQuota([row(), row({ parTeam: "Registry" })]);
    expect(groups[0].top5Quota).toBe(2);
    expect(groups[0].top20Quota).toBe(4);
  });

  it("treats a missing quota figure as zero rather than NaN", () => {
    const odd = { ...row(), parTop5Quota: null, parTop20Quota: undefined } as unknown as ParSpecialRatingAllocation;
    const groups = groupAllocationsByQuota([odd]);
    expect(groups[0].top5Quota).toBe(0);
    expect(groups[0].top20Quota).toBe(0);
  });

  it("is empty for nothing", () => {
    expect(groupAllocationsByQuota([])).toEqual([]);
    expect(groupAllocationsByQuota(undefined)).toEqual([]);
  });
});

// A group too small to divide gets one slot usable as either rating. Read
// literally it says "one Top 5%, no Top 20%", which tells a lead they cannot
// award something they can.
describe("the flexible slot", () => {
  it("recognises 1 and 0", () => {
    expect(isFlexibleSlot({ top5Quota: 1, top20Quota: 0 })).toBe(true);
  });

  it("is not any other shape", () => {
    for (const q of [
      { top5Quota: 1, top20Quota: 1 },
      { top5Quota: 0, top20Quota: 1 },
      { top5Quota: 2, top20Quota: 0 },
      { top5Quota: 0, top20Quota: 0 },
    ]) {
      expect(isFlexibleSlot(q), JSON.stringify(q)).toBe(false);
    }
  });
});

describe("labels and search", () => {
  it("joins the parts it has", () => {
    expect(allocationTeamLabel(row())).toBe("Engineering · Platform · Integration");
    expect(allocationTeamLabel(row({ parDepartment: "", parTeam: undefined }))).toBe("Engineering");
  });

  it("says something when it has nothing", () => {
    expect(
      allocationTeamLabel({ parQuotaId: 1, parTop5Quota: 0, parTop20Quota: 0 } as ParSpecialRatingAllocation),
    ).toBe("—");
  });

  it("matches any part of the label, ignoring case", () => {
    expect(matchesAllocationSearch(row(), "platform")).toBe(true);
    expect(matchesAllocationSearch(row(), "INTEGRATION")).toBe(true);
    expect(matchesAllocationSearch(row(), "zzz")).toBe(false);
  });

  it("matches everything on an empty query", () => {
    expect(matchesAllocationSearch(row(), "  ")).toBe(true);
  });
});
