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
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// The filter the page hands to useLeaves. Captured here rather than at the
// http layer because the defect is the PAGE deciding not to pass
// employeeStatuses — a test that only proves useLeaves forwards what it is
// given passes with the bug still in place.
const filters: unknown[] = [];
const userInfo = { data: undefined as unknown };

vi.mock("../api/useLeaveData", () => ({
  useLeaveUserInfo: () => userInfo,
  useLeaveEmployees: () => ({ data: [], isPending: false, isError: false }),
  useLeaves: (filter: unknown) => {
    filters.push(filter);
    return { data: { leaves: [] }, isPending: false, isFetching: false, isError: false };
  },
}));
vi.mock("../components/LeaveShell", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const { default: LeaveReportsPage } = await import("./LeaveReportsPage");
const { LEAVE_PRIVILEGE } = await import("../api/leaveTypes");

function show() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <LeaveReportsPage />
    </QueryClientProvider>,
  );
}

/** The filter the page most recently asked for. */
function lastFilter() {
  return filters[filters.length - 1] as { employeeStatuses?: string[]; approverEmail?: string };
}

beforeEach(() => {
  filters.length = 0;
});

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
