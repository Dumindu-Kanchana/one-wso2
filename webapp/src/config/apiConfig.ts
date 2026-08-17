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

// Backend base URLs. Read at runtime from window.config (same pattern as
// authConfig). Empty string = not configured; the calling hook should treat
// that as "backend not available" and render an appropriate state instead
// of firing broken requests.

export const peopleBackendUrl: string =
  window.config?.ONE_WSO2_PEOPLE_BACKEND_URL ?? "";

// Convenience — mirrors the AppConfig.serviceUrls shape used by people-app's
// own webapp so the two apps hit the same endpoints the same way.
export const peopleServiceUrls = {
  userInfo: `${peopleBackendUrl}/user-info`,
  // encodeURIComponent on the id for parity with every sibling builder
  // below — no current employeeId contains a reserved character, but a
  // future one could (and useUpdatePersonalInfo PATCHes through here).
  employee: (employeeId: string) =>
    `${peopleBackendUrl}/employees/${encodeURIComponent(employeeId)}`,
  employeePersonalInfo: (employeeId: string) =>
    `${peopleBackendUrl}/employees/${encodeURIComponent(employeeId)}/personal-info`,
  // Vehicles endpoints — keyed on the caller's email (backend enforces
  // employeeEmail === userInfo.email in the JWT). encodeURIComponent so
  // the `@` in the email survives the URL.
  employeeVehicles: (employeeEmail: string) =>
    `${peopleBackendUrl}/employees/${encodeURIComponent(employeeEmail)}/vehicles`,
  employeeVehicle: (employeeEmail: string, vehicleId: number) =>
    `${peopleBackendUrl}/employees/${encodeURIComponent(employeeEmail)}/vehicles/${vehicleId}`,
  // Returns the employee's building-access QR as a PNG binary. Non-admin
  // callers can only fetch their own (backend enforces isSelf check).
  employeeQrCode: (employeeId: string) =>
    `${peopleBackendUrl}/employees/${encodeURIComponent(employeeId)}/qr-code`,
};

// Promotion app backend (digiops-hr/apps/promotion). Separate service from
// people-app, so its own base URL. Same Choreo Bearer-token → x-jwt-assertion
// gateway rewrite pattern applies.
export const promotionBackendUrl: string =
  window.config?.ONE_WSO2_PROMOTION_BACKEND_URL ?? "";

// Banking app backend. Same Choreo Bearer-token → x-jwt-assertion gateway
// rewrite; does NOT require x-user-timezone-offset (only par-app +
// promotion-app do).
export const bankingBackendUrl: string =
  window.config?.ONE_WSO2_BANKING_BACKEND_URL ?? "";

export const bankingServiceUrls = {
  // GET /employee/accounts?employeeWorkEmail=<email> — the caller's bank
  // accounts. Backend allows self-lookup for non-admin callers.
  employeeAccounts: (workEmail: string) =>
    `${bankingBackendUrl}/employee/accounts?employeeWorkEmail=${encodeURIComponent(workEmail)}`,
};

// PAR (Performance Appraisal Review) app backend. Same Choreo gateway
// rewrite pattern as promotion-app. Also uses x-user-timezone-offset via
// digiopsHeaders().
export const parBackendUrl: string =
  window.config?.ONE_WSO2_PAR_BACKEND_URL ?? "";

export const parServiceUrls = {
  // GET /par-cycles?email=<workEmail>&status=OPEN — returns ParCycle[] for
  // the caller's own active review cycles. Non-lead/non-admin callers can
  // only query their own email.
  parCycles: (workEmail: string, status: "OPEN" | "CLOSED" | "PENDING" = "OPEN") =>
    `${parBackendUrl}/par-cycles?email=${encodeURIComponent(workEmail)}&status=${status}`,
  // GET /par-cycles/{cycleId}/employees/{workEmail}/par-ratings — returns
  // the caller's ParRating record for that cycle (contains
  // parEmployeeStatus / parLeadStatus we use for the chip + copy).
  parRating: (parCycleId: number, workEmail: string) =>
    `${parBackendUrl}/par-cycles/${parCycleId}/employees/${encodeURIComponent(workEmail)}/par-ratings`,
};

// Leave app backend (people-ops-suite/apps/leave-app). Its own service
// with its own /user-info + privilege scheme (LEAD=879, not people-app's
// 993). Same Choreo Bearer → x-jwt-assertion gateway rewrite; no
// x-user-timezone-offset needed.
export const leaveBackendUrl: string =
  window.config?.ONE_WSO2_LEAVE_BACKEND_URL ?? "";

