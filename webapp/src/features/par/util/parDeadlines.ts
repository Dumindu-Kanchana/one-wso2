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
// What each PAR deadline actually locks.
//
// Pure functions of `(now, cycle)` — nothing here reads the clock, which is what
// makes seven deadlines across four roles testable at every boundary. The Menu
// app taught this: windows are data, predicates are functions, and exactly one
// hook owns the clock.
//
// The rules are NOT uniform, and one deadline locks nothing at all. See
// docs/ported-apps/par-app.md §4 for the table this file implements.

import type { ParCycle } from "../api/parTypes";

/**
 * A deadline is passed once the current local time is after the END of that
 * day — a deadline of the 14th means the 14th is still open, all day.
 *
 * Parsed by components rather than `new Date("YYYY-MM-DD")`, which is read as
 * UTC midnight and lands on the previous day in any negative offset.
 */
export function isDeadlinePassed(now: Date, deadline: string | null | undefined): boolean {
  const end = endOfDay(deadline);
  if (end === null) return false; // an absent deadline never locks anything
  return now.getTime() > end;
}

function endOfDay(iso: string | null | undefined): number | null {
  if (typeof iso !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59, 999);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

/**
 * A closed cycle refuses every rating write server-side, whatever the deadlines
 * say. Checked first everywhere below, so no caller can forget it.
 */
export function isCycleClosed(cycle: ParCycle | undefined): boolean {
  return cycle?.parCycleStatus === "CLOSED";
}

/** Whether the cycle is accepting activity at all. */
export function isCycleOpen(cycle: ParCycle | undefined): boolean {
  return cycle?.parCycleStatus === "OPEN";
}

/** An employee may write and share their own PAR. */
export function canEmployeeEdit(now: Date, cycle: ParCycle | undefined): boolean {
  if (!cycle || isCycleClosed(cycle)) return false;
  return !isDeadlinePassed(now, cycle.parEmployeeDeadline);
}

/** A lead may write and share their review. */
export function canLeadEdit(now: Date, cycle: ParCycle | undefined): boolean {
  if (!cycle || isCycleClosed(cycle)) return false;
  return !isDeadlinePassed(now, cycle.parLeadDeadline);
}

/** Anyone may request or give 360 feedback. */
export function canRequestThreeSixty(now: Date, cycle: ParCycle | undefined): boolean {
  if (!cycle || isCycleClosed(cycle)) return false;
  return !isDeadlinePassed(now, cycle.parThreeSixtyRatingDeadline);
}

/** The F2F completion may still be recorded. */
export function canRecordF2f(now: Date, cycle: ParCycle | undefined): boolean {
  if (!cycle || isCycleClosed(cycle)) return false;
  return !isDeadlinePassed(now, cycle.parF2FDeadline);
}

/**
 * Whether the special-rating deadline has passed — for DISPLAY ONLY.
 *
 * Deliberately not named `canAssignSpecialRating`, because it must never be used
 * to gate one. `parSpecialRatingDeadline` is a communicated date, not a lock:
 * the source enforces nothing and the port keeps it that way by decision. See
 * the spec §9.1 before adding a check here.
 */
export function isSpecialRatingDeadlinePassed(now: Date, cycle: ParCycle | undefined): boolean {
  if (!cycle) return false;
  return isDeadlinePassed(now, cycle.parSpecialRatingDeadline);
}

/**
 * Assigning Top 5%/20% is gated by the same rules as any other lead edit — and
 * explicitly NOT by parSpecialRatingDeadline. Its own function so the intent is
 * stated once, rather than each call site deciding.
 */
export function canAssignSpecialRating(now: Date, cycle: ParCycle | undefined): boolean {
  return canLeadEdit(now, cycle);
}

/** Every deadline in one shape, for the cycle-dates display. */
export interface ParDeadlineView {
  key: string;
  label: string;
  date: string | undefined;
  passed: boolean;
  /** False for the special-rating date, which is shown but enforces nothing. */
  enforced: boolean;
}

export function deadlineViews(now: Date, cycle: ParCycle | undefined): ParDeadlineView[] {
  const at = (key: string, label: string, date: string | undefined, enforced: boolean) => ({
    key,
    label,
    date,
    passed: isDeadlinePassed(now, date),
    enforced,
  });
  return [
    at("employee", "Your PAR", cycle?.parEmployeeDeadline, true),
    at("threeSixty", "360° feedback", cycle?.parThreeSixtyRatingDeadline, true),
    at("lead", "Lead's review", cycle?.parLeadDeadline, true),
    at("specialRating", "Top 5% / 20%", cycle?.parSpecialRatingDeadline, false),
    at("f2f", "Face-to-face", cycle?.parF2FDeadline, true),
  ];
}
