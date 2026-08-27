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
  defaultQuotaForHeadCount,
  isFlexibleQuota,
} from "@features/par/util/parQuotaDefaults";

// Ported from calculateDefaultQuotaValues. Every branch matters, and step 4 —
// subtracting the 5% figure from the 20% one — is the one that would silently
// over-allocate if recomputed independently.
describe("the default quota for a group", () => {
  it("gives a single flexible slot to a group too small for either percentage", () => {
    // round(h*0.05) and round(h*0.2) both zero: h of 1 and 2.
    for (const head of [1, 2]) {
      expect(defaultQuotaForHeadCount(head), `head ${head}`).toEqual({ top5: 1, top20: 0 });
      expect(isFlexibleQuota(defaultQuotaForHeadCount(head))).toBe(true);
    }
  });

  it("subtracts the 5% allowance from the 20% one", () => {
    // 100 heads: 5 and 20 -> 20 - 5 = 15 additional Top 20% awards.
    expect(defaultQuotaForHeadCount(100)).toEqual({ top5: 5, top20: 15 });
    // 40 heads: 2 and 8 -> 6.
    expect(defaultQuotaForHeadCount(40)).toEqual({ top5: 2, top20: 6 });
  });

  it("floors each at one for a group big enough to round above zero", () => {
    // 3 heads: round(0.15)=0 -> floored to 1; round(0.6)=1 -> floored stays 1;
    // then 1 - 1 = 0.
    expect(defaultQuotaForHeadCount(3)).toEqual({ top5: 1, top20: 0 });
    // 10 heads: round(0.5)=1 (floored from 1), round(2)=2 -> 2 - 1 = 1.
    expect(defaultQuotaForHeadCount(10)).toEqual({ top5: 1, top20: 1 });
  });

  it("gives even an EMPTY group the flexible slot, as the source does", () => {
    // Traced through the source: the `totalHeadCount > 0` guard is skipped, then
    // both figures are floored to 1, then 1 - 1 = 0. So an empty group ends up
    // with {1, 0} too. Surprising, and reproduced — an empty group has nobody to
    // award it to, so the figure is harmless, and changing it would diverge.
    expect(defaultQuotaForHeadCount(0)).toEqual({ top5: 1, top20: 0 });
  });

  it("does not produce NaN for a nonsense headcount, unlike the source", () => {
    // The source returns {NaN, NaN} here: round(NaN) is NaN, NaN === 0 is false
    // and NaN < 1 is false, so nothing corrects it. A DELIBERATE divergence —
    // headCount comes from the backend and cannot legitimately be NaN, and a
    // quota of NaN would be stored and then compared against.
    for (const bad of [-5, NaN, Infinity]) {
      const q = defaultQuotaForHeadCount(bad);
      expect(Number.isFinite(q.top5), String(bad)).toBe(true);
      expect(Number.isFinite(q.top20), String(bad)).toBe(true);
    }
  });

  it("never returns a negative 20% figure", () => {
    // The subtraction is guarded, so it cannot drop below zero.
    for (let head = 1; head <= 200; head++) {
      expect(defaultQuotaForHeadCount(head).top20, `head ${head}`).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("recognising the flexible slot", () => {
  it("is 1 and 0, and nothing else", () => {
    expect(isFlexibleQuota({ top5: 1, top20: 0 })).toBe(true);
    expect(isFlexibleQuota({ top5: 1, top20: 1 })).toBe(false);
    expect(isFlexibleQuota({ top5: 0, top20: 0 })).toBe(false);
  });
});
