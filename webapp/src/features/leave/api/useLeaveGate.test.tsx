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

import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

const userInfo: { data?: unknown; isPending?: boolean } = {};
vi.mock("./useLeaveData", () => ({ useLeaveUserInfo: () => userInfo }));

const { useLeaveGate } = await import("./useLeaveGate");
const { LEAVE_PRIVILEGE } = await import("./leaveTypes");

function gateFor(data: unknown) {
  userInfo.data = data;
  userInfo.isPending = false;
  return renderHook(() => useLeaveGate()).result.current;
}

const P = LEAVE_PRIVILEGE;

describe("who can see Reports", () => {
  it("a leave lead can", () => {
    expect(gateFor({ privileges: [P.EMPLOYEE, P.LEAD] }).canSee("leave-reports")).toBe(true);
  });

  it("People Ops can", () => {
    expect(gateFor({ privileges: [P.EMPLOYEE, P.PEOPLE_OPS_TEAM] }).canSee("leave-reports")).toBe(
      true,
    );
  });

  it("a plain employee cannot", () => {
    expect(gateFor({ privileges: [P.EMPLOYEE] }).canSee("leave-reports")).toBe(false);
  });

  // Two widenings the port had that the running app does not: it checks the
  // privilege number alone (LeadReportTab.tsx:50).
  it("an isLead flag without the privilege does not count", () => {
    expect(gateFor({ isLead: true, privileges: [P.EMPLOYEE] }).canSee("leave-reports")).toBe(false);
  });

  it("having subordinates without the privilege does not count", () => {
    expect(
      gateFor({ subordinateCount: 9, privileges: [P.EMPLOYEE] }).canSee("leave-reports"),
    ).toBe(false);
  });
});

// route.ts:94,101 — LEAD only. People Ops can report on sabbaticals but cannot
// approve one.
describe("who can approve", () => {
  it("a leave lead can", () => {
    expect(gateFor({ privileges: [P.EMPLOYEE, P.LEAD] }).canSee("leave-approve")).toBe(true);
  });

  it("People Ops cannot", () => {
    expect(gateFor({ privileges: [P.EMPLOYEE, P.PEOPLE_OPS_TEAM] }).canSee("leave-approve")).toBe(
      false,
    );
  });
});

describe("the per-user screens", () => {
  it("stay open to any employee", () => {
    const gate = gateFor({ privileges: [P.EMPLOYEE] });
    expect(gate.canSee("leave-apply")).toBe(true);
    expect(gate.canSee("leave-history")).toBe(true);
  });
});

// route.ts:77-78 and :124-125 — allowRoles [EMPLOYEE, LEAD], denyRoles [INTERN],
// on both the apply and the history sabbatical routes.
describe("who can see Sabbatical", () => {
  it("an employee can", () => {
    expect(gateFor({ privileges: [P.EMPLOYEE] }).canSee("leave-sabbatical")).toBe(true);
  });

  it("a lead can", () => {
    expect(gateFor({ privileges: [P.LEAD] }).canSee("leave-sabbatical")).toBe(true);
  });

  it("an intern cannot, even holding the employee privilege", () => {
    expect(gateFor({ privileges: [P.EMPLOYEE, P.INTERN] }).canSee("leave-sabbatical")).toBe(false);
  });

  it("a People-Ops-only user cannot — they hold neither allowed role", () => {
    expect(gateFor({ privileges: [P.PEOPLE_OPS_TEAM] }).canSee("leave-sabbatical")).toBe(false);
  });
});

describe("an unknown item", () => {
  it("is open when it declares no restriction", () => {
    // Matches useFinanceGate: unrestricted ids are per-user views.
    expect(gateFor({ privileges: [P.EMPLOYEE] }).canSee("leave-something-new")).toBe(true);
  });
});

describe("before /user-info has answered", () => {
  it("reports that it is still resolving, and grants nothing", () => {
    userInfo.data = undefined;
    userInfo.isPending = true;
    const gate = renderHook(() => useLeaveGate()).result.current;
    expect(gate.isResolving).toBe(true);
    expect(gate.canSee("leave-reports")).toBe(false);
    expect(gate.isLead).toBe(false);
    expect(gate.isPeopleOps).toBe(false);
  });
});
