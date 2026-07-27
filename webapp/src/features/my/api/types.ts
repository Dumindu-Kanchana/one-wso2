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

// DTOs from the people-ops-suite people-app backend, copied verbatim so
// field names match the wire format. If people-app's contract changes,
// mirror the change here. Source of truth:
//   src/slices/authSlice/auth.ts       (UserInfoInterface)
//   src/slices/employeeSlice/employee.ts (Employee)
//   src/slices/employeeSlice/employeePersonalInfo.ts (EmployeePersonalInfo)
//   src/types/types.tsx                 (EmergencyContact)

export interface UserInfo {
  id: number;
  employeeId: string;
  firstName: string;
  lastName: string;
  workEmail: string;
  employeeThumbnail: string | null;
  designation: string | null;
  privileges: number[];
}

export type EmployeeStatus = string; // people-app has an enum; keep loose here

export interface Employee {
  employeeId: string;
  firstName: string;
  lastName: string;
  workEmail: string;
  employeeThumbnail: string | null;
  secondaryJobTitle: string | null;
  jobRole: string | null;
  epf: string;
  workLocation: string;
  startDate: string;
  managerEmail: string;
  managerName: string | null;
  additionalManagerEmails: string | null;
  gender: string | null;
  continuousServiceDate: string | null;
  jobBand: number | null;
  employeeStatus: EmployeeStatus;
  probationEndDate: string | null;
  agreementEndDate: string | null;
  resignationDate: string | null;
  finalDayInOffice: string | null;
  finalDayOfEmployment: string | null;
  resignationReason: string | null;
  employmentType: string;
  designation: string;
  company: string;
  office: string | null;
  businessUnit: string;
  team: string;
  subTeam: string | null;
  unit: string | null;
  subordinateCount: number;
  employmentTypeId: number;
  careerFunctionId: number;
  designationId: number;
  companyId: number;
  officeId: number | null;
  businessUnitId: number;
  teamId: number;
  subTeamId: number | null;
  unitId: number | null;
  house: string | null;
  houseId: number | null;
}

// Mirrors people-app's database:EmergencyContact — name/relationship/mobile
// are non-null in the Ballerina record; only telephone is nullable.
export interface EmergencyContact {
  name: string;
  relationship: string;
  telephone: string | null;
  mobile: string;
}

export interface EmployeePersonalInfo {
  id: number;
  nicOrPassport: string;
  firstName: string;
  lastName: string;
  fullName: string;
  title: string;
  dob: string;
  gender: string;
  personalEmail: string | null;
  personalPhone: string | null;
  residentNumber: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  stateOrProvince: string | null;
  postalCode: string | null;
  country: string | null;
  nationality: string;
  emergencyContacts: EmergencyContact[] | null;
}

// Banking app types. Mirrors digiops-hr/apps/banking backend types —
// AccountType + AccountStatus enums, and the subset of EmployeeBankAccount
// fields we render.

export type AccountType = "SALARY" | "REIMBURSEMENT" | "CONSULTANCY";
export type AccountStatus = "ACTIVE" | "INACTIVE" | "REQUESTED" | "REJECTED";

export interface BankAccount {
  accountId: number;
  employeeEmail: string;
  accountName: string;
  accountNumber: string;
  accountStatus: AccountStatus;
  accountType: AccountType;
  bankCode: string | null;
  bankSwiftCode: string | null;
  bankName: string | null;
  bankLocation: string | null;
  branchCode: string | null;
  branchName: string | null;
  effectiveFrom: string;
  createdOn: string | null;
}

export interface BankAccountsResponse {
  bankAccounts: BankAccount[];
  count: number;
}

// PAR (Performance Appraisal Review) app types. Subset of
// digiops-hr/apps/par-app backend modules/types/types.bal — only fields
// we render in the Connected apps' review row today.

export type ParCycleStatus =
  | "PENDING"
  | "PENDING_QUOTA"
  | "OPEN"
  | "CLOSED"
  | "FAILED";

