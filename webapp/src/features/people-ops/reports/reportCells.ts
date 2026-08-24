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

// Column key → displayed cell text, for the report preview table.
//
// The canonical keys in reportColumns are a backend wire contract, not field
// names on Employee, so several don't line up with the row object:
//   epfNumber       → epf
//   location        → workLocation
//   jobRole         → designation
//   reportsTo       → managerName
//   leadEmail       → managerEmail
//   additionalManager → additionalManagerEmails
//   lengthOfService → derived, not stored
// This table is the single place that knows those mappings for the preview.
// (The CSV export never comes through here — the backend resolves the same
// keys server-side, which is why the two must stay in step.)

import type { Employee } from "../api/peopleOpsTypes";
import {
  calculateServiceLength,
  displayValue,
  formatReportDate,
  formatServiceLength,
} from "./reportFormat";

/** Column keys whose cells are dates. */
const DATE_KEYS = new Set([
  "startDate",
  "continuousServiceDate",
  "probationEndDate",
  "agreementEndDate",
  "resignationDate",
  "finalDayInOffice",
  "finalDayOfEmployment",
]);

/** Preferred pixel width per column, so the table doesn't distribute evenly. */
export const COLUMN_WIDTHS: Record<string, number> = {
  employeeId: 120,
  firstName: 120,
  lastName: 120,
  gender: 90,
  workEmail: 220,
  epfNumber: 120,
  company: 140,
  location: 120,
  employmentType: 150,
  jobRole: 180,
  externalDesignation: 190,
  jobBand: 90,
  employeeStatus: 130,
  office: 110,
  businessUnit: 140,
  team: 130,
  subTeam: 130,
  unit: 110,
  house: 110,
  startDate: 120,
  continuousServiceDate: 170,
  lengthOfService: 165,
  probationEndDate: 140,
  agreementEndDate: 140,
  reportsTo: 160,
  leadEmail: 210,
  additionalManager: 230,
  resignationDate: 145,
  finalDayInOffice: 155,
  finalDayOfEmployment: 175,
  resignationReason: 190,
};

/** Non-date, non-derived keys that read a differently-named Employee field. */
const FIELD_ALIASES: Record<string, keyof Employee> = {
  epfNumber: "epf",
  location: "workLocation",
  jobRole: "designation",
  reportsTo: "managerName",
  leadEmail: "managerEmail",
  additionalManager: "additionalManagerEmails",
};

/**
 * The text to render for `columnKey` of `row`. Always returns a string —
 * blanks become the "—" placeholder, so a cell is never empty by accident.
 *
 * `now` is injectable so length-of-service is testable without freezing time.
 */
export function cellText(row: Employee, columnKey: string, now?: Date): string {
  if (DATE_KEYS.has(columnKey)) {
    return formatReportDate(row[columnKey as keyof Employee] as string | null);
  }

  // Derived: falls back to startDate when there is no continuous-service
  // date, matching People App — someone with no prior stint has served
  // exactly as long as they have been here.
  if (columnKey === "lengthOfService") {
    return formatServiceLength(
      calculateServiceLength(row.continuousServiceDate ?? row.startDate, now),
    );
  }

  const alias = FIELD_ALIASES[columnKey];
  if (alias) return displayValue(row[alias]);

  return displayValue(row[columnKey as keyof Employee]);
}
