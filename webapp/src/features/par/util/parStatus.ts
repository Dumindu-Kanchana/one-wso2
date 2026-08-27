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


// Labels and chip colours for PAR's five status enums.
//
// The source had no such map: it ran every status through
// `capitalizeFirstLetter`, which renders SHARED_BLOCKED as "Shared_blocked",
// and drew the completed/pending states as an icon whose only label was a
// hover tooltip — invisible to a screen reader and to anyone on a touch
// screen. Both are fixed here; see docs/ported-apps/par-app.md §8.
//
// ---- why one map per status kind, not one shared map ---------------------
//
// The wire value "SHARED" appears in three enums and does NOT mean the same
// thing in all of them:
//
//   parEmployeeStatus: "SHARED"  → the employee shared their PAR with the lead
//   parLeadStatus:     "SHARED"  → the lead shared their feedback
//   reviewStatus:      "SHARED"  → a 360 review is COMPLETE
//
// The third is why `ParThreeSixtyReviewStatus.COMPLETED = "SHARED"` in the
// source. A single flat map would have to pick one label for the value and
// would print "Shared" against a finished 360 review, which is not the word
// for it. Separate maps make the collision impossible to reintroduce.

import type {
  ParCycleStatus,
  ParEmployeeStatus,
  ParF2fStatus,
  ParLeadStatus,
  ParSpecialRating,
  ParThreeSixtyReviewStatus,
} from "../api/parTypes";

/** Same vocabulary as the finance chips, so PAR's chips read like the rest. */
export type ParChipColor = "success" | "error" | "warning" | "info" | "default";

export interface ParStatusMeta {
  label: string;
  color: ParChipColor;
}

const NEUTRAL: ParStatusMeta = { label: "—", color: "default" };

/**
 * A status the backend adds later renders as itself in a neutral chip, rather
 * than crashing or vanishing.
 */
function lookup(map: Record<string, ParStatusMeta>, status: string | null | undefined): ParStatusMeta {
  if (typeof status !== "string" || status.trim() === "") return NEUTRAL;
  const key = status.trim();
  // `hasOwn`, not `in` and not a bare index-plus-`??`: both also match inherited
  // names like "toString" and "constructor", which resolve to a function off the
  // prototype instead of falling through to the neutral chip below.
  return Object.hasOwn(map, key) ? map[key] : { label: key, color: "default" };
}

// "Not started" rather than "Pending" for the two states someone has to act on:
// the person reading it is usually the one who has to act, and "pending" says
// nothing about who is waiting for whom.
const EMPLOYEE_STATUS: Record<string, ParStatusMeta> = {
  PENDING: { label: "Not started", color: "warning" },
  DRAFT: { label: "Draft", color: "info" },
  SHARED: { label: "Shared", color: "success" },
  // Not a state anyone picks — the source's admin dropdown lists it disabled.
  // It is set for you when your lead shares their feedback, which locks your
  // own PAR from further editing. The label has to carry that, or being unable
  // to edit an apparently-"Shared" PAR looks like a bug.
  SHARED_BLOCKED: { label: "Shared (locked)", color: "success" },
};

const LEAD_STATUS: Record<string, ParStatusMeta> = {
  PENDING: { label: "Not started", color: "warning" },
  DRAFT: { label: "Draft", color: "info" },
  SHARED: { label: "Shared", color: "success" },
};

const THREE_SIXTY_STATUS: Record<string, ParStatusMeta> = {
  PENDING: { label: "Pending", color: "warning" },
  DRAFT: { label: "Draft", color: "info" },
  // See the header: this wire value means completed here, nothing else.
  SHARED: { label: "Completed", color: "success" },
  // "Declined", not the source's "Rejected": a reviewer turning down a request
  // to give feedback has declined it. "Rejected" reads as a judgement on the
  // person being reviewed, which is not what happened.
  REJECTED: { label: "Declined", color: "error" },
};

const F2F_STATUS: Record<string, ParStatusMeta> = {
  PENDING: { label: "Not scheduled", color: "warning" },
  SCHEDULED: { label: "Scheduled", color: "info" },
  COMPLETED: { label: "Completed", color: "success" },
};

const CYCLE_STATUS: Record<string, ParStatusMeta> = {
  // Neutral, not amber: a cycle that hasn't opened is on schedule, not overdue.
  PENDING: { label: "Not started", color: "default" },
  // Amber, because this one IS waiting on someone: an admin has to allocate the
  // Top 5% / 20% quota before the cycle can open.
  PENDING_QUOTA: { label: "Awaiting quota", color: "warning" },
  OPEN: { label: "Open", color: "success" },
  CLOSED: { label: "Closed", color: "default" },
  FAILED: { label: "Failed", color: "error" },
};

const SPECIAL_RATING: Record<string, ParStatusMeta> = {
  TOP5P: { label: "Top 5%", color: "warning" },
  TOP20P: { label: "Top 20%", color: "warning" },
  // A dash, not "N/A" or "Not assigned": most people have no special rating, so
  // this is the common case and should be quiet.
  NOT_ASSIGNED: NEUTRAL,
};

export function parEmployeeStatusMeta(status: ParEmployeeStatus | string | null | undefined) {
  return lookup(EMPLOYEE_STATUS, status);
}

export function parLeadStatusMeta(status: ParLeadStatus | string | null | undefined) {
  return lookup(LEAD_STATUS, status);
}

/**
 * `deadlinePassed` suppresses a still-pending 360 review, which can no longer
 * be filled in — carried over from the source, which shows a dash for exactly
 * this case. Leaving it as "Pending" would imply someone can still act on it.
 */
export function parThreeSixtyStatusMeta(
  status: ParThreeSixtyReviewStatus | string | null | undefined,
  options?: { deadlinePassed?: boolean },
) {
  if (options?.deadlinePassed && status === "PENDING") return NEUTRAL;
  return lookup(THREE_SIXTY_STATUS, status);
}

export function parF2fStatusMeta(status: ParF2fStatus | string | null | undefined) {
  return lookup(F2F_STATUS, status);
}

export function parCycleStatusMeta(status: ParCycleStatus | string | null | undefined) {
  return lookup(CYCLE_STATUS, status);
}

export function parSpecialRatingMeta(rating: ParSpecialRating | string | null | undefined) {
  return lookup(SPECIAL_RATING, rating);
}
