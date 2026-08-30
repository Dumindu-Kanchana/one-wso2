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
  {
    workEmail: "here@wso2.com",
    firstName: "Still",
    lastName: "Here",
    employeeThumbnail: "https://photos.test/still.jpg",
    employeeStatus: "Active",
  },
  { workEmail: "going@wso2.com", firstName: "Marked", lastName: "Leaver", employeeThumbnail: "", employeeStatus: "Marked leaver" },
  { workEmail: "gone@wso2.com", firstName: "Long", lastName: "Gone", employeeThumbnail: "", employeeStatus: "Left" },
];

vi.mock("../api/useLeaveData", () => ({
  useLeaveUserInfo: () => ({
    data: { workEmail: "me@wso2.com", leadEmail: "lead@wso2.com", location: "Sri Lanka" },
  }),
  useLeaveAppConfig: () => ({ data: appConfigData, isPending: false, isError: false }),
  useLeaveEmployees: () => ({ data: employeeList, isPending: false, isError: false }),
  useLeaveEntitlement: () => ({ data: undefined, isPending: false, isError: false }),
}));
const submitMutate = vi.fn();
const validation = { workingDays: 1 as number };
vi.mock("../api/useLeaveMutations", () => ({
  useValidateLeave: () => ({
    mutateAsync: () => Promise.resolve(validation),
    mutate: vi.fn(),
    data: undefined,
    isPending: false,
    reset: vi.fn(),
  }),
  useSubmitLeave: () => ({
    mutate: submitMutate,
    isPending: false,
    isError: false,
    error: null,
  }),
}));
vi.mock("../components/LeaveShell", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("../components/LeaveBalanceSummary", () => ({ default: () => null }));

beforeEach(() => submitMutate.mockClear());

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

// GeneralLeave.tsx:165-189. The port disabled the button instead, which tells
// the reader nothing about what to change.
describe("what happens when the form is not ready", () => {
  it("says why, rather than leaving a dead button", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    show();

    // An end date before the start gives zero days.
    const end = screen.getByLabelText("End");
    await user.clear(end);
    await user.type(end, "2020-01-01");

    await user.click(screen.getByRole("button", { name: /Submit leave/ }));
    expect(await screen.findByText("Please select start and end dates")).toBeInTheDocument();
    expect(submitMutate).not.toHaveBeenCalled();
  });
});

// GeneralLeave.tsx:222-229 — nothing is posted until this is answered.
describe("the confirmation before posting", () => {
  it("names the type, the days, the range and the portion", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    show();

    await waitFor(() => expect(screen.getByRole("button", { name: /Submit leave/ })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: /Submit leave/ }));

    expect(await screen.findByText("Do you want to submit this leave?")).toBeInTheDocument();
    // "Casual/Annual" because this fixture sits in Sri Lanka.
    expect(screen.getByText(/Casual\/Annual request for 1 working day \(/)).toBeInTheDocument();
    expect(screen.getByText(/Full day\)/)).toBeInTheDocument();
    expect(submitMutate).not.toHaveBeenCalled();
  });

  it("posts only after Yes", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    show();
    await waitFor(() => expect(screen.getByRole("button", { name: /Submit leave/ })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: /Submit leave/ }));
    await user.click(await screen.findByRole("button", { name: "Yes" }));
    expect(submitMutate).toHaveBeenCalledTimes(1);
  });

  it("posts nothing after No", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    show();
    await waitFor(() => expect(screen.getByRole("button", { name: /Submit leave/ })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: /Submit leave/ }));
    await user.click(await screen.findByRole("button", { name: "No" }));
    expect(submitMutate).not.toHaveBeenCalled();
    // MUI keeps the dialog mounted through its close transition.
    await waitFor(() =>
      expect(screen.queryByText("Do you want to submit this leave?")).toBeNull(),
    );
  });
});

// The running app renders every picker as photo + name + address
// (NotifyPeople.tsx:168-186). The port listed bare addresses, having fetched
// firstName, lastName and employeeThumbnail and then discarded them.
describe("picking someone to notify", () => {
  async function openPicker() {
    const user = (await import("@testing-library/user-event")).default.setup();
    show();
    const field = screen.getByPlaceholderText("Add people to notify (optional)");
    await user.click(field);
    return { user, field };
  }

  it("shows a name and a photo, not just an address", async () => {
    const { user, field } = await openPicker();
    await user.type(field, "@wso2.com");

    const option = await screen.findByText("Still Here");
    expect(option).toBeInTheDocument();
    const row = option.closest("li");
    expect(row?.querySelector("img")).toHaveAttribute("src", "https://photos.test/still.jpg");
    // The thumbnails are Google-hosted and 403 without this.
    expect(row?.querySelector("img")).toHaveAttribute("referrerpolicy", "no-referrer");
    expect(row?.textContent).toContain("here@wso2.com");
  });

  it("can be searched by name, now that names are what is on screen", async () => {
    const { user, field } = await openPicker();
    await user.type(field, "Marked");
    expect(await screen.findByText("Marked Leaver")).toBeInTheDocument();
    expect(screen.queryByText("Still Here")).toBeNull();
  });

  it("still finds someone by address", async () => {
    const { user, field } = await openPicker();
    await user.type(field, "here@");
    expect(await screen.findByText("Still Here")).toBeInTheDocument();
  });
});
