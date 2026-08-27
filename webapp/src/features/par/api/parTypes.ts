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
// PAR (Performance Appraisal Review) domain types.
//
// Source of truth: digiops-hr/apps/par-app `backend/modules/types/types.bal`
// and `webapp/src/utils/types.ts`. See docs/ported-apps/par-app.md §1 for what
// each concept means — the names are opaque without it.
//
// These moved here from features/my/api/types.ts, where a subset lived to serve
// the profile page's review row. PAR owns them now.

// --- status enums ----------------------------------------------------------

/**
 * Only one cycle is active at a time. The backend refuses to create another
 * while any cycle is PENDING, PENDING_QUOTA or OPEN.
 *
 * FAILED is set by the backend when the post-creation snapshot job throws. No
 * screen in the source ever queries it, which is why a failed cycle looks like
 * "no cycle" while still blocking creation of a replacement — see the spec §9.
 */
export type ParCycleStatus = "PENDING" | "PENDING_QUOTA" | "OPEN" | "CLOSED" | "FAILED";

/** SHARED means visible to the lead and no longer editable. One-way. */
export type ParEmployeeStatus = "PENDING" | "DRAFT" | "SHARED" | "SHARED_BLOCKED";

/** SHARED means visible to the employee and no longer editable. One-way. */
export type ParLeadStatus = "PENDING" | "DRAFT" | "SHARED";

export type ParF2fStatus = "PENDING" | "SCHEDULED" | "COMPLETED";

export type ParEmployeeAcceptanceStatus = "PENDING" | "ACCEPTED" | "REJECTED";

/** Note the wire value for "completed" is "SHARED", not "COMPLETED". */
export type ParThreeSixtyReviewStatus = "PENDING" | "DRAFT" | "SHARED" | "REJECTED";

export type ParSpecialRating = "TOP5P" | "TOP20P" | "NOT_ASSIGNED";

// --- the cycle -------------------------------------------------------------

/** The rating scale is per-cycle configuration, not a fixed list in code. */
export interface ParCycleConfigurations {
  employeeParQuestion: string;
  threeSixtyReviewQuestion: string;
  parRatings: string[];
  threeSixtyReviewRatings: string[];
}

export interface ParCycle {
  parCycleId: number;
  parCycleName: string;
  parCycleStartDate: string;
  parCycleEndDate: string;
  parEvaluationStartDate: string;
  parEvaluationEndDate: string;
  // Per-stage deadlines, all "YYYY-MM-DD". What each one actually locks is in
  // parDeadlines.ts — they do NOT apply uniformly, and one locks nothing.
  parEmployeeDeadline: string;
  parThreeSixtyRatingDeadline: string;
  parLeadDeadline: string;
  parF2FDeadline: string;
  parSpecialRatingDeadline?: string;
  parCycleStatus: ParCycleStatus;
  parCycleConfigurations?: ParCycleConfigurations;
}

// --- one person's PAR ------------------------------------------------------

/**
 * The central object: one employee's record within one cycle.
 *
 * Comments arrive base64-encoded on the wire and are decoded for display.
 */
export interface ParRating {
  parRatingId: number;
  parCycleId: number;
  parEmployeeEmail: string;
  /** Present on lead- and admin-facing reads; absent on an employee's own. */
  parEmployeeName?: string;
  parEmployeeStatus: ParEmployeeStatus;
  parLeadStatus: ParLeadStatus;
  parF2fStatus: ParF2fStatus;
  parF2fDate?: string;
  parEmployeeAcceptanceStatus?: ParEmployeeAcceptanceStatus;
  parEmployeeComment?: string;
  parLeadComment?: string;
  parAdminComment?: string;
  /** A value from the cycle's own parRatings scale, or "NOT_ASSIGNED". */
  parRating?: string;
  parSpecialRating?: ParSpecialRating;
  /** Drive links supporting an evidence-requiring rating, newline-joined. */
  parPerformanceNoticeAck?: string;
}

/** The value the backend uses for "no rating chosen". */
export const PAR_RATING_NOT_ASSIGNED = "NOT_ASSIGNED";

// --- 360 feedback ----------------------------------------------------------

/**
 * One row of `GET /par-cycles/{id}/reports?leadEmail=` — a person somewhere in
 * a lead's reporting line, with their PAR's state and where they sit.
 *
 * Two fields carry booleans as free text, which is why they are read through
 * `util/parReports.ts` rather than compared directly:
 *
 *   `reportingType`   "direct" | "indirect", in unspecified case
 *   `isEmployeeALead` "True" | "true" | "False" | …, likewise
 */
