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


// Grouping the Top 5% / 20% allocation rows.
//
// The endpoint answers flat: one row per team, with the quota group's figures
// repeated on every row that belongs to it. So the shape the screen needs —
// a group, its quota, and the teams drawing from it — has to be rebuilt, and
// that rebuild is the sort of thing worth testing rather than eyeballing.

import type { ParSpecialRatingAllocation } from "../api/parTypes";

export interface ParQuotaGroup {
  quotaId: number;
  name: string;
  top5Quota: number;
  top20Quota: number;
  teams: ParSpecialRatingAllocation[];
}

/** "Engineering · Platform · Integration", skipping the blanks. */
export function allocationTeamLabel(row: ParSpecialRatingAllocation): string {
  return (
    [row.parBusinessUnit, row.parDepartment, row.parTeam, row.parSubTeam]
      .filter((part) => typeof part === "string" && part.trim() !== "")
      .join(" · ") || "—"
  );
}

/**
 * Rebuild the flat rows into quota groups, in the order first encountered.
 *
 * Insertion order rather than sorted by id: the backend returns them in an
 * order somebody chose, and re-sorting by a surrogate key discards that for a
 * sequence nobody asked for.
 */
export function groupAllocationsByQuota(
  rows: readonly ParSpecialRatingAllocation[] | undefined,
): ParQuotaGroup[] {
  if (!Array.isArray(rows)) return [];
  const groups = new Map<number, ParQuotaGroup>();
  for (const row of rows) {
    let group = groups.get(row.parQuotaId);
    if (!group) {
      group = {
        quotaId: row.parQuotaId,
        // A group with no name is identified by its number, which is at least
        // something a lead can refer to when asking about it.
        name: row.parSpecialQuotaName?.trim() || `Group ${row.parQuotaId}`,
        top5Quota: numberOr0(row.parTop5Quota),
        top20Quota: numberOr0(row.parTop20Quota),
        teams: [],
      };
      groups.set(row.parQuotaId, group);
    }
    group.teams.push(row);
  }
  return Array.from(groups.values());
}

/**
 * Whether this group is the single flexible slot.
 *
 * A Top 5% quota of 1 with a Top 20% quota of 0 is not "one Top 5% and no Top
 * 20%" — it is one slot usable as either, which is how the organisation handles
 * a group too small to divide. Reading it literally tells a lead they cannot
 * award a Top 20% when they can. See docs/ported-apps/par-app.md §6.1.
 */
export function isFlexibleSlot(group: Pick<ParQuotaGroup, "top5Quota" | "top20Quota">): boolean {
  return group.top5Quota === 1 && group.top20Quota === 0;
}

/** Case-insensitive match over a row's business unit, department and team. */
export function matchesAllocationSearch(
  row: ParSpecialRatingAllocation,
  query: string,
): boolean {
  const term = query.trim().toLowerCase();
  if (term === "") return true;
  return allocationTeamLabel(row).toLowerCase().includes(term);
}

function numberOr0(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
