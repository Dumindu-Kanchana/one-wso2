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
// on both the apply and the history sabbatical routes. This is the permission
// to TAKE a sabbatical; whether the rail offers the Sabbatical entry is a
// different question, covered further down.
describe("who may take a sabbatical", () => {
  it("an employee can", () => {
    expect(gateFor({ privileges: [P.EMPLOYEE] }).canSee("leave-sabbatical-own")).toBe(true);
  });

  it("a lead can", () => {
    expect(gateFor({ privileges: [P.LEAD] }).canSee("leave-sabbatical-own")).toBe(true);
  });

  it("an intern cannot, even holding the employee privilege", () => {
    expect(gateFor({ privileges: [P.EMPLOYEE, P.INTERN] }).canSee("leave-sabbatical-own")).toBe(false);
  });

  // They still get the Sabbatical entry, for its Report — see below.
  it("a People-Ops-only user cannot — they hold neither allowed role", () => {
    expect(gateFor({ privileges: [P.PEOPLE_OPS_TEAM] }).canSee("leave-sabbatical-own")).toBe(false);
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

// route.ts:110 — `/history` allows [EMPLOYEE, INTERN, LEAD] and deliberately
// omits PEOPLE_OPS_TEAM. My History is the signed-in user's own leave, so an
// account that only holds the People Ops privilege has nothing to show there.
// Apply (route.ts:58) does list them, so only history is narrowed.
describe("who can see My History", () => {
  it("an employee can", () => {
    expect(gateFor({ privileges: [P.EMPLOYEE] }).canSee("leave-history")).toBe(true);
  });

  it("an intern can", () => {
    expect(gateFor({ privileges: [P.INTERN] }).canSee("leave-history")).toBe(true);
  });

  it("a lead can", () => {
    expect(gateFor({ privileges: [P.LEAD] }).canSee("leave-history")).toBe(true);
  });

  it("a People-Ops-only account cannot", () => {
    expect(gateFor({ privileges: [P.PEOPLE_OPS_TEAM] }).canSee("leave-history")).toBe(false);
  });

  it("but People Ops who are also an employee can", () => {
    expect(
      gateFor({ privileges: [P.EMPLOYEE, P.PEOPLE_OPS_TEAM] }).canSee("leave-history"),
    ).toBe(true);
  });

  it("Apply stays open to a People-Ops-only account", () => {
    expect(gateFor({ privileges: [P.PEOPLE_OPS_TEAM] }).canSee("leave-apply")).toBe(true);
  });
});

// A rail entry is offered when the person may open any tab inside it — not when
// they may take that kind of leave. People Ops cannot hold a sabbatical, but the
// sabbatical Report is theirs (route.ts:143-148). Gating the entry on the
// sabbatical permission alone hid a screen they are entitled to and left it
// reachable only by typing the URL.
describe("which leave entries the rail offers", () => {
  it("offers Sabbatical to People Ops, who get its Report but cannot apply", () => {
    const gate = gateFor({ privileges: [P.PEOPLE_OPS_TEAM] });
    expect(gate.canSee("leave-sabbatical")).toBe(true);
    expect(gate.canSee("leave-sabbatical-own")).toBe(false);
    expect(gate.canSee("leave-reports")).toBe(true);
  });

  it("offers Sabbatical to someone who may take one", () => {
    expect(gateFor({ privileges: [P.EMPLOYEE] }).canSee("leave-sabbatical")).toBe(true);
  });

  it("offers a lead both entries", () => {
    const gate = gateFor({ privileges: [P.EMPLOYEE, P.LEAD] });
    expect(gate.canSee("leave-general")).toBe(true);
    expect(gate.canSee("leave-sabbatical")).toBe(true);
  });

  // An intern may take general leave but never a sabbatical, cannot approve,
  // and gets no reports — so the whole entry goes.
  it("withholds Sabbatical entirely from an intern", () => {
    const gate = gateFor({ privileges: [P.EMPLOYEE, P.INTERN] });
    expect(gate.canSee("leave-sabbatical")).toBe(false);
    expect(gate.canSee("leave-general")).toBe(true);
  });

  it("always offers General, since applying is open to everyone", () => {
    for (const p of [P.EMPLOYEE, P.INTERN, P.LEAD, P.PEOPLE_OPS_TEAM]) {
      expect(gateFor({ privileges: [p] }).canSee("leave-general")).toBe(true);
    }
  });
});