export interface ParReportEntry {
  parRatingId: number;
  parCycleId: number;
  parEmployeeEmail: string;
  parEmployeeName?: string;
  parCompany?: string;
  parLocation?: string;
  parBusinessUnit?: string;
  parDepartment?: string;
  parTeam?: string;
  parSubTeam?: string;
  parLeadEmail?: string;
  parRating?: string;
  parSpecialRating?: ParSpecialRating;
  parEmployeeStatus: ParEmployeeStatus;
  parLeadStatus?: ParLeadStatus;
  parF2fStatus?: ParF2fStatus;
  parDirectLead?: string;
  reportingType?: string;
  isEmployeeALead?: string;
}

/** Per-stage completion counts the backend computes for one team. */
export interface ParTeamSummary {
  employeeParCompletedCount: number;
  threeSixtyReviewCompletedCount: number;
  leadsReviewCompletedCount: number;
  f2fCompletedCount: number;
}

/**
 * One of a lead's teams within a cycle.
 *
 * A lead can hold several: the team structure is business unit / department /
 * team / sub-team, and each combination the lead owns is its own row with its
 * own Top 5% / 20% quota.
 */
export interface ParTeam {
  parTeamId: number;
  parLeadEmail: string;
  parBusinessUnit: string;
  parDepartment: string;
  parTeam: string;
  parSubTeam: string;
  numberOfTeamMembers: number;
  numberOf5pSlots: number;
  numberOf20pSlots: number;
  summary: ParTeamSummary;
}

/** One member of a team, as the team-detail endpoint returns them. */
export interface ParTeamMember {
  parRatingId: number;
  parEmployeeEmail: string;
  parEmployeeName?: string;
  parEmployeeStatus: ParEmployeeStatus;
  parLeadStatus?: ParLeadStatus;
  parF2fStatus: ParF2fStatus;
  parF2fDate?: string;
  parRating?: string;
  parSpecialRating?: ParSpecialRating;
  par360ReviewStatus?: ParThreeSixtyReviewStatus;
  par360ReviewCounts?: {
    requestedReviewCount: number;
    sharedReviewCount: number;
  };
}

/**
 * A team with its members — `GET /par-cycles/{id}/teams/{teamId}`.
 *
 * `available*Slots` is the quota REMAINING, distinct from `numberOf*Slots`
 * which is the quota allocated. The distinction matters: the server refuses a
 * special rating once the remaining count reaches zero.
 */
export interface ParTeamReport extends ParTeam {
  parCycleId: number;
  available5pSlots: number;
  available20pSlots: number;
  details: ParTeamMember[];
}

/**
 * A request for THIS employee to review someone else.
 *
 * `employeeEmail` is the person to be reviewed, not the reviewer — the reviewer
 * is whoever the token belongs to. The two `is*Requested` flags say who asked:
 * the employee nominated you themselves, or their lead did. Both can be true.
 */
export interface ParThreeSixtyReviewRequest {
  employeeEmail: string;
  reviewStatus: ParThreeSixtyReviewStatus;
  isEmployeeRequested: boolean;
  isLeadRequested: boolean;
}

export interface ParReviewer {
  reviewerEmail: string;
  reviewStatus: ParThreeSixtyReviewStatus;
}

export interface ParThreeSixtyReview {
  reviewerEmail?: string;
  reviewStatus: ParThreeSixtyReviewStatus;
  reviewComment?: string;
  reviewRating?: string;
}

// --- identity --------------------------------------------------------------

/**
 * PAR's own view of the caller.
 *
 * `lead` and `isTeamLead` are why PAR needs its own gate: they come from here,
 * not from people-app privileges, and only `isTeamLead` opens the lead portal.
 * ADMIN and EMPLOYEE come from Asgardeo groups instead — see useParGate.
 */
/**
 * PAR's own record of an employee, from its `/employee/{email}` endpoint.
 *
 * `leadEmail` is load-bearing rather than informational: it is who the PAR is
 * shared WITH, and who must therefore be excluded from 360 nominations. PAR
 * carries its own copy rather than deferring to people-app, and this is the one
 * the backend will agree with.
 *
 * `isTeamLead` gates the lead screens. `lead` is a separate, weaker flag: the
 * source uses it for the chain view only, and only in conjunction with the
 * employee directory agreeing that the person has reports. The two are not
 * interchangeable — see the note in api/useParGate.ts.
 */
export interface ParEmployeeInfo {
  workEmail: string;
  employeeName?: string;
  leadEmail?: string | null;
  lead?: boolean | null;
  isTeamLead?: boolean;
  startDate?: string;
  jobRole?: string;
  businessUnit?: string;
  department?: string;
  team?: string;
  location?: string;
}
