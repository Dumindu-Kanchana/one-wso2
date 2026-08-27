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


// The default Top 5% / 20% quota for a group, from its headcount.
//
// Ported line for line from `calculateDefaultQuotaValues` in
// views/adminPortal/components/AssignQuota.tsx, because the arithmetic is not
// obvious and every branch of it is load-bearing:
//
//   1. Start at 5% and 20% of headcount, rounded.
//   2. If BOTH round to zero and the group is not empty, the group gets ONE
//      slot recorded as `{5%: 1, 20%: 0}`. This is the shape §6.1 calls the
//      single flexible slot — one award usable as either rating, because the
//      group is too small to divide. It is not "one Top 5% and no Top 20%".
//   3. Otherwise each is floored at 1, so no non-empty group is left unable to
//      award anything.
//   4. Finally the 20% figure has the 5% figure SUBTRACTED from it, when that
//      leaves a non-negative result. So the stored 20% quota is the number of
//      Top 20% awards ON TOP of the Top 5% ones, not the total of the top 20%.
//
// Step 4 is the one to be careful with: it means the two numbers are not
// independent, and recomputing 20% from headcount alone would over-allocate.
//
// Two source behaviours worth naming:
//
//   - An EMPTY group also ends up at {5%: 1, 20%: 0}. The `> 0` guard is skipped,
//     both figures are then floored to 1, and the subtraction leaves 1 and 0.
//     Reproduced: an empty group has nobody to award to, so the figure is inert.
//   - A non-finite headcount returns {NaN, NaN} in the source, because neither
//     `=== 0` nor `< 1` is true of NaN. That one is NOT reproduced — a quota of
//     NaN would be stored and later compared against. It is the only deliberate
//     divergence here, and it can only fire on input the backend cannot send.

export interface ParQuotaDefaults {
  top5: number;
  top20: number;
}

export function defaultQuotaForHeadCount(totalHeadCount: number): ParQuotaDefaults {
  const head = Number.isFinite(totalHeadCount) && totalHeadCount > 0 ? totalHeadCount : 0;

  let top5 = Math.round(head * 0.05);
  let top20 = Math.round(head * 0.2);

  // A group too small for either percentage to reach one gets a single slot,
  // usable as either. See §6.1.
  if (top5 === 0 && top20 === 0 && head > 0) return { top5: 1, top20: 0 };

  if (top5 < 1) top5 = 1;
  if (top20 < 1) top20 = 1;

  // The 20% figure is what remains ABOVE the 5% awards, not the whole top fifth.
  if (top20 - top5 >= 0) top20 -= top5;

  return { top5, top20 };
}

/** Whether these figures are the single flexible slot. */
export function isFlexibleQuota(quota: ParQuotaDefaults): boolean {
  return quota.top5 === 1 && quota.top20 === 0;
}