export const leaveServiceUrls = {
  userInfo: `${leaveBackendUrl}/user-info`,
  appConfigs: `${leaveBackendUrl}/app-configs`,
  leaves: `${leaveBackendUrl}/leaves`,
  leave: (id: number) => `${leaveBackendUrl}/leaves/${id}`,
  // action = "approve" | "reject" (sabbatical only)
  leaveAction: (id: number, action: "approve" | "reject") =>
    `${leaveBackendUrl}/leaves/${id}/${action}`,
  employees: `${leaveBackendUrl}/employees`,
  leaveEntitlement: (email: string) =>
    `${leaveBackendUrl}/employees/${encodeURIComponent(email)}/leave-entitlement`,
};

export function isLeaveBackendConfigured(): boolean {
  return Boolean(leaveBackendUrl);
}

// The leave-app frontend itself (not its backend) — for deep-linking into
// flows this webapp doesn't replicate. Empty string = not configured; the
// caller should hide the link rather than render a broken relative URL.
export const leaveWebAppUrl: string =
  window.config?.ONE_WSO2_LEAVE_WEB_APP_URL ?? "";

export function isLeaveWebAppConfigured(): boolean {
  return Boolean(leaveWebAppUrl);
}

export const leaveAppUrls = {
  applySabbatical: `${leaveWebAppUrl}/apply/sabbatical`,
  approveSabbatical: `${leaveWebAppUrl}/approve/sabbatical`,
};

// ---- digiops-finance backends ---------------------------------------------
//
// The three finance apps (opd-claims, cc-expenses, expense-claims) are
// separate Ballerina services, each with its own base URL, its own
// /user-info + role scheme, and the same Choreo Bearer → x-jwt-assertion
// gateway rewrite. Receipts are raw-binary endpoints (not multipart), so
// the receipt helpers post the file bytes directly. Empty string = not
// configured; the FinanceShell renders a "not connected" state.

// OPD (outpatient medical) claims — opd-claims/backend.
export const opdBackendUrl: string =
  window.config?.ONE_WSO2_OPD_BACKEND_URL ?? "";

export function isOpdBackendConfigured(): boolean {
  return Boolean(opdBackendUrl);
}

export const opdServiceUrls = {
  userInfo: `${opdBackendUrl}/user-info`,
  appData: `${opdBackendUrl}/app-data`,
  searchClaims: `${opdBackendUrl}/search-claims`,
  claims: `${opdBackendUrl}/claims`,
  claimDrafts: `${opdBackendUrl}/claim-drafts`,
  claimStatus: (claimId: string) =>
    `${opdBackendUrl}/claims/${encodeURIComponent(claimId)}/status`,
  claimTransactions: (claimId: string) =>
    `${opdBackendUrl}/claims/${encodeURIComponent(claimId)}/transactions`,
  employees: `${opdBackendUrl}/employees`,
  // Raw-binary receipt endpoints. Upload is keyed on the caller's email.
  receiptUpload: (email: string) =>
    `${opdBackendUrl}/claims/${encodeURIComponent(email)}/transactions/receipts/file`,
  receiptFile: (fileName: string) =>
    `${opdBackendUrl}/claims/transactions/receipts/file/${encodeURIComponent(fileName)}`,
};

// Corporate credit-card expenses — cc-expenses/backend.
export const ccBackendUrl: string =
  window.config?.ONE_WSO2_CC_EXPENSES_BACKEND_URL ?? "";

export function isCcBackendConfigured(): boolean {
  return Boolean(ccBackendUrl);
}

