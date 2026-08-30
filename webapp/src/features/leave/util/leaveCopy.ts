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

import type { LeaveType } from "../api/leaveTypes";

// User-visible copy, transcribed from the leave-app.
//
// The source centralises its result messages in `config/constant.ts`
// (`SnackMessage`) and its labels in `types/types.ts` (`LeaveLabel`,
// `LeaveTooltip`, `DayPortionLabel`). The port had reused none of it and wrote
// its own wording inline at every call site, which is how 38 of 76 strings
// ended up reworded and 17 missing.
//
// Nothing here is invented. A string that the source does not have is a
// question, not something to write.

/** `config/constant.ts:17-43`. */
export const SnackMessage = {
  success: {
    cancelLeaveMessage: "Leave cancelled successfully",
    submitLeaveMessage: "Leave request submitted successfully",
    approveLeaveMessage: "Leave request approved successfully",
    rejectLeaveMessage: "Leave request rejected successfully",
  },
  error: {
    insufficientPrivileges: "Insufficient Privileges",
    fetchPrivileges: "Failed to fetch Privileges",
    fetchEmployees: "Unable to retrieve list of Employees",
    fetchAppConfigMessage: "Unable to retrieve app configurations",
    fetchLeaveHistoryMessage: "Unable to retrieve leave history",
    cancelLeaveMessage: "Failed to cancel leave",
    submitLeaveMessage: "Failed to submit leave request",
    approveLeaveMessage: "Failed to approve leave request",
    rejectLeaveMessage: "Failed to reject leave request",
  },
} as const;

/**
 * Blocking messages on the Apply form — `GeneralLeave.tsx:165-189`.
 *
 * The port had dropped all four and disabled the button instead, which tells
 * someone nothing about why. Two of them are unreachable here because the
 * port's state cannot hold a null portion or a null leave type; they are
 * transcribed anyway so the set stays complete if that ever changes.
 */
export const VALIDATION_MESSAGE = {
  datesRequired: "Please select start and end dates",
  workingDaysRequired: "Working days must be at least 1 to submit a leave request",
  portionRequired: "Please select a portion of the day",
  leaveTypeRequired: "Please select a leave type",
} as const;

/** The confirmation before a leave is posted — `GeneralLeave.tsx:222-229`. */
export const SUBMIT_CONFIRMATION = {
  title: "Do you want to submit this leave?",
  okText: "Yes",
  cancelText: "No",
  /**
   * `GeneralLeave.tsx:224`. Names the type, the working days, the range and the
   * portion, so the reader can check what they are about to send rather than
   * being asked to confirm an unlabelled action.
   *
   * The portion words here are the source's own — "Full day" / "Morning" /
   * "Afternoon" — which are NOT the DAY_PORTION_LABEL values used on the
   * buttons ("Full Day" / "First Half" / "Second Half").
   */
  body: (args: {
    leaveLabel: string;
    workingDays: number;
    dateRange: string;
    portionLabel: string;
  }): string =>
    `This will submit a ${args.leaveLabel} request for ${args.workingDays} working day` +
    `${args.workingDays !== 1 ? "s" : ""} (${args.dateRange}, ${args.portionLabel}).`,
} as const;

/** `GeneralLeave.tsx:212-217` — the confirmation's wording, not the buttons'. */
export const CONFIRMATION_PORTION_LABEL = {
  full: "Full day",
  first: "Morning",
  second: "Afternoon",
} as const;

/** `types/types.ts:50-54`. */
export const DAY_PORTION_LABEL = {
  full: "Full Day",
  first: "First Half",
  second: "Second Half",
} as const;

/** `types/types.ts:109-113` — only these three carry one. */
export const LEAVE_TOOLTIP: Partial<Record<LeaveType, string>> = {
  conges_payes: "Paid Annual Leave",
  rtt: "Réduction du Temps de Travail",
  sick: "Sick Leave",
};

// `types/types.ts:93-106`. Twelve labels for nine types, because four of them
// are named differently depending on where the employee sits: `casual` is
// "Casual/Annual" in Sri Lanka, "Casual" in India and "Casual Leave" in Spain.
// Collapsing them to one label each — which the port had done — renames leave
// for three of the four locations.
const LEAVE_LABEL = {
  CASUAL: "Casual/Annual",
  MATERNITY: "Maternity",
  PATERNITY: "Paternity",
  LIEU: "Lieu",
  SABBATICAL: "Sabbatical",
  SICK: "Sick Leave",
  CONGES_PAYES: "Congés Payés",
  RTT: "RTT",
  SPAIN_ANNUAL: "Annual Leave",
  SPAIN_CASUAL: "Casual Leave",
  INDIA_ANNUAL: "Annual / Earned",
  INDIA_CASUAL: "Casual",
} as const;

/** Shown in every location — `LeaveSelection.tsx:51-55`. */
const COMMON_LABELS: Partial<Record<LeaveType, string>> = {
  maternity: LEAVE_LABEL.MATERNITY,
  paternity: LEAVE_LABEL.PATERNITY,
  lieu: LEAVE_LABEL.LIEU,
  sabbatical: LEAVE_LABEL.SABBATICAL,
};

/** Per-location, from `LeaveSelection.tsx:57-109`. */
const LOCATION_LABELS: Record<string, Partial<Record<LeaveType, string>>> = {
  "Sri Lanka": { casual: LEAVE_LABEL.CASUAL },
  India: {
    annual: LEAVE_LABEL.INDIA_ANNUAL,
    casual: LEAVE_LABEL.INDIA_CASUAL,
    sick: LEAVE_LABEL.SICK,
  },
  France: {
    conges_payes: LEAVE_LABEL.CONGES_PAYES,
    rtt: LEAVE_LABEL.RTT,
    sick: LEAVE_LABEL.SICK,
  },
  Spain: {
    annual: LEAVE_LABEL.SPAIN_ANNUAL,
    casual: LEAVE_LABEL.SPAIN_CASUAL,
    sick: LEAVE_LABEL.SICK,
  },
};

/**
 * What this leave type is called where this employee sits.
 *
 * Falls back to Sri Lanka for an unknown location, matching the source's
 * `EmployeeLocation.LK` default branch, and then to the generic label so a type
 * offered outside its own location still has a name rather than a blank.
 */
export function leaveTypeLabel(location: string | null | undefined, type: LeaveType): string {
  const forLocation = (location ? LOCATION_LABELS[location] : undefined) ?? LOCATION_LABELS["Sri Lanka"];
  return forLocation[type] ?? COMMON_LABELS[type] ?? GENERIC_LABEL[type];
}

/**
 * Used where there is no location to hand — a report row, a history card for
 * someone else's leave. `GeneralLeave.tsx:74-81` uses this same shape for its
 * entitlement warning, including mapping `annual` to "Casual/Annual", which
 * reads oddly but is what the source says.
 */
export const GENERIC_LABEL: Record<LeaveType, string> = {
  casual: LEAVE_LABEL.CASUAL,
  annual: LEAVE_LABEL.CASUAL,
  sick: LEAVE_LABEL.SICK,
  lieu: LEAVE_LABEL.LIEU,
  maternity: LEAVE_LABEL.MATERNITY,
  paternity: LEAVE_LABEL.PATERNITY,
  sabbatical: LEAVE_LABEL.SABBATICAL,
  conges_payes: LEAVE_LABEL.CONGES_PAYES,
  rtt: LEAVE_LABEL.RTT,
};
