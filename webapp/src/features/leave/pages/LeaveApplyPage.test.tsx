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
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const appConfigData = {
  cachedEmails: {
    mandatoryMails: [{ email: "lead@wso2.com", thumbnail: null }],
    optionalMails: [
      { email: "lead@wso2.com", thumbnail: null },
      { email: "buddy@wso2.com", thumbnail: null },
      { email: "scrum@wso2.com", thumbnail: null },
    ],
  },
};

const employeeList = [
  { workEmail: "here@wso2.com", firstName: "Still", lastName: "Here", employeeStatus: "Active" },
  { workEmail: "going@wso2.com", firstName: "Marked", lastName: "Leaver", employeeStatus: "Marked leaver" },
  { workEmail: "gone@wso2.com", firstName: "Long", lastName: "Gone", employeeStatus: "Left" },
];

vi.mock("../api/useLeaveData", () => ({
  useLeaveUserInfo: () => ({
    data: { workEmail: "me@wso2.com", leadEmail: "lead@wso2.com", location: "Sri Lanka" },
  }),
  useLeaveAppConfig: () => ({ data: appConfigData, isPending: false, isError: false }),
  useLeaveEmployees: () => ({ data: employeeList, isPending: false, isError: false }),
  useLeaveEntitlement: () => ({ data: undefined, isPending: false, isError: false }),
}));
vi.mock("../api/useLeaveMutations", () => ({
  useValidateLeave: () => ({ mutate: vi.fn(), data: undefined, isPending: false, reset: vi.fn() }),
  useSubmitLeave: () => ({ mutate: vi.fn(), isPending: false, isError: false, error: null }),
}));
vi.mock("../components/LeaveShell", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("../components/LeaveBalanceSummary", () => ({ default: () => null }));

const { default: LeaveApplyPage } = await import("./LeaveApplyPage");
const { NotificationsProvider } = await import("@context/notifications/NotificationsContext");

function show() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <NotificationsProvider>
        <LeaveApplyPage />
      </NotificationsProvider>
    </QueryClientProvider>,
  );
}

// L3. The backend returns optionalMails — whoever was copied on this person's
// last request. The source pre-selects them so a repeat request notifies the
// same people; starting empty quietly notifies fewer people than the standalone
// app on every default submission.
describe("who gets notified by default", () => {
  it("pre-selects the people copied on the last request", async () => {
    show();
    await waitFor(() => {
      expect(screen.getByText("buddy@wso2.com")).toBeInTheDocument();
    });
    expect(screen.getByText("scrum@wso2.com")).toBeInTheDocument();
  });

  it("lists the lead once, and as a chip that cannot be removed", async () => {
    // lead@wso2.com is in BOTH the mandatory and optional lists. The source
    // filters the mandatory ones out of the optional seed (NotifyPeople.tsx:87)
    // so it appears once — as a fixed tag the user cannot delete, since the
    // backend notifies them regardless.
    show();
    await waitFor(() => expect(screen.getByText("buddy@wso2.com")).toBeInTheDocument());

    const leadChips = screen.getAllByText("lead@wso2.com");
    expect(leadChips).toHaveLength(1);
    const chip = leadChips[0].closest(".MuiChip-root");
    expect(chip?.querySelector(".MuiChip-deleteIcon")).toBeNull();

    // A seeded one can be removed.
    const buddy = screen.getByText("buddy@wso2.com").closest(".MuiChip-root");
    expect(buddy?.querySelector(".MuiChip-deleteIcon")).not.toBeNull();
  });
});

// L5. The employees call asks for Left as well, because historical rows need
// resolving — but the source drops them again before offering recipients
// (NotifyPeople.tsx:107). Without that filter the picker offers to email people
// who have gone.
describe("who can be picked", () => {
  it("offers people who are still here, and not the leavers", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    show();
    const field = screen.getByPlaceholderText("Add people to notify (optional)");
    await user.click(field);
    await user.type(field, "@wso2.com");

    await waitFor(() => expect(screen.getByText("here@wso2.com")).toBeInTheDocument());
    expect(screen.getByText("going@wso2.com")).toBeInTheDocument();
    expect(screen.queryByText("gone@wso2.com")).toBeNull();
  });
});
