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

// Wire types for the people-app backend endpoints behind the People Ops
// reports. Mirrors people-app's own webapp slice types so the two apps
// speak the same shapes to the same service — if a field looks redundant
// here (`jobRole` vs `designation`, `epf` vs the `epfNumber` column key),
// it is because the backend sends it that way, not because we chose it.

export enum EmployeeStatus {
  Active = "Active",
  Left = "Left",
  MarkedLeaver = "Marked leaver",
}

// A row of POST /employees/search. Every nullable field here is genuinely
// nullable in the DB — the report renders "—" for each rather than hiding
// the column, so an empty cell reads as "not set" instead of "not loaded".
export interface Employee {
  employeeId: string;
  firstName: string;
  lastName: string;
  workEmail: string;
  employeeThumbnail: string | null;
  secondaryJobTitle: string | null;
  jobRole: string | null;
  externalDesignation: string | null;
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

export interface FilteredEmployeesResponse {
  employees: Employee[];
  totalCount: number;
}

// The filter set both the preview search and the CSV generator accept.
// Every key is optional; an omitted key means "don't filter on this".
//
// Two pairs are mutually exclusive by backend contract — set one or the
// other, never both:
//   employmentTypeId  ⟷ employmentTypeIds
//   employeeStatus    ⟷ employeeStatuses
// The filter drawer clears the sibling whenever it sets one of these.
export interface Filters {
  businessUnitId?: number;
  teamId?: number;
  subTeamId?: number;
  unitId?: number;
  careerFunctionId?: number;
  designationId?: number;
  companyId?: number;
  officeId?: number;
  employmentTypeId?: number;
  employmentTypeIds?: number[];
  managerEmail?: string;
  gender?: string;
  employeeStatus?: EmployeeStatus;
  employeeStatuses?: EmployeeStatus[];
  directReports?: boolean;
  // Drops people whose start date hasn't arrived yet (accepted offers who
  // haven't joined). Defaults ON for the Active Employees report.
  excludeFutureStartDate?: boolean;
  // "Marked leaver" is a distinct status from "Left": someone who has
  // resigned but is still employed through their notice period. The Active
  // report counts them as active by default, hence this defaults ON too.
  includeMarkedLeavers?: boolean;
}

export interface Pagination {
  limit?: number;
  offset?: number;
}

export interface Sort {
  sortField: string;
  sortOrder: "ASC" | "DESC";
}

export interface EmployeeSearchPayload {
  searchString?: string;
  filters: Filters;
  pagination: Pagination;
  sort: Sort;
  // Restricts results to the caller's own reports. The reports always send
  // false: they are org-wide by definition, and the backend only serves the
  // org-wide form to ADMIN callers.
  leadOnly?: boolean;
}

// Body of POST /reports/employees/generate. `columns` is the ordered list of
// canonical column keys (see reportColumns) — omitted entirely when empty so
// the backend falls back to its own default column set.
export interface EmployeeReportPayload {
  filters: Filters;
  columns?: string[];
}

// ---- org master data -------------------------------------------------------
//
// Dropdown sources for the filter drawer. Note the label field is NOT
// uniform across these: most use `name`, but careerFunction and designation
// name theirs after the entity. orgOptionLabel() below is the one place
// that knows this, so callers don't each re-derive it.

export interface BusinessUnit {
  id: number;
  name: string;
  head_email?: string;
  is_active?: boolean;
}

export interface Team {
  id: number;
  name: string;
  is_active?: boolean;
}

export interface SubTeam {
  id: number;
  name: string;
  is_active?: boolean;
}

export interface Unit {
  id: number;
  name: string;
  is_active?: boolean;
}

export interface CareerFunction {
  id: number;
  careerFunction: string;
}

export interface Designation {
  id: number;
  designation: string;
  jobBand: number | null;
}

export interface Company {
  id: number;
  name: string;
  prefix: string;
  location: string;
  allowedLocations: { location: string; probationPeriod: number | null }[];
}

export interface Office {
  id: number;
  name: string;
  location: string;
  workingLocations: string[];
}

export interface EmploymentType {
  id: number;
  name: string;
  isActive: boolean;
}

export interface Manager {
  employeeId: string;
  workEmail: string;
}

// Anything the filter drawer can offer as an `{id, label}` choice.
export interface OrgOption {
  id: number;
  label: string;
}

// The genders the backend recognises for the gender filter. Mirrors
// people-app's EmployeeGenders constant.
export const EMPLOYEE_GENDERS = ["Male", "Female", "Other"] as const;
