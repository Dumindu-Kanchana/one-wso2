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

// DTOs + enums mirrored from digiops-finance/apps/opd-claims/backend.
// Field names match the wire format (types.bal / entity).

// ---- roles -----------------------------------------------------------------
// The OPD backend returns numeric role ids in UserInfo.userRoles.
export const OPD_ROLE = {
  CLAIM_SUBMITTER: 444, // can submit OPD claims (View.USER)
  FINANCE_APPROVER: 555, // finance review/approve (View.FINANCE)
} as const;

export type OpdClaimStatus = "PENDING" | "APPROVED" | "REJECTED" | "PENDING_OLD";

// ---- user / app data -------------------------------------------------------

export interface OpdUserInfo {
  firstName: string;
  lastName: string;
  workEmail: string;
  employeeThumbnail?: string | null;
  userRoles: number[];
}

export interface OpdClaimSummary {
  totalClaimedAmount: number;
  totalRemaining: number;
  totalClaimLimit: number;
}

export interface OpdAppData {
  claimSummary: OpdClaimSummary;
  lastYearClaimSummary: OpdClaimSummary | null;
  draft: OpdClaimDraft | null;
}

export interface OpdClaimDraft {
  transactions: OpdTransaction[];
}

// ---- claims ----------------------------------------------------------------

// One claim line item. The submit payload only needs date/amount/comment/
// receiptUrl; the backend fills the rest (currency LKR, type GENERAL).
export interface OpdTransaction {
  date: string; // YYYY-MM-DD
  amount: number;
  comment: string | null;
  receiptUrl?: string | null;
  currency?: string;
  expenseType?: string;
}

export interface OpdClaimStatusDetails {
  status?: OpdClaimStatus | null;
  financeApproverEmail: string | null;
  financeApprovedDate: string | null;
  financeRejectedDate: string | null;
  financeRejectedReason?: string | null;
}

export interface OpdClaim {
  id: string;
  transactions: OpdTransaction[];
  employeeEmail: string;
  statusDetails: OpdClaimStatusDetails;
  createdDate: string; // UTC datetime
  totalAmount: number;
}

export interface OpdClaimSearchPayload {
  ids?: string[] | null;
  email?: string | null;
  status?: OpdClaimStatus[] | null;
  startYear?: number | null;
  endYear?: number | null;
  limit?: number | null;
  offset?: number | null;
}

// POST /claims body.
export interface OpdClaimPayload {
  transactions: OpdTransaction[];
}

// POST /claims/{id}/status body.
export interface OpdStatusPayload {
  status: OpdClaimStatus;
  reason?: string;
}

export interface OpdEmployee {
  firstName: string;
  lastName: string;
  workEmail: string;
  employeeThumbnail: string | null;
}

// ---- helpers ---------------------------------------------------------------

/**
 * The status filter as the backend expects it — `filteredClaimsSlice.ts:82-89`.
 *
 * Asking for PENDING alone also asks for PENDING_OLD: claims filed before the
 * status was split carry the old value, and leaving it out hides them
 * completely. Any other selection is sent as-is, and an empty selection means
 * "no status filter" rather than "none of them".
 */
export function opdStatusFilter(statuses: OpdClaimStatus[]): OpdClaimStatus[] | undefined {
  if (statuses.length === 0) return undefined;
  if (statuses.length === 1 && statuses[0] === "PENDING") return ["PENDING", "PENDING_OLD"];
  return statuses;
}

/**
 * The statuses a person can filter by. PENDING_OLD is deliberately absent —
 * `FilterBox.tsx:82-84` hides it, because picking "Pending Finance" already
 * covers it through opdStatusFilter.
 */
export const OPD_FILTERABLE_STATUSES: OpdClaimStatus[] = ["PENDING", "APPROVED", "REJECTED"];

/** The period options on Claim History — `ClaimRangeDropdownValues`. */
export type OpdClaimRange = "This Year" | "Last Year" | "Custom";

export function opdHasRole(userInfo: OpdUserInfo | undefined, role: number): boolean {
  return Boolean(userInfo?.userRoles?.includes(role));
}
