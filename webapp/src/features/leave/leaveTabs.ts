/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

// The Leave app's shape: two groups by KIND of leave, each holding everything
// you can do with that kind.
//
// The source nests the other way round — Apply → General | Sabbatical, and so
// on across four action routes (route.ts:47-150). Grouping by kind instead
// keeps the everyday path (general leave) to one rail entry and puts the rare
// one behind another, rather than threading sabbatical through every group a
// person passes through daily. The screens, their rules and their order within
// a group are unchanged; only which level is the rail and which the tabs.

/**
 * Permissions, resolved by `useLeaveGate().canSee`. These are about what a
 * person may DO, and are independent of how the screens are grouped.
 */
export type LeaveGateId =
  | "leave-apply"
  | "leave-history"
  | "leave-reports"
  | "leave-approve"
  /** May take a sabbatical at all: employee or lead, never an intern. */
  | "leave-sabbatical-own";

/** Rail entry ids. A group is shown when any tab in it is. */
export type LeaveGroupId = "leave-general" | "leave-sabbatical";

export interface LeaveTabDef {
  /** URL segment under the group's path. */
  segment: string;
  label: string;
  /** Checked before the tab is shown AND before its route renders. */
  gateId: LeaveGateId;
}

export interface LeaveGroupDef {
  id: LeaveGroupId;
  key: "general" | "sabbatical";
  path: string;
  title: string;
  subtitle: string;
  tabs: LeaveTabDef[];
}

export const LEAVE_GROUPS: readonly LeaveGroupDef[] = [
  {
    id: "leave-general",
    key: "general",
    path: "/me/leave/general",
    // route.ts:67 and GeneralLeave.tsx:244-252 both name this "General". The
    // shell's eyebrow already says "Leave", so the title is the category.
    title: "General",
    subtitle:
      "Request leave, track what you have taken, and report on your team. Working days are validated against the holiday calendar before you submit.",
    tabs: [
      // route.ts:65-70 — everyone, People Ops included.
      { segment: "apply", label: "Apply", gateId: "leave-apply" },
      // route.ts:112-118 — EMPLOYEE, INTERN or LEAD. People Ops is deliberately
      // absent: this is the signed-in user's own leave.
      { segment: "history", label: "My history", gateId: "leave-history" },
      // route.ts:136-142 — LEAD or People Ops.
      { segment: "reports", label: "Reports", gateId: "leave-reports" },
    ],
  },
  {
    id: "leave-sabbatical",
    key: "sabbatical",
    path: "/me/leave/sabbatical",
    title: "Sabbatical",
    subtitle:
      "A sabbatical is a long, planned break. Your lead approves it, so agree the dates with them before applying.",
    tabs: [
      // route.ts:72-78 and :119-126 — EMPLOYEE or LEAD, never an intern.
      { segment: "apply", label: "Apply", gateId: "leave-sabbatical-own" },
      { segment: "history", label: "My history", gateId: "leave-sabbatical-own" },
      // route.ts:86-102 — LEAD only. People Ops may report on sabbaticals but
      // cannot decide one.
      { segment: "approve", label: "Approve", gateId: "leave-approve" },
      { segment: "approval-history", label: "Approval history", gateId: "leave-approve" },
      // route.ts:143-148 — LEAD or People Ops, same rule as the general report.
      { segment: "report", label: "Report", gateId: "leave-reports" },
    ],
  },
] as const;

export function leaveGroup(key: LeaveGroupDef["key"]): LeaveGroupDef {
  const group = LEAVE_GROUPS.find((g) => g.key === key);
  if (!group) throw new Error(`Unknown leave group: ${key}`);
  return group;
}

/**
 * The first tab of `group` that `canSee` allows, or undefined when it allows
 * none. Drives both the index redirect and the "nothing here for you" case, so
 * they cannot disagree.
 */
export function firstAllowedTab(
  group: LeaveGroupDef,
  canSee: (id: string) => boolean,
): LeaveTabDef | undefined {
  return group.tabs.find((t) => canSee(t.gateId));
}

/**
 * Whether a group's rail entry should appear: whenever it holds a tab this
 * person may open.
 *
 * Not the same as "may take this kind of leave". A People-Ops-only account
 * cannot apply for a sabbatical or hold one, but does get the sabbatical
 * Report — so gating the entry on the sabbatical permission alone would hide a
 * screen they are entitled to and leave it reachable only by URL.
 */
export function groupHasAnyTab(
  group: LeaveGroupDef,
  canSee: (id: string) => boolean,
): boolean {
  return group.tabs.some((t) => canSee(t.gateId));
}