export const ccServiceUrls = {
  userInfo: `${ccBackendUrl}/user-info`,
  creditCards: `${ccBackendUrl}/credit-cards`,
  transactions: (query = "") => `${ccBackendUrl}/transactions${query}`,
  saveDraft: `${ccBackendUrl}/transactions/save-draft`,
  employeeSubmit: `${ccBackendUrl}/transactions/employee-submit`,
  saveEdit: `${ccBackendUrl}/transactions/save-edit`,
  leadApprove: `${ccBackendUrl}/transactions/lead-approve`,
  financeApprove: `${ccBackendUrl}/transactions/finance-approve`,
  processStatement: (bankCode: string, fileName: string) =>
    `${ccBackendUrl}/transactions/process-statement?bankCode=${encodeURIComponent(bankCode)}&statementFileName=${encodeURIComponent(fileName)}`,
  uploadTransactions: (bankCode: string, fileName: string) =>
    `${ccBackendUrl}/transactions?bankCode=${encodeURIComponent(bankCode)}&statementFileName=${encodeURIComponent(fileName)}`,
  expenseTypes: `${ccBackendUrl}/configurations/expense-types`,
  subRegions: `${ccBackendUrl}/configurations/sub-regions`,
  productAndBusinessUnits: `${ccBackendUrl}/configurations/product-and-business-units`,
  jobNumbers: `${ccBackendUrl}/travels/job-numbers`,
  // GET base64 attachment / DELETE it.
  attachment: (id: number, attachmentType: string) =>
    `${ccBackendUrl}/transactions/${id}/attachments?attachmentType=${encodeURIComponent(attachmentType)}`,
  // PUT raw file bytes — note the backend's (misspelled) `fileExtenstion` query param.
  attachmentUpload: (id: number, fileExtension: string, attachmentType: string) =>
    `${ccBackendUrl}/transactions/${id}/attachments?fileExtenstion=${encodeURIComponent(fileExtension)}&attachmentType=${encodeURIComponent(attachmentType)}`,
};

// Out-of-pocket expense claims — expense-claims/backend.
export const expenseBackendUrl: string =
  window.config?.ONE_WSO2_EXPENSE_CLAIMS_BACKEND_URL ?? "";

export function isExpenseBackendConfigured(): boolean {
  return Boolean(expenseBackendUrl);
}

export const expenseServiceUrls = {
  appData: `${expenseBackendUrl}/app-data`,
  searchClaims: `${expenseBackendUrl}/search-claims`,
  claims: `${expenseBackendUrl}/claims`,
  claimDrafts: `${expenseBackendUrl}/claim-drafts`,
  claimStatus: (claimId: string) =>
    `${expenseBackendUrl}/claims/${encodeURIComponent(claimId)}/status`,
  claimTransactions: (claimId: string) =>
    `${expenseBackendUrl}/claims/${encodeURIComponent(claimId)}/transactions`,
  employees: `${expenseBackendUrl}/employees`,
  expenseTypes: (travelJobNumber?: string) =>
    `${expenseBackendUrl}/user-configurations/expense-types${
      travelJobNumber ? `?travelJobNumber=${encodeURIComponent(travelJobNumber)}` : ""
    }`,
  exchangeRates: (baseCode: string, date: string) =>
    `${expenseBackendUrl}/currencies/${encodeURIComponent(baseCode)}/rates/${encodeURIComponent(date)}`,
  receiptUpload: (email: string) =>
    `${expenseBackendUrl}/claims/${encodeURIComponent(email)}/transactions/receipts/file`,
  receiptFile: (fileName: string) =>
    `${expenseBackendUrl}/claims/transactions/receipts/file/${encodeURIComponent(fileName)}`,
};

// ---- marketing-ops backend -------------------------------------------------
//
// The Marketing Ops backend (digiops-marketing/agents/marketing-ops) is a
// Python/FastAPI service — the first non-Ballerina backend this app talks to —
// and it stays exactly as it is: this perspective is a frontend migration only.
//
// Two things differ from every sibling above, both worth knowing before adding
// an endpoint:
//
//  1. Its routes are namespaced under `/api/*`, and the Choreo proxy PRESERVES
//     that prefix, so every URL here carries it. Verified 2026-08-17 against
//     staging: `/api/me` → 200, `/me` → 404.
//  2. It authenticates purely from the gateway's `x-jwt-assertion` header and
//     never inspects the Asgardeo token itself, so the standard authedGet /
//     authedPost helpers work unmodified — no per-backend header quirk like
//     par-app's `x-user-timezone-offset`.
//
// A router with no root route 404s on its own prefix (`/api/settings` and
// `/api/events` both do) — always name the sub-path.
//
// Empty string = not configured; MarketingOpsShell renders a "not connected"
// state rather than firing broken requests.
export const marketingOpsBackendUrl: string =
  window.config?.ONE_WSO2_MARKETINGOPS_BACKEND_URL ?? "";

export function isMarketingOpsBackendConfigured(): boolean {
  return Boolean(marketingOpsBackendUrl);
}

