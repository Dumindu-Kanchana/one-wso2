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


// Who an employee may nominate for 360 feedback on their own PAR.
//
// The source got both exclusions wrong. Its nomination dialog skipped the LEAD
// when you were nominating for your own PAR, and skipped the REVIEWEE when a
// lead was nominating for someone else's — so on your own PAR you could
// nominate yourself, and a lead could nominate the reviewee's own lead. Both are
// excluded here; see docs/ported-apps/par-app.md.
//
// Reviewing your own PAR is the one that matters: it is feedback you write about
// yourself, presented to your lead as a colleague's view.

/** Why a candidate cannot be nominated, or `null` when they can. */
export type ReviewerProblem =
  | "empty"
  | "invalid"
  | "self"
  | "lead"
  | "duplicate";

export const REVIEWER_PROBLEM_TEXT: Record<ReviewerProblem, string> = {
  empty: "Enter an email address.",
  invalid: "That doesn't look like an email address.",
  self: "You can't ask yourself for feedback.",
  lead: "Your lead reviews your PAR separately.",
  duplicate: "You've already asked this person.",
};

/**
 * Comparison form for an email address.
 *
 * Addresses arrive from three places — what someone typed, what the employee
 * directory returned, and what the backend already stored — and they will not
 * agree on case or padding. Comparing raw strings lets the same person be
 * nominated twice.
 */
export function normalizeEmail(raw: string | null | undefined): string {
  return typeof raw === "string" ? raw.trim().toLowerCase() : "";
}

// Deliberately permissive: the authority on whether an address exists is the
// employee directory, not a regular expression. This only rejects what is
// obviously not an address, so a real one is never refused by a clever pattern.
const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function reviewerProblem(
  candidate: string | null | undefined,
  context: {
    selfEmail: string | null | undefined;
    leadEmail: string | null | undefined;
    /** Already nominated, in any case or padding. */
    existing: readonly string[];
  },
): ReviewerProblem | null {
  const email = normalizeEmail(candidate);
  if (email === "") return "empty";
  if (!LOOKS_LIKE_EMAIL.test(email)) return "invalid";
  if (email === normalizeEmail(context.selfEmail)) return "self";
  if (email === normalizeEmail(context.leadEmail)) return "lead";
  if (context.existing.some((e) => normalizeEmail(e) === email)) return "duplicate";
  return null;
}

/** The addresses from a nomination list that may actually be sent. */
export function acceptableReviewers(
  candidates: readonly string[],
  context: {
    selfEmail: string | null | undefined;
    leadEmail: string | null | undefined;
    existing: readonly string[];
  },
): string[] {
  const accepted: string[] = [];
  for (const candidate of candidates) {
    // Each accepted address joins `existing`, so two copies of the same new
    // address in one submission are caught as duplicates rather than both sent.
    if (reviewerProblem(candidate, { ...context, existing: [...context.existing, ...accepted] })) {
      continue;
    }
    accepted.push(normalizeEmail(candidate));
  }
  return accepted;
}
