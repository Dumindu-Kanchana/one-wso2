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
  employee: (employeeId: string) => `${peopleBackendUrl}/employees/${employeeId}`,
  employeePersonalInfo: (employeeId: string) =>
    `${peopleBackendUrl}/employees/${employeeId}/personal-info`,
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
