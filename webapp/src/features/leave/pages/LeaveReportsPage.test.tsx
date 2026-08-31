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

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// The filter the page hands to useLeaves. Captured here rather than at the
// http layer because the defect is the PAGE deciding not to pass
// employeeStatuses — a test that only proves useLeaves forwards what it is
// given passes with the bug still in place.
const filters: unknown[] = [];
const userInfo = { data: undefined as unknown };

// Reassigned, not emptied: the grid freezes the rows array it is handed, so a
// later `leaveRows.length = 0` throws.
let leaveRows: unknown[] = [];
const employeeList = [
  { workEmail: "here@wso2.com", firstName: "Still", lastName: "Here", employeeThumbnail: "", employeeStatus: "Active" },
  { workEmail: "going@wso2.com", firstName: "Marked", lastName: "Leaver", employeeThumbnail: "", employeeStatus: "Marked leaver" },
];

vi.mock("../api/useLeaveData", () => ({
  useLeaveUserInfo: () => userInfo,
  useLeaveEmployees: () => ({ data: employeeList, isPending: false, isError: false }),
  useLeaves: (filter: unknown) => {
    filters.push(filter);
    return { data: { leaves: leaveRows }, isPending: false, isFetching: false, isError: false };
  },
}));
vi.mock("../components/LeaveShell", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const { default: LeaveReportsPage } = await import("./LeaveReportsPage");
const { NotificationsProvider } = await import("@context/notifications/NotificationsContext");
const { LEAVE_PRIVILEGE } = await import("../api/leaveTypes");

function show() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <NotificationsProvider>
        <LeaveReportsPage />
      </NotificationsProvider>
    </QueryClientProvider>,
  );
}

/** The filter the page most recently asked for. */
function lastFilter() {
  return filters[filters.length - 1] as { employeeStatuses?: string[]; approverEmail?: string };
}

beforeEach(() => {
  filters.length = 0;
  leaveRows = [];
});

function row(over: Record<string, unknown> = {}) {
  return {
    id: Math.random(),
    email: "a@wso2.com",
    leaveType: "casual",
    startDate: "2026-03-02T00:00:00.000Z",
    endDate: "2026-03-02T00:00:00.000Z",
    numberOfDays: 1,
    periodType: "one",
    ...over,
  };
}

describe("a plain lead's report", () => {
  beforeEach(() => {
    userInfo.data = {
      workEmail: "lead@wso2.com",
      isLead: true,
      privileges: [LEAVE_PRIVILEGE.EMPLOYEE, LEAVE_PRIVILEGE.LEAD],
      subordinateCount: 4,
    };
  });

  // Not a display filter — it changes which rows come back, so withholding it
  // for leads gave them a different report from the one the live app gives.
  // LeadReportTab.tsx:46,61 sends it on every request, lead or People Ops.
  it("asks for employee statuses, exactly as the source does for every lead", () => {
    show();
    expect(lastFilter().employeeStatuses).toEqual(["Active", "Marked leaver"]);
  });

  it("still scopes to the lead", () => {
    show();
    expect(lastFilter().approverEmail).toBe("lead@wso2.com");
  });
});

describe("a People Ops report", () => {
  beforeEach(() => {
    userInfo.data = {
      workEmail: "ops@wso2.com",
      isLead: false,
      privileges: [LEAVE_PRIVILEGE.EMPLOYEE, LEAVE_PRIVILEGE.PEOPLE_OPS_TEAM],
      subordinateCount: 0,
    };
  });

  it("asks for the same statuses", () => {
    show();
    expect(lastFilter().employeeStatuses).toEqual(["Active", "Marked leaver"]);
  });

  it("is org-wide by default, not scoped to the viewer", () => {
    show();
    expect(lastFilter().approverEmail).toBeUndefined();
  });
});

