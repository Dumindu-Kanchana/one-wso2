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

import { ME_APPS } from "@constants/meApps";
import { LEAVE_PRIVILEGE } from "./leaveTypes";
import { useLeaveUserInfo } from "./useLeaveData";

// Role-gates the Leave menu items against the LEAVE backend's own privileges,
// not the coarse people-app capabilities the rail derives from `requires`.
//
// The two vocabularies are unrelated. people-app numbers LEAD 993 / ADMIN 999;
// the leave backend numbers LEAD 879 / PEOPLE_OPS_TEAM 789, returned by its own
// /user-info. Reading `requires` against people-app capabilities meant a leave
// lead who is not a people-app lead saw no Reports entry while the page worked
// by URL, and a people-app lead who is not a leave lead saw the entry and
// landed on a denial. Same shape of problem as Finance and Marketing Ops, and
// the same treatment — see useFinanceGate.
//
// The source enforces this at the ROUTE, building its router from a role table
// so an ineligible user gets a 404 (route.ts:129-149, AppHandler.tsx:46). We
// keep the route registered and gate the rail and the page from one place, so
// the menu and the screen can no longer disagree.

/** Item ids that declare a restriction and must therefore fail closed. */
const RESTRICTED_IDS = new Set(
  (ME_APPS.find((app) => app.key === "leave")?.items ?? [])
    .filter((it) => it.requires && it.requires.length > 0)
    .map((it) => it.id),
);

export interface LeaveGate {
  canSee: (itemId: string) => boolean;
  /** True while /user-info is still in flight — never render a denial on this. */
  isResolving: boolean;
  isPeopleOps: boolean;
  isLead: boolean;
}

export function useLeaveGate(enabled = true): LeaveGate {
  const userInfo = useLeaveUserInfo(enabled);
  const privileges = userInfo.data?.privileges ?? [];

  const isPeopleOps = privileges.includes(LEAVE_PRIVILEGE.PEOPLE_OPS_TEAM);
  // The privilege number, and nothing else — LeadReportTab.tsx:50. `isLead`
  // and `subordinateCount > 0` were also being accepted, which granted the
  // report to people the running app does not grant it to.
  const isLead = privileges.includes(LEAVE_PRIVILEGE.LEAD);
  const isEmployee = privileges.includes(LEAVE_PRIVILEGE.EMPLOYEE);
  const isIntern = privileges.includes(LEAVE_PRIVILEGE.INTERN);

  const canSee = (itemId: string): boolean => {
    switch (itemId) {
      // route.ts:148 — LEAD or People Ops.
      case "leave-reports":
        return isLead || isPeopleOps;
      // route.ts:94,101 — LEAD only. People Ops cannot approve.
      case "leave-approve":
        return isLead;
      // route.ts:77-78 and :124-125 — `allowRoles: [EMPLOYEE, LEAD]` with
      // `denyRoles: [INTERN]`, on both the apply and history routes. Interns
      // cannot take a sabbatical, and a People-Ops-only user holds neither
      // allowed role, so neither sees it.
      //
      // Named explicitly rather than left to RESTRICTED_IDS: the registry entry
      // carries no `requires`, because the people-app capabilities that field is
      // resolved against have no word for "intern".
      case "leave-sabbatical":
        return (isEmployee || isLead) && !isIntern;
      // route.ts:110 — `allowRoles: [EMPLOYEE, INTERN, LEAD]`. PEOPLE_OPS_TEAM
      // is deliberately absent: My History is the signed-in user's own leave,
      // and a People-Ops-only account has none. Apply (route.ts:58) *does*
      // list them, so only history is narrowed.
      case "leave-history":
        return isEmployee || isIntern || isLead;
      default:
        // Apply is per-user and stays open. Anything else that declares a
        // restriction and is not named above fails closed, so the menu cannot
        // drift ahead of this mapping.
        return !RESTRICTED_IDS.has(itemId);
    }
  };

  return {
    canSee,
    isResolving: userInfo.isPending,
    isPeopleOps,
    isLead,
  };
}
