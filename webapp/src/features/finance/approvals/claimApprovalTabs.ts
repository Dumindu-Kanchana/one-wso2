/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

// Claim approval: one Finance entry holding every claim waiting on the person
// looking at it, whichever app the claim came from.
//
// Approving is work you do for other people, so it does not belong under Me
// alongside the things you do for yourself. Submitting a claim and looking up
// what you submitted stay there; only the deciding moves.
//
// Credit card keeps its own Approve Submissions under Me for now.

/** Permissions, resolved by `useFinanceGate().canSee`. */
export type ClaimApprovalGateId =
  /** Any claim at all is approvable by this person. */
  | "claim-approval"
  /** Expense claims, at either stage — the two flags are independent. */
  | "claim-approval-expense"
  /** OPD claims. There is no lead stage: the backend's role 555 or nobody. */
  | "claim-approval-opd";

export interface ClaimApprovalTabDef {
  segment: string;
  label: string;
  gateId: ClaimApprovalGateId;
}

export const CLAIM_APPROVAL_PATH = "/finance/claim-approval";

export const CLAIM_APPROVAL_TABS: readonly ClaimApprovalTabDef[] = [
  // The default, and the question anyone opens this screen with. Grouped by
  // claim type rather than merged, so each group keeps the column that matters
  // to it and nothing is flattened to fit a shared shape.
  { segment: "needs-you", label: "Needs you", gateId: "claim-approval" },
  // The per-type views, for working through one kind in volume. Same screens as
  // before, with their own Pending / Approved / Rejected split and filters.
  { segment: "expense", label: "Expense claims", gateId: "claim-approval-expense" },
  { segment: "opd", label: "OPD claims", gateId: "claim-approval-opd" },
  // Named "Decided", not "Decided by you": the expense DTO records
  // `financeApproverEmail` but has no lead equivalent — only `leadApprovedDate`
  // and `leadRejectedDate` — so a lead's own decisions cannot be told apart
  // from their co-leads'. Claiming otherwise would be a promise the data does
  // not keep.
  { segment: "decided", label: "Decided", gateId: "claim-approval" },
] as const;

/**
 * The first tab this person may open, or undefined when they may open none.
 * Drives the index redirect and the empty case from one place.
 */
export function firstAllowedClaimTab(
  canSee: (id: string) => boolean,
): ClaimApprovalTabDef | undefined {
  return CLAIM_APPROVAL_TABS.find((t) => canSee(t.gateId));
}
