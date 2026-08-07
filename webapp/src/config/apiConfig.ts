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
