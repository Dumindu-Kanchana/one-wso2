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


// The rules governing a lead's review of one report.
//
// Sharing a lead review is one-way and writes to somebody else's appraisal, so
// every condition that blocks it lives here as a pure function rather than
// inside a `disabled=` expression. The source kept them in two duplicated JSX
// conditions — one on each of the two share buttons — which is how they drift.
//
// Two of the rules are conditional on the RATING, and which rating triggers
// them is deployment configuration, not a constant:
//
//   - one rating value makes the Top 5% / 20% selector available at all
//   - a different one demands evidence before the review can be shared
//
// Both default to the source's defaults. Passed in rather than read from
// `window` here, so these stay testable without a global.

import type { ParEmployeeStatus, ParSpecialRating } from "../api/parTypes";

export interface ParRatingRules {
  /** The rating value that makes Top 5% / 20% assignable. */
  top5p20pRating: string;
  /** The rating value that demands evidence before sharing. */
  evidenceRating: string;
}

export const DEFAULT_PAR_RATING_RULES: ParRatingRules = {
  top5p20pRating: "Successful",
  evidenceRating: "Needs Improvement",
};

/** Everything about the lead's in-progress review that the rules depend on. */
export interface LeadReviewDraft {
  rating: string;
  specialRating: ParSpecialRating;
  /** The lead has confirmed at least two discussions were held. */
  evidenceConfirmed: boolean;
  /** How many supporting files are attached. */
  evidenceFileCount: number;
  /** The lead has confirmed the Top 5% / 20% decision with the functional lead. */
  top5p20pConfirmed: boolean;
}

export type LeadShareBlocker =
  /** The cycle is closed, or this review is already shared. */
  | "locked"
  /** The lead deadline has passed. */
  | "deadlinePassed"
  /** The employee has not shared their own PAR yet, so there is nothing to review. */
  | "employeeNotShared"
  /** The rating demands evidence, and it is incomplete. */
  | "evidenceIncomplete";

/** Whether this rating is the one that demands evidence before sharing. */
export function isEvidenceRating(rating: string, rules: ParRatingRules): boolean {
  return rating !== "" && rating === rules.evidenceRating;
}

/** Whether this rating is the one that makes Top 5% / 20% assignable. */
export function isSpecialRatingEligible(rating: string, rules: ParRatingRules): boolean {
  return rating !== "" && rating === rules.top5p20pRating;
}

/**
 * Whether the Top 5% / 20% selector should accept a choice.
 *
 * Two conditions, not one: the rating has to be the eligible one AND the lead
 * has to have confirmed the decision was finalised with the functional lead.
 * The confirmation is not paperwork — it is the only record that the
 * conversation happened.
 */
export function canPickSpecialRating(draft: LeadReviewDraft, rules: ParRatingRules): boolean {
  return isSpecialRatingEligible(draft.rating, rules) && draft.top5p20pConfirmed;
}

/**
 * Whether the evidence requirement is satisfied.
 *
 * Both halves are required — the confirmation AND at least one file. The
 * source's form-validation schema asked for the file only once the box was
 * ticked, which on its own would have let an unticked box through; the share
 * buttons carried the real check. Stating it once here removes the question.
 */
export function isEvidenceSatisfied(draft: LeadReviewDraft, rules: ParRatingRules): boolean {
  if (!isEvidenceRating(draft.rating, rules)) return true;
  return draft.evidenceConfirmed && draft.evidenceFileCount > 0;
}

/**
 * Why the lead cannot share this review, or `null` when they can.
 *
 * `adminAuditView` disables the deadline and employee-status checks. That is
 * deliberate and matches the source: an admin auditing a live cycle gets the
 * lead's screen with those guards off. Recorded as accepted in the spec's §9,
 * so it is not mistaken for an oversight here.
 *
 * Order is by what the reader most needs to hear, as with the employee's own
 * lock reasons: a locked review explains everything else, and being unable to
 * start because the employee has not shared is more useful than a deadline.
 */
export function leadShareBlocker(
  args: {
    locked: boolean;
    leadDeadlinePassed: boolean;
    employeeStatus: ParEmployeeStatus | undefined;
    adminAuditView?: boolean;
    draft: LeadReviewDraft;
  },
  rules: ParRatingRules,
): LeadShareBlocker | null {
  const { locked, leadDeadlinePassed, employeeStatus, adminAuditView = false, draft } = args;
  if (locked) return "locked";
  if (!adminAuditView && employeeStatus === "PENDING") return "employeeNotShared";
  if (!adminAuditView && leadDeadlinePassed) return "deadlinePassed";
  if (!isEvidenceSatisfied(draft, rules)) return "evidenceIncomplete";
  return null;
}

/**
 * The draft after the lead changes the rating.
 *
 * Changing away from a rating has to withdraw whatever that rating unlocked,
 * or the review is shared carrying a special rating the new rating does not
 * permit, or evidence for a concern no longer being raised. The source did
 * this inline in its change handler; as a function it can be tested, which
 * matters because it is silent when wrong — nothing on screen says a stale
 * special rating is still attached.
 */
export function draftAfterRatingChange(
  draft: LeadReviewDraft,
  nextRating: string,
  rules: ParRatingRules,
): LeadReviewDraft {
  const next: LeadReviewDraft = { ...draft, rating: nextRating };

  if (!isSpecialRatingEligible(nextRating, rules)) {
    next.specialRating = "NOT_ASSIGNED";
    next.top5p20pConfirmed = false;
  }
  if (!isEvidenceRating(nextRating, rules)) {
    next.evidenceConfirmed = false;
    next.evidenceFileCount = 0;
  }
  return next;
}

/**
 * The configured rating rules for this deployment.
 *
 * Kept out of the predicates above so they stay pure; this is the one place
 * that reads the globals. An unset key falls back to the source's default
 * rather than to an empty string, which would silently disable both rules.
 */
export function parRatingRules(): ParRatingRules {
  const configured = window.config;
  return {
    top5p20pRating:
      configured?.ONE_WSO2_PAR_TOP5P20P_RATING ?? DEFAULT_PAR_RATING_RULES.top5p20pRating,
    evidenceRating:
      configured?.ONE_WSO2_PAR_EVIDENCE_RATING ?? DEFAULT_PAR_RATING_RULES.evidenceRating,
  };
}