export const marketingOpsServiceUrls = {
  // GET /api/me — identity + the authorization decision. Authenticated but
  // NOT gated: an authenticated non-member still gets a 200 with
  // `authorized: false`, which is what lets the SPA render an honest
  // "you don't have access" state instead of a bare 403.
  me: `${marketingOpsBackendUrl}/api/me`,
  // ---- settings: the admin-maintained dropdown values the utilities run on ----
  //
  // Reads return the FULL lists (including disabled values, ids and sort order).
  // Consumers filter to enabled-only themselves; the admin panels need the rest.
  //
  // Writes are PUT with the COMPLETE `{ entries: [...] }` array — a replace, not
  // a patch. That's the backend's contract and it's the right one: these are
  // ordered lists where the order is meaningful, so there's no coherent partial
  // update. It also means a stale client can't silently drop a value another
  // admin just added — it overwrites with what it last read, which the panel's
  // review-before-save dialog makes visible.
  settingsUtm: `${marketingOpsBackendUrl}/api/settings/utm`,
  settingsAssetName: `${marketingOpsBackendUrl}/api/settings/asset-name`,
  settingsUtmParameter: (parameter: string) =>
    `${marketingOpsBackendUrl}/api/settings/utm/${encodeURIComponent(parameter)}`,
  settingsAssetNameField: (assetType: string, field: string) =>
    `${marketingOpsBackendUrl}/api/settings/asset-name/${encodeURIComponent(assetType)}/${encodeURIComponent(field)}`,
  // GET /api/access-map — admin-only. Which Asgardeo group each capability
  // requires, for THIS environment. Diagnostic only: never derive a gate from
  // it client-side, because the group names carry an environment suffix
  // (`-stg`) that differs per deployment. Gate on `/api/me`.capabilities.
  accessMap: `${marketingOpsBackendUrl}/api/access-map`,
  // ---- ad campaigns → analytics ---------------------------------------------
  //
  // Note these are POSTs even though they are READS. Each `/run` endpoint takes
  // a report config in the body and computes the answer live from Google Ads /
  // LinkedIn / Salesforce; nothing is persisted and nothing changes server-side.
  // They're POSTs only because the config is too large and structured to be a
  // query string. Consumers should therefore treat them as queries (useQuery
  // with a POST queryFn), not mutations — see useAdAnalytics.
  //
  // ⚠️ `/roi/run` and `/linkedin-roi/run` can answer **HTTP 200 with
  // `status: "failed"`** and the reason in `error_message`. A 200 is not
  // sufficient to conclude success.
  adAnalyticsRoiOptions: `${marketingOpsBackendUrl}/api/ad-campaigns/analytics/roi/options`,
  adAnalyticsRoiRun: `${marketingOpsBackendUrl}/api/ad-campaigns/analytics/roi/run`,
  adAnalyticsLinkedInRoiRun: `${marketingOpsBackendUrl}/api/ad-campaigns/analytics/linkedin-roi/run`,
  adAnalyticsDashboardRun: `${marketingOpsBackendUrl}/api/ad-campaigns/analytics/dashboard/run`,

  // Remaining operation roots — /api/crm-upload, /api/email-workbench,
  // /api/events, /api/audit — get their builders added by the phase that ports
  // them, so this object never lists a URL nothing calls.
};

// The Marketing Ops frontend itself (not its backend) — for deep-linking out to
// operations One WSO2 hasn't ported yet. Marketing Ops stays live throughout the
// migration, so an un-ported operation should send the user to the real thing
// rather than showing a dead end. Same precedent as leaveWebAppUrl above and
// the LeaveSabbaticalComingSoonPage that consumes it.
//
// Empty string = not configured; hide the link rather than render a broken URL.
export const marketingOpsWebAppUrl: string =
  window.config?.ONE_WSO2_MARKETINGOPS_WEB_APP_URL ?? "";

export function isMarketingOpsWebAppConfigured(): boolean {
  return Boolean(marketingOpsWebAppUrl);
}

export const promotionServiceUrls = {
  // GET /employee-info?employeeWorkEmail=<email> — returns the caller's
  // EmployeeInfoWithLead (startDate, jobBand, lastPromotedDate, reportingLead,
  // etc.). Non-lead callers can only query their own email.
  employeeInfo: (workEmail: string) =>
    `${promotionBackendUrl}/employee-info?employeeWorkEmail=${encodeURIComponent(workEmail)}`,
  // GET /promotion/requests?statusArray=APPROVED&employeeEmail=<email> —
  // approved promotion history for the given employee. Backend authorization
  // allows self-lookup for non-admins.
  promotionHistory: (workEmail: string) =>
    `${promotionBackendUrl}/promotion/requests?statusArray=APPROVED&employeeEmail=${encodeURIComponent(workEmail)}`,
};
