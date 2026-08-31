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

// Mutable so a test can move the employee and check what changes with them.
const user = { location: "Sri Lanka" as string | null };

vi.mock("../api/useLeaveData", () => ({
  useLeaveUserInfo: () => ({
    data: { workEmail: "me@wso2.com", leadEmail: "lead@wso2.com", location: user.location },
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

beforeEach(() => {
  submitMutate.mockClear();
  user.location = "Sri Lanka";
});

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

    await user.click(screen.getByRole("button", { name: /Submit Leave/ }));
    expect(await screen.findByText("Please select start and end dates")).toBeInTheDocument();
    expect(submitMutate).not.toHaveBeenCalled();
  });
});

// GeneralLeave.tsx:222-229 — nothing is posted until this is answered.
describe("the confirmation before posting", () => {
  it("names the type, the days, the range and the portion", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    show();

    await waitFor(() => expect(screen.getByRole("button", { name: /Submit Leave/ })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: /Submit Leave/ }));

    expect(await screen.findByText("Do you want to submit this leave?")).toBeInTheDocument();
    // "Casual/Annual" because this fixture sits in Sri Lanka.
    expect(screen.getByText(/Casual\/Annual request for 1 working day \(/)).toBeInTheDocument();
    expect(screen.getByText(/Full day\)/)).toBeInTheDocument();
    expect(submitMutate).not.toHaveBeenCalled();
  });

  it("posts only after Yes", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    show();
    await waitFor(() => expect(screen.getByRole("button", { name: /Submit Leave/ })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: /Submit Leave/ }));
    await user.click(await screen.findByRole("button", { name: "Yes" }));
    expect(submitMutate).toHaveBeenCalledTimes(1);
  });

  // The sabbatical form had this call site and not this message, so it went
  // quiet on success. Pinned on both forms: the source raises it from inside the
  // submitLeave thunk (leave.ts:150-156), so it is not optional per screen.
  it("confirms the request was submitted", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    show();
    await waitFor(() => expect(screen.getByRole("button", { name: /Submit Leave/ })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: /Submit Leave/ }));
    await user.click(await screen.findByRole("button", { name: "Yes" }));
    await waitFor(() => expect(submitMutate).toHaveBeenCalled());
    // Drive the mutation's own success path, the way React Query would.
    submitMutate.mock.calls[0][1].onSuccess();
    const message = await screen.findByText("Leave request submitted successfully!");
    const alert = message.closest(".MuiAlert-root");
    expect(alert?.className).toMatch(/AlertSuccess|standardSuccess|filledSuccess/);
  });

  it("posts nothing after No", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    show();
    await waitFor(() => expect(screen.getByRole("button", { name: /Submit Leave/ })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: /Submit Leave/ }));
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

// The leave type buttons are the most-read copy on this form, and what a type
// is called depends on where the employee sits — LeaveSelection.tsx:57-109
// pairs each location's types with its own LeaveLabel. leaveTypeLabel was
// added for exactly this and then wired into the confirmation dialog alone,
// so every button still read the flat report-table name. Asserting the call
// site rather than the helper: the helper's own tests passed throughout.
describe("what a leave type is called where you are", () => {
  it("uses India's names for an employee in India", async () => {
    user.location = "India";
    show();
    expect(await screen.findByRole("button", { name: /Annual \/ Earned/ })).toBeInTheDocument();
    // India's casual is "Casual", not Sri Lanka's "Casual/Annual".
    expect(screen.getByRole("button", { name: /^Casual$/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Casual\/Annual/ })).not.toBeInTheDocument();
  });

  it("uses Spain's names for an employee in Spain", async () => {
    user.location = "Spain";
    show();
    expect(await screen.findByRole("button", { name: /Annual Leave/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Casual Leave/ })).toBeInTheDocument();
  });

  it("uses Sri Lanka's name for an employee in Sri Lanka", async () => {
    show();
    expect(await screen.findByRole("button", { name: /Casual\/Annual/ })).toBeInTheDocument();
  });

  it("falls back to Sri Lanka for a location we don't recognise", async () => {
    user.location = null;
    show();
    expect(await screen.findByRole("button", { name: /Casual\/Annual/ })).toBeInTheDocument();
  });
});

// GeneralLeave.tsx:345-349 puts this next to Submit. Without it nothing on the
// form says what the Public comment switch actually changes.
describe("who can read the comment", () => {
  it("names the excluded group while the comment is private", async () => {
    show();
    expect(
      await screen.findByText(
        "Your comment will be visible to all email recipients except the WSO2 Vacation Group.",
      ),
    ).toBeInTheDocument();
  });

  it("drops the exclusion once the comment is public", async () => {
    const userEvent = (await import("@testing-library/user-event")).default;
    show();
    await userEvent.click(await screen.findByRole("switch", { name: /Public comment/ }));
    expect(
      await screen.findByText("Your comment will be visible to all email recipients."),
    ).toBeInTheDocument();
  });
});

// The Notify picker windows its options with react-window
// (VirtualizedListbox), which renders only the visible rows and positions each
// one absolutely. react-window passes that position as a `style` prop, cloned
// onto whatever the option renderer returned.
//
// EmployeeOption is a component, not an <li>, so the clone lands on the
// component's props — and unless it forwards `style` to the element it renders,
// the positioning is silently dropped. Every row then falls into normal flow
// inside a container sized for 36px rows, so the list collapses and the
// overflow paints outside the popup.
describe("the notify picker's option rows", () => {
  async function openNotify() {
    const user = (await import("@testing-library/user-event")).default.setup();
    show();
    await user.click(screen.getByPlaceholderText("Add people to notify (optional)"));
    await user.type(screen.getByPlaceholderText("Add people to notify (optional)"), "@wso2.com");
  }

  it("positions each row where react-window put it", async () => {
    await openNotify();
    const options = await screen.findAllByRole("option");
    expect(options.length).toBeGreaterThan(0);
    for (const option of options) {
      expect(option.style.position).toBe("absolute");
      expect(option.style.top).not.toBe("");
    }
  });

  // Measured in a headless browser against the real MUI option styles: the two
  // lines and the padding come to 51.94px, so a row needs a 52px slot. It was
  // 36 — one line's worth — and every row overflowed by 16px.
  it("gives each row a slot as tall as the row really is", async () => {
    await openNotify();
    const options = await screen.findAllByRole("option");
    for (const option of options) {
      expect(option.style.height).toBe("52px");
    }
  });

  // Consecutive rows must not overlap, which is what a slot shorter than the
  // row produces.
  it("stacks the rows without overlapping them", async () => {
    await openNotify();
    const tops = (await screen.findAllByRole("option")).map((o) => parseFloat(o.style.top));
    expect(tops.length).toBeGreaterThan(1);
    for (let i = 1; i < tops.length; i++) {
      expect(tops[i] - tops[i - 1]).toBe(52);
    }
  });

  it("keeps the row's own layout while doing so", async () => {
    await openNotify();
    const [first] = await screen.findAllByRole("option");
    // The photo-and-name row still lays out as a flex row.
    expect(first.style.display).toBe("flex");
    expect(first.style.alignItems).toBe("center");
  });
});