export type ParEmployeeStatus = "PENDING" | "DRAFT" | "SHARED" | "SHARED_BLOCKED";
export type ParLeadStatus = "PENDING" | "DRAFT" | "SHARED";

export interface ParCycle {
  parCycleId: number;
  parCycleName: string;
  parCycleStartDate: string;
  parCycleEndDate: string;
  parEvaluationStartDate: string;
  parEvaluationEndDate: string;
  parEmployeeDeadline: string;
  parLeadDeadline: string;
  parCycleStatus: ParCycleStatus;
}

// ParRating carries many fields (self-eval content, lead comments, F2F
// status, 360 reviewers, etc.); we only pick the ones the row surfaces.
// Additional fields can be added on demand when a detail view lands.
export interface ParRating {
  parRatingId: number;
  parCycleId: number;
  parEmployeeEmail: string;
  parEmployeeStatus: ParEmployeeStatus;
  parLeadStatus: ParLeadStatus;
}

// Promotion-app /employee-info response. Mirrors digiops-hr/apps/promotion
// backend/types.bal EmployeeInfo (outer) + EmployeeInfoWithLead (inner).
// All string? fields default to "" server-side, so treat "" the same as
// null when rendering.
export interface PromotionEmployeeInfoWithLead {
  workEmail: string;
  startDate: string;
  jobBand: number | null;
  joinedJobRole: string | null;
  joinedBusinessUnit: string | null;
  joinedDepartment: string | null;
  joinedTeam: string | null;
  joinedLocation: string | null;
  lastPromotedDate: string | null;
  employeeThumbnail: string | null;
  reportingLead: string;
  reportingLeadThumbnail: string;
}

export interface PromotionEmployeeInfoResponse {
  employeeInfo: PromotionEmployeeInfoWithLead;
}

// Approved promotion request from GET /promotion/requests. Subset of the
// backend's FullPromotionRequest — only the fields we render in the
// history dialog. Recommendations, notification flags, and drafts are
// intentionally omitted.
export type PromotionType = "NORMAL" | "SPECIAL" | "TIME_BASED";

export interface PromotionHistoryEntry {
  id: number;
  employeeEmail: string;
  currentJobBand: number;
  currentJobRole: string;
  nextJobBand: number;
  promotionCycle: string;
  promotionStatement: string | null;
  businessUnit: string;
  department: string;
  team: string;
  subTeam: string | null;
  promotionType: PromotionType;
  status: string;
  createdOn: string;
  updatedOn: string;
}

export interface PromotionHistoryResponse {
  promotionRequests: PromotionHistoryEntry[];
}

// Body for PATCH /employees/{employeeId}/personal-info. Mirrors
// database:UpdateEmployeePersonalInfoPayload — every field is optional and
// nullable. Non-admin callers can only update the contact/address block and
// emergencyContacts (name/dob/gender/nationality etc. are 403 for self-edit).
export interface UpdatePersonalInfoPayload {
  personalEmail?: string | null;
  personalPhone?: string | null;
  residentNumber?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  stateOrProvince?: string | null;
  postalCode?: string | null;
  country?: string | null;
  // Backend replaces the whole array atomically — always send the full
  // desired end-state, not a diff.
  emergencyContacts?: EmergencyContact[];
}

// Vehicle DTOs. Mirrors people-ops-suite/apps/people-app/backend
// modules/database/types.bal Vehicle + Vehicles + AddVehiclePayload.

export type VehicleType = "CAR" | "MOTORCYCLE";
export type VehicleStatus = "ACTIVE" | "INACTIVE";

export interface Vehicle {
  vehicleId: number;
  owner: string;
  vehicleRegistrationNumber: string;
  vehicleType: VehicleType;
  vehicleStatus: VehicleStatus;
  createdBy: string;
  createdOn: string;
  updatedBy: string;
  updatedOn: string;
}

export interface VehiclesResponse {
  vehicles: Vehicle[];
  totalCount: number;
}

// Body for POST /employees/{email}/vehicles.
export interface NewVehiclePayload {
  vehicleRegistrationNumber: string;
  vehicleType: VehicleType;
}
