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

// DTOs + enums mirrored from people-ops-suite/apps/leave-app/backend.
// Field names match the wire format. Source of truth: the backend's
// types.bal / modules/database/{types,enum}.bal.

// ---- enums -----------------------------------------------------------------

export type LeaveType =
  | "casual"
  | "sick"
  | "annual"
  | "lieu"
  | "maternity"
  | "paternity"
  | "sabbatical"
  | "conges_payes"
  | "rtt";

export type LeavePeriodType = "multiple" | "one" | "half";

export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export type OrderBy = "ASC" | "DESC";

// leave-app employee statuses (from the HR system).
export type EmployeeStatus = "Active" | "Marked leaver" | "Left";

// leave-app privilege numbers — DISTINCT from people-app's. The leave
// backend's /user-info returns these in `privileges`.
export const LEAVE_PRIVILEGE = {
  EMPLOYEE: 987,
  INTERN: 678,
  LEAD: 879,
  PEOPLE_OPS_TEAM: 789,
} as const;

// ---- user / config ---------------------------------------------------------

export interface LeaveUserInfo {
  employeeId: string | null;
  firstName: string | null;
  lastName: string | null;
  workEmail: string | null;
  leadEmail: string | null;
  employeeThumbnail: string | null;
  jobRole: string | null;
  privileges: number[];
  employmentStartDate: string | null;
  isLead: boolean | null;
  subordinateCount: number;
  location: string | null;
}

export interface DefaultMail {
  email: string;
  thumbnail?: string;
}

export interface AppConfig {
  isSabbaticalLeaveEnabled: boolean;
  sabbaticalLeavePolicyUrl: string;
  sabbaticalLeaveUserGuideUrl: string;
  sabbaticalLeaveEligibilityDuration: number;
  sabbaticalLeaveMaxApplicationDuration: number;
  cachedEmails: {
    mandatoryMails: DefaultMail[];
    optionalMails: DefaultMail[];
  };
}

// ---- leaves ----------------------------------------------------------------

// The row shape returned by GET /leaves (database:Leave).
export interface DatabaseLeave {
  id: number;
  email: string;
  leaveType: string | null;
  periodType: string | null;
  copyEmailList: string | null;
  notifyEveryone: boolean | null;
  submitComment: string | null;
  cancelComment: string | null;
  createdDate: string | null;
  updatedDate: string | null;
  emailId: string | null;
  emailSubject: string | null;
  startDate: string;
  endDate: string;
  startHalf: number | null;
  isEndHalf: boolean | null;
  canceledDate: string | null;
  numberOfDays: number | null;
  isPublicComment: boolean | null;
  calendarEventId: string | null;
  location: string | null;
  status: LeaveStatus | null;
  approverEmail: string | null;
}

export interface FetchedLeavesRecord {
  leaves: DatabaseLeave[];
}

// POST /leaves body.
export interface LeavePayload {
  startDate: string;
  endDate: string;
  isMorningLeave?: boolean | null;
  periodType?: LeavePeriodType;
  leaveType?: LeaveType;
  emailRecipients?: string[];
  calendarEventId?: string | null;
  comment?: string | null;
  isPublicComment?: boolean;
  emailSubject?: string | null;
}

// POST /leaves?isValidationOnlyMode=true response.
export interface CalculatedLeave {
  workingDays: number;
  hasOverlap: boolean;
  message?: string;
  holidays?: { title: string; date: string }[];
}

// ---- employees / entitlement -----------------------------------------------

export interface MinimalEmployeeInfo {
  firstName: string;
  lastName: string;
  workEmail: string;
  employeeThumbnail: string;
  employeeStatus: string | null;
}

export interface LeavePolicy {
  annual?: number | null;
  casual?: number | null;
  congesPayes?: number | null;
  rtt?: number | null;
  sick?: number | null;
}

export interface LeaveEntitlement {
  year: number;
  location: string | null;
  leavePolicy: LeavePolicy;
  policyAdjustedLeave: LeavePolicy;
  periodStart?: string | null;
  periodEnd?: string | null;
}

// ---- filter params for GET /leaves ----------------------------------------

export interface LeaveFilter {
  email?: string;
  startDate?: string;
  endDate?: string;
  approverEmail?: string;
  leaveCategory?: LeaveType[];
  statuses?: LeaveStatus[];
  limit?: number;
  offset?: number;
  orderBy?: OrderBy;
  employeeStatuses?: EmployeeStatus[];
  subordinatesLeaves?: boolean;
}

// ---- display helpers -------------------------------------------------------

// Everyday (non-sabbatical) leave types offered in the Apply form.
export const GENERAL_LEAVE_TYPES: LeaveType[] = [
  "casual",
  "annual",
  "sick",
  "lieu",
  "maternity",
  "paternity",
  "conges_payes",
  "rtt",
];

export const LEAVE_TYPE_LABEL: Record<LeaveType, string> = {
  casual: "Casual",
  sick: "Sick",
  annual: "Annual",
  lieu: "Lieu",
  maternity: "Maternity",
  paternity: "Paternity",
  sabbatical: "Sabbatical",
  conges_payes: "Congés Payés",
  rtt: "RTT",
};

export const LEAVE_TYPE_EMOJI: Record<LeaveType, string> = {
  casual: "🌤️",
  sick: "🤒",
  annual: "🏖️",
  lieu: "🔁",
  maternity: "🤱",
  paternity: "👶",
  sabbatical: "🧭",
  conges_payes: "🏖️",
  rtt: "⏱️",
};

// Default leave type per location (matches leave-app's LOCATION defaults).
export function defaultLeaveTypeForLocation(location: string | null | undefined): LeaveType {
  switch (location) {
    case "France":
      return "conges_payes";
    case "Spain":
      return "annual";
    default:
      return "casual";
  }
}
