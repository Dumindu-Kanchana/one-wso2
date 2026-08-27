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


// Rolling several teams up into one set of totals.
//
// The backend computes per-team counts; the across-all-teams figure is the
// client's job, as it is in the source. Pure and tested, because it is
// arithmetic over data whose shape the caller does not control — a team with
// no members is a real case, and it is where the source divided by zero.

import type { ParTeam, ParTeamSummary } from "../api/parTypes";

export interface ParAllTeamsTotals {
  totalMembers: number;
  employeeParComplete: number;
  threeSixtyComplete: number;
  leadReviewComplete: number;
  f2fComplete: number;
}

const ZERO: ParAllTeamsTotals = {
  totalMembers: 0,
  employeeParComplete: 0,
  threeSixtyComplete: 0,
  leadReviewComplete: 0,
  f2fComplete: 0,
};

/**
 * Totals across every team a lead holds.
 *
 * Each count is read defensively: `summary` is a nested object from the wire,
 * and a team missing it should cost that team's contribution rather than the
 * whole figure.
 */
export function allTeamsTotals(teams: readonly ParTeam[] | undefined): ParAllTeamsTotals {
  if (!Array.isArray(teams) || teams.length === 0) return { ...ZERO };
  return teams.reduce<ParAllTeamsTotals>(
    (acc, team) => ({
      totalMembers: acc.totalMembers + count(team.numberOfTeamMembers),
      employeeParComplete: acc.employeeParComplete + summaryCount(team.summary, "employeeParCompletedCount"),
      threeSixtyComplete: acc.threeSixtyComplete + summaryCount(team.summary, "threeSixtyReviewCompletedCount"),
      leadReviewComplete: acc.leadReviewComplete + summaryCount(team.summary, "leadsReviewCompletedCount"),
      f2fComplete: acc.f2fComplete + summaryCount(team.summary, "f2fCompletedCount"),
    }),
    { ...ZERO },
  );
}

function count(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function summaryCount(summary: ParTeamSummary | undefined, key: keyof ParTeamSummary): number {
  return count(summary?.[key]);
}

/**
 * Completion as a percentage, for a progress bar.
 *
 * Returns 0 rather than NaN when there is nothing to complete. The source
 * computed `(completed * 100) / total` directly, so a team with no members
 * produced NaN and handed it to the progress bar.
 */
export function completionPercent(completed: number, total: number): number {
  const c = count(completed);
  const t = count(total);
  if (t <= 0) return 0;
  // Clamped: a backend count higher than the total would otherwise overflow
  // the bar rather than reading as complete.
  return Math.min(100, Math.max(0, (c * 100) / t));
}
