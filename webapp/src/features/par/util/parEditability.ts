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


// Whether the employee may still change their own PAR, and if not, why.
//
// Three separate things can lock it and they carry different messages, so this
// returns the REASON rather than a boolean. A screen that only knows "locked"
// has to invent an explanation, and the wrong one sends someone to ask their
// lead about a deadline that has not passed.
//
// Pure over `(now, cycle, rating)` and free of DOM, like the deadline
// predicates it builds on. The "is the answer actually filled in" part is
// deliberately NOT here: that needs to parse HTML, and mixing the two would
// make this untestable without a document.

import { canEmployeeEdit, canRequestThreeSixty, isCycleClosed } from "./parDeadlines";
import type { ParCycle, ParRating } from "../api/parTypes";

export type ParLockReason =
  /** No cycle is open, so there is nothing to edit. Not a fault. */
  | "noCycle"
  /** The cycle itself is over. Nothing in it can change. */
  | "cycleClosed"
  /** Already shared with the lead. Sharing is one-way. */
  | "alreadyShared"
  /** The employee deadline has passed without a share. */
  | "deadlinePassed";

/**
 * Why the employee's PAR is locked, or `null` when it is still editable.
 *
 * Order matters, and it is by what the reader most needs to hear:
 *
 *   1. No cycle at all comes first. Falling through to a deadline check here
 *      reports "the deadline passed" about a deadline that does not exist,
 *      which is how someone ends up querying a date nobody set.
 *   2. A closed cycle explains everything else, so it wins next.
 *   3. Having shared is the reader's own doing and the most useful thing to be
 *      told — more so than a deadline that has also since passed.
 *   4. A deadline that passed with nothing shared is the case worth naming
 *      plainly, because it is the one someone will want to query.
 */
export function myParLockReason(
  now: Date,
  cycle: ParCycle | undefined,
  rating: ParRating | undefined,
): ParLockReason | null {
  if (cycle === undefined) return "noCycle";
  if (isCycleClosed(cycle)) return "cycleClosed";
  const status = rating?.parEmployeeStatus;
  // SHARED_BLOCKED is also shared — it is what SHARED becomes once the lead
  // shares theirs. Treating only SHARED as shared would offer an edit box for a
  // PAR the backend will refuse to change.
  if (status === "SHARED" || status === "SHARED_BLOCKED") return "alreadyShared";
  if (!canEmployeeEdit(now, cycle)) return "deadlinePassed";
  return null;
}

/** Whether the answer field should accept input at all. */
export function canEditMyPar(
  now: Date,
  cycle: ParCycle | undefined,
  rating: ParRating | undefined,
): boolean {
  return myParLockReason(now, cycle, rating) === null;
}

/**
 * Whether nominating more 360 reviewers is still open.
 *
 * A separate deadline from the answer's, so having shared the PAR does not by
 * itself stop the employee asking for feedback — only its own deadline and a
 * closed cycle do.
 */
export function canNominateReviewers(now: Date, cycle: ParCycle | undefined): boolean {
  if (isCycleClosed(cycle)) return false;
  return canRequestThreeSixty(now, cycle);
}
