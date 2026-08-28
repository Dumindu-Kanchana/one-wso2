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

/** A single exportable column of an employee report. */
export interface ColumnDef {
  /**
   * Canonical key sent to the backend in the report payload's `columns`.
   * These strings are a WIRE CONTRACT: they must match EMPLOYEE_CSV_COLUMNS /
   * RESIGNATION_CSV_COLUMNS in the people-app backend's utils.bal. A key the
   * backend doesn't recognise silently drops that column from the export, so
   * rename nothing here without changing the backend to match.
   *
   * Note they are not all field names on Employee — `epfNumber` reads `epf`,
   * `jobRole` reads `designation`, `location` reads `workLocation`, and
   * `lengthOfService` is derived rather than stored. EmployeeReportTable owns
   * that mapping for the preview; the backend owns it for the CSV.
   */
  key: string;
  /** Human-readable label, shown in the column selector and as the table header. */
  label: string;
  /** Display group — mirrors the People App Onboard page's section names. */
  group: string;
}

/** The 26 columns available on every employee report type. */
export const EMPLOYEE_COLUMNS: ColumnDef[] = [
  // Identity
  { key: "employeeId", label: "Employee Id", group: "Identity" },
  { key: "firstName", label: "First Name", group: "Identity" },
  { key: "lastName", label: "Last Name", group: "Identity" },
  { key: "gender", label: "Gender", group: "Identity" },
  { key: "workEmail", label: "Work Email", group: "Identity" },
  { key: "epfNumber", label: "EPF Number", group: "Identity" },
  // Job & Career
  { key: "company", label: "Company", group: "Job & Career" },
  { key: "location", label: "Location", group: "Job & Career" },
  { key: "employmentType", label: "Employment Type", group: "Job & Career" },
  { key: "jobRole", label: "Job Role", group: "Job & Career" },
  { key: "externalDesignation", label: "External Designation", group: "Job & Career" },
  { key: "jobBand", label: "Job Band", group: "Job & Career" },
  { key: "employeeStatus", label: "Employee Status", group: "Job & Career" },
  { key: "office", label: "Office", group: "Job & Career" },
  // Organisation
  { key: "businessUnit", label: "Business Unit", group: "Organisation" },
  { key: "team", label: "Team", group: "Organisation" },
  { key: "subTeam", label: "Sub Team", group: "Organisation" },
  { key: "unit", label: "Unit", group: "Organisation" },
  { key: "house", label: "House", group: "Organisation" },
  // Dates & Service
  { key: "startDate", label: "Start Date", group: "Dates & Service" },
  { key: "continuousServiceDate", label: "Continuous Service Date", group: "Dates & Service" },
  { key: "lengthOfService", label: "Length Of Service", group: "Dates & Service" },
  { key: "probationEndDate", label: "Probation End Date", group: "Dates & Service" },
  { key: "agreementEndDate", label: "Agreement End Date", group: "Dates & Service" },
  // Management
  { key: "reportsTo", label: "Reports To", group: "Management" },
  { key: "leadEmail", label: "Lead Email", group: "Management" },
  { key: "additionalManager", label: "Additional Manager", group: "Management" },
];

/** The 4 extra columns that only make sense on the Resignations report. */
export const RESIGNATION_EXTRA_COLUMNS: ColumnDef[] = [
  { key: "resignationDate", label: "Resignation Date", group: "Resignation" },
  { key: "finalDayInOffice", label: "Final Day in Office", group: "Resignation" },
  { key: "finalDayOfEmployment", label: "Final Day of Employment", group: "Resignation" },
  { key: "resignationReason", label: "Resignation Reason", group: "Resignation" },
];

/** The full ordered column list for a report type. */
export function getColumnsForStatus(isResignation: boolean): ColumnDef[] {
  return isResignation
    ? [...EMPLOYEE_COLUMNS, ...RESIGNATION_EXTRA_COLUMNS]
    : EMPLOYEE_COLUMNS;
}

/** Every canonical key in default order — the "all selected" initial state. */
export function getAllKeys(isResignation: boolean): string[] {
  return getColumnsForStatus(isResignation).map((c) => c.key);
}
