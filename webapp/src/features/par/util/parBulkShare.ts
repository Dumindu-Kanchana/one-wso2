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


// Sharing several lead reviews at once.
//
// There is no bulk endpoint: it is one PATCH per person, so PARTIAL SUCCESS is
// the normal outcome rather than an edge case — the fifth can fail on quota
// while the first four go through. Both the rule that gates the action and the
// summary of what happened live here, because "some of them worked" is the
// result a caller most easily gets wrong.

import type { ParLeadStatus } from "../api/parTypes";

export type BulkShareProblem =
  /** Nothing selected. */
  | "noneSelected"
  /** At least one selection is not a draft, so sharing it would mean nothing. */
  | "notAllDrafts";

export const BULK_SHARE_PROBLEM_TEXT: Record<BulkShareProblem, string> = {
  noneSelected: "Select the reviews you want to share.",
  notAllDrafts:
    "Every review you select has to be a draft. Deselect the ones already shared, or not yet written.",
};

/** The minimum a row needs for the rule to judge it. */
export interface BulkShareCandidate {
  parRatingId: number;
  parEmployeeEmail: string;
  parLeadStatus?: ParLeadStatus;
}

/**
 * Why a bulk share cannot go ahead, or `null` when it can.
 *
 * All-or-nothing on purpose, matching the source: a mixed selection is refused
 * rather than silently filtered to the shareable ones. Quietly skipping rows
 * would let a lead believe they had shared somebody they had not.
 */
export function bulkShareProblem(
  selected: readonly BulkShareCandidate[],
): BulkShareProblem | null {
  if (selected.length === 0) return "noneSelected";
  if (!selected.every((s) => s.parLeadStatus === "DRAFT")) return "notAllDrafts";
  return null;
}

export interface BulkShareOutcome {
  email: string;
  ok: boolean;
  /** Why it failed, when it did. */
  reason?: string;
}

export interface BulkShareSummary {
  succeeded: number;
  failed: number;
  /** Distinct failure reasons, in the order first seen. */
  reasons: string[];
  failedEmails: string[];
}

/**
 * Fold per-person outcomes into something worth telling the user.
 *
 * Reasons are de-duplicated: twelve rows failing the same quota produce one
 * sentence, not twelve. The emails are kept separately, because which people
 * failed is what the lead has to act on.
 */
export function summarizeBulkShare(
  outcomes: readonly BulkShareOutcome[],
): BulkShareSummary {
  const reasons: string[] = [];
  const failedEmails: string[] = [];
  let succeeded = 0;

  for (const outcome of outcomes) {
    if (outcome.ok) {
      succeeded += 1;
      continue;
    }
    failedEmails.push(outcome.email);
    const reason = outcome.reason?.trim();
    if (reason && !reasons.includes(reason)) reasons.push(reason);
  }

  return { succeeded, failed: failedEmails.length, reasons, failedEmails };
}

/**
 * The message and severity for a bulk-share result.
 *
 * Wording and severity are the standalone app's, from TeamSummary's three
 * branches. An earlier version here said "3 shared, 2 couldn't be" on a partial
 * result — which tells the reader more, since the source's wording mentions only
 * the failures and hides the work that succeeded. That is a real improvement and
 * it is deliberately NOT taken here: it is a visible difference from the app
 * people use, and belongs in its own proposal rather than inside a port.
 */
export function describeBulkShare(summary: BulkShareSummary): {
  message: string;
  severity: "success" | "warning" | "error";
} {
  const { succeeded, failed, reasons } = summary;
  const reason = reasons.join(" ");
  if (succeeded === 0) {
    return {
      message: `Failed to share ${failed} ratings. ${reason}`.trim(),
      severity: "error",
    };
  }
  if (failed !== 0) {
    return {
      message: `Failed to update ${failed} ratings. ${reason}`.trim(),
      severity: "warning",
    };
  }
  return { message: `Successfully updated ${succeeded} ratings`, severity: "success" };
}