// The source's report is a DataGrid: sorted on click, paged at 10
// (LeadReportTable.tsx:150-178). The port rendered every row at once and capped
// the fetch at 1000 to survive it.
describe("the table", () => {
  beforeEach(() => {
    userInfo.data = {
      workEmail: "lead@wso2.com",
      privileges: [LEAVE_PRIVILEGE.EMPLOYEE, LEAVE_PRIVILEGE.LEAD],
    };
  });

  it("sends neither a limit nor an orderBy, as the running app does not", () => {
    show();
    const f = lastFilter() as Record<string, unknown>;
    expect(f.limit).toBeUndefined();
    expect(f.orderBy).toBeUndefined();
  });

  it("carries the source's column headers", () => {
    leaveRows.push(row());
    show();
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
      "Employee",
      "Leave Type",
      "Start Date",
      "End Date",
      "Days",
      "Period",
    ]);
  });

  it("pages at ten rather than rendering everything", () => {
    for (let i = 0; i < 25; i++) leaveRows.push(row({ id: i, email: `p${i}@wso2.com` }));
    show();
    expect(screen.getAllByRole("row")).toHaveLength(11); // header + 10
    expect(document.body.textContent).toContain("1–10 of 25");
  });

  it("sorts on a column header", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    leaveRows.push(row({ id: 1, email: "zoe@wso2.com" }), row({ id: 2, email: "amy@wso2.com" }));
    show();

    const firstCell = () => screen.getAllByRole("row")[1].querySelectorAll('[role="gridcell"]')[0];
    await user.click(screen.getByRole("columnheader", { name: "Employee" }));
    expect(firstCell().textContent).toBe("amy@wso2.com");

    await user.click(screen.getByRole("columnheader", { name: "Employee" }));
    expect(firstCell().textContent).toBe("zoe@wso2.com");
  });

  // The reason for using the grid rather than hand-building onto a plain table:
  // these arrive with it, and the running app has all four.
  it("offers the toolbar the running app offers", () => {
    leaveRows.push(row());
    show();
    for (const name of ["Columns", "Filters", "Export", "Search"]) {
      expect(screen.getByRole("button", { name }), name).toBeInTheDocument();
    }
  });
});

// LeadReportTable.tsx:141 — summing days across a mixed list answers no question
// anyone asked.
describe("the totals", () => {
  beforeEach(() => {
    userInfo.data = { workEmail: "lead@wso2.com", privileges: [LEAVE_PRIVILEGE.LEAD] };
  });

  it("shows a day total for one employee", () => {
    leaveRows.push(row({ id: 1, numberOfDays: 2 }), row({ id: 2, numberOfDays: 3 }));
    show();
    expect(screen.getByText("Total: 5 days")).toBeInTheDocument();
  });

  it("withholds it once more than one employee is in the result", () => {
    leaveRows.push(row({ id: 1, email: "a@wso2.com" }), row({ id: 2, email: "b@wso2.com" }));
    show();
    expect(screen.queryByText(/^Total: /)).toBeNull();
    expect(screen.getByText("2 records")).toBeInTheDocument();
  });
});


// The same windowed picker as the Notify field, so the same contract: the row
// component must forward react-window's position, and the slot must be as tall
// as the row. Asserted here too because a fix wired into one call site and not
// the other is exactly how this kind of bug survives.
describe("the employee picker's option rows", () => {
  it("positions and sizes each row the way the windowed list asked", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    // The employee picker is People-Ops only (LeaveReportsPage.tsx:193).
    userInfo.data = {
      workEmail: "po@wso2.com",
      privileges: [LEAVE_PRIVILEGE.EMPLOYEE, LEAVE_PRIVILEGE.PEOPLE_OPS_TEAM],
    };
    show();
    await user.click(screen.getByPlaceholderText("All employees"));

    const options = await screen.findAllByRole("option");
    expect(options.length).toBeGreaterThan(0);
    for (const option of options) {
      expect(option.style.position).toBe("absolute");
      expect(option.style.height).toBe("52px");
    }
  });
});
