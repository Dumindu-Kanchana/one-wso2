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

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// The eligibility boundaries below were computed, not tuned until green: with
// the default 1095-day rule and ApplyTab.tsx:168's `- 1`, an anchor of
// 2024-01-01 becomes eligible on 2027-01-01 and is one day short on 2026-12-31.
// The 2024→2027 span crosses a leap year, so counting by eye gets it wrong.

const profile = {
  workEmail: "me@wso2.com",
  leadEmail: "lead@wso2.com" as string | null,
  employmentStartDate: "2024-01-01",
  location: "Sri Lanka",
};

const config = {
  isSabbaticalLeaveEnabled: true,
  sabbaticalLeavePolicyUrl: "https://policy.test/sabbatical",
  sabbaticalLeaveUserGuideUrl: "https://guide.test/sabbatical",
  sabbaticalLeaveEligibilityDuration: 1095,
  sabbaticalLeaveMaxApplicationDuration: 42,
  cachedEmails: { mandatoryMails: [], optionalMails: [] },
};

const state = {
  leaves: [] as Record<string, unknown>[],
  canSee: true,
  featureEnabled: true,
  isLead: false,
  subordinateCount: 0 as number | null,
};

// Every filter useLeaves is called with, so a test can assert what the screen
// actually asked the backend for rather than what it rendered.
const leaveFilters: Record<string, unknown>[] = [];

vi.mock("../api/useLeaveData", () => ({
  useLeaveUserInfo: () => ({
    data: { ...profile, subordinateCount: state.subordinateCount },
    isPending: false,
    isError: false,
  }),
  useLeaveAppConfig: () => ({
    data: { ...config, isSabbaticalLeaveEnabled: state.featureEnabled },
    isPending: false,
    isError: false,
  }),
  useLeaves: (filter: Record<string, unknown>) => {
    leaveFilters.push(filter);
    return { data: { leaves: state.leaves }, isPending: false, isError: false, isLoading: false };
  },
}));

vi.mock("../api/useLeaveGate", () => ({
  useLeaveGate: () => ({
    canSee: () => state.canSee,
    isResolving: false,
    isPeopleOps: false,
    isLead: state.isLead,
  }),
}));

const submitMutate = vi.fn();
const approveMutate = vi.fn();
vi.mock("../api/useLeaveMutations", () => ({
  useSubmitLeave: () => ({ mutate: submitMutate, isPending: false, isError: false, error: null }),
  useCancelLeave: () => ({ mutate: vi.fn(), isPending: false }),
  useApproveLeave: () => ({ mutate: approveMutate, isPending: false }),
}));

vi.mock("../components/LeaveShell", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const { default: LeaveSabbaticalPage } = await import("./LeaveSabbaticalPage");
const { NotificationsProvider } = await import("@context/notifications/NotificationsContext");

beforeEach(() => {
  submitMutate.mockClear();
  approveMutate.mockClear();
  leaveFilters.length = 0;
  state.isLead = false;
  state.subordinateCount = 0;
  profile.leadEmail = "lead@wso2.com";
  state.leaves = [];
  state.canSee = true;
  state.featureEnabled = true;
});

function show() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <NotificationsProvider>
        <LeaveSabbaticalPage />
      </NotificationsProvider>
    </QueryClientProvider>,
  );
}

function setDate(label: RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

async function fillValidRequest() {
  setDate(/Leave request start date/, "2027-03-01");
  setDate(/Leave request end date/, "2027-03-10");
  for (const box of screen.getAllByRole("checkbox")) fireEvent.click(box);
}

// ApplyTab.tsx:328-334. Without a lead there is nobody to route the request to,
// so the source replaces the whole form with an explanation rather than letting
// someone fill it in and fail on submit.
describe("when no reporting lead is set", () => {
  it("explains instead of showing the form", async () => {
    profile.leadEmail = null;
    show();
    expect(await screen.findByText("Reporting lead not set")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Apply" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Leave request start date/)).not.toBeInTheDocument();
  });

  it("still shows the heading and the user guide", async () => {
    profile.leadEmail = null;
    show();
    expect(await screen.findByText("Sabbatical Leave Application")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "User Guide" })).toBeInTheDocument();
  });
});

// ApplyTab.tsx:146-148. Someone with an approved sabbatical on record cannot
// retype the date the eligibility clock runs from; someone with none must.
describe("the last-sabbatical anchor", () => {
  it("is read-only and pre-filled when there is an approved sabbatical", async () => {
    state.leaves = [{ id: 1, endDate: "2024-06-30T00:00:00Z" }];
    show();
    const field = await screen.findByLabelText(/Last sabbatical leave end date/);
    expect(field).toBeDisabled();
    expect(field).toHaveValue("2024-06-30");
  });

  it("is editable and empty when there is none", async () => {
    show();
    const field = await screen.findByLabelText(/Last sabbatical leave end date/);
    expect(field).toBeEnabled();
    expect(field).toHaveValue("");
  });
});

// ApplyTab.tsx:158-184. The `- 1` in eligibilityGapDays makes the boundary a day
// stricter than a plain difference, and the sentence names which anchor it used.
describe("the eligibility warning", () => {
  it("does not appear on the first eligible day", async () => {
    show();
    setDate(/Leave request start date/, "2027-01-01");
    await waitFor(() =>
      expect(screen.queryByText(/must be at least/)).not.toBeInTheDocument(),
    );
  });

  it("appears one day earlier", async () => {
    show();
    setDate(/Leave request start date/, "2026-12-31");
    expect(
      await screen.findByText(
        "The leave start date must be at least 3 years after the employment start date.",
      ),
    ).toBeInTheDocument();
  });

  it("names the last sabbatical when there is one", async () => {
    state.leaves = [{ id: 1, endDate: "2025-01-01T00:00:00Z" }];
    show();
    setDate(/Leave request start date/, "2027-01-01");
    expect(
      await screen.findByText(
        "The leave start date must be at least 3 years after the last sabbatical leave end date.",
      ),
    ).toBeInTheDocument();
  });

  it("blocks the submit, not just decorates the form", async () => {
    show();
    setDate(/Leave request start date/, "2026-12-31");
    setDate(/Leave request end date/, "2027-01-05");
    for (const box of screen.getAllByRole("checkbox")) fireEvent.click(box);
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => expect(submitMutate).not.toHaveBeenCalled());
  });
});

// ApplyTab.tsx:187-202 and :229-240 — 42 days is allowed, 43 is not, and the
// check runs as you type rather than only on submit.
describe("the maximum duration", () => {
  it("accepts a range of exactly the limit", async () => {
    show();
    setDate(/Leave request start date/, "2027-03-01");
    setDate(/Leave request end date/, "2027-04-11");
    await waitFor(() =>
      expect(screen.queryByText(/must not exceed/)).not.toBeInTheDocument(),
    );
  });

  it("flags one day over, before the user presses Apply", async () => {
    show();
    setDate(/Leave request start date/, "2027-03-01");
    setDate(/Leave request end date/, "2027-04-12");
    expect(await screen.findByText("Leave duration must not exceed 6 weeks")).toBeInTheDocument();
  });
});

// ApplyTab.tsx:204-273. Each rule raises one message and returns, so the user is
// told the first thing wrong. The port had replaced all of this with a disabled
// button, which says nothing at all.
describe("what the form says when you press Apply", () => {
  it("asks for the dates when both are empty", async () => {
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Apply" }));
    expect(await screen.findByText("Please select both start and end dates")).toBeInTheDocument();
    expect(submitMutate).not.toHaveBeenCalled();
  });

  it("asks for the acknowledgements when the dates are fine", async () => {
    show();
    setDate(/Leave request start date/, "2027-03-01");
    setDate(/Leave request end date/, "2027-03-10");
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(
      await screen.findByText("Please acknowledge all the required checkboxes"),
    ).toBeInTheDocument();
    expect(submitMutate).not.toHaveBeenCalled();
  });

  it("confirms before sending anything", async () => {
    show();
    await fillValidRequest();
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(
      await screen.findByText("Do you want to submit this sabbatical leave?"),
    ).toBeInTheDocument();
    expect(submitMutate).not.toHaveBeenCalled();
  });

  it("names the lead the request goes to", async () => {
    show();
    await fillValidRequest();
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(
      await screen.findByText(
        /This will submit your sabbatical leave request for .* and send it to lead@wso2\.com for approval\./,
      ),
    ).toBeInTheDocument();
  });
});

// ApplyTab.tsx:275-298. SabbaticalApplicationRequest declares a
// lastSabbaticalLeaveEndDate field, but the submit is the ordinary POST /leaves
// and nothing sends it — the date travels inside the free-text comment, which is
// where the approver reads it.
describe("what actually gets submitted", () => {
  it("appends the last-sabbatical date to the comment", async () => {
    state.leaves = [{ id: 1, endDate: "2024-01-01T00:00:00Z" }];
    show();
    await fillValidRequest();
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    fireEvent.click(await screen.findByRole("button", { name: "Yes" }));

    await waitFor(() => expect(submitMutate).toHaveBeenCalled());
    expect(submitMutate.mock.calls[0][0]).toMatchObject({
      leaveType: "sabbatical",
      startDate: "2027-03-01",
      endDate: "2027-03-10",
      comment: " **** Last Sabbatical Leave End Date: 2024-01-01 ****",
    });
  });

  it("leaves the comment alone when there is no prior sabbatical", async () => {
    show();
    await fillValidRequest();
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    fireEvent.click(await screen.findByRole("button", { name: "Yes" }));

    await waitFor(() => expect(submitMutate).toHaveBeenCalled());
    expect(submitMutate.mock.calls[0][0].comment).toBe("");
  });
});

// SabbaticalLeave.tsx:36-43 and route.ts:77-78.
describe("who and when the screen is available", () => {
  it("is replaced wholesale when the feature flag is off", async () => {
    state.featureEnabled = false;
    show();
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(
      "Sabbatical  Leave Feature is currently not available. Please check again later.",
    );
    expect(screen.queryByRole("button", { name: "Apply" })).not.toBeInTheDocument();
  });

  it("is closed to a role the gate rejects", async () => {
    state.canSee = false;
    show();
    expect(await screen.findByText(/isn't available for your role/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Apply" })).not.toBeInTheDocument();
  });
});

// The source reaches these through separate routes (route.ts:73-127); One WSO2
// keeps one Sabbatical entry and gates tabs instead. The rules that decide what
// a person can reach are the same either way.
describe("the sabbatical tabs", () => {
  it("offers apply and my history to someone eligible", async () => {
    show();
    expect(await screen.findByRole("tab", { name: "Apply" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "My history" })).toBeInTheDocument();
  });

  it("opens on Apply", async () => {
    show();
    expect(await screen.findByRole("button", { name: "Apply" })).toBeInTheDocument();
  });

  it("shows no tabs at all to a role the gate rejects", async () => {
    state.canSee = false;
    show();
    expect(await screen.findByText(/isn't available for your role/)).toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });
});

// SabbaticalLeaveHistory.tsx:21-28 — the general history screen with the
// category swapped. What matters is that the swap actually reaches the request:
// a tab that rendered the same rows as the general page would look right and be
// wrong.
describe("the my-history tab", () => {
  it("asks only for sabbatical leave", async () => {
    show();
    fireEvent.click(await screen.findByRole("tab", { name: "My history" }));
    await waitFor(() => expect(leaveFilters.length).toBeGreaterThan(1));
    const historyFilter = leaveFilters.at(-1)!;
    expect(historyFilter.leaveCategory).toEqual(["sabbatical"]);
  });

  it("keeps the source's statuses and ordering", async () => {
    show();
    fireEvent.click(await screen.findByRole("tab", { name: "My history" }));
    await waitFor(() => expect(leaveFilters.length).toBeGreaterThan(1));
    const historyFilter = leaveFilters.at(-1)!;
    expect(historyFilter.statuses).toEqual(["APPROVED", "PENDING"]);
    expect(historyFilter.orderBy).toBe("DESC");
  });

  it("brings the year selector with it", async () => {
    show();
    fireEvent.click(await screen.findByRole("tab", { name: "My history" }));
    expect(await screen.findByText("Year")).toBeInTheDocument();
  });

  it("says so when there is no sabbatical on record", async () => {
    show();
    fireEvent.click(await screen.findByRole("tab", { name: "My history" }));
    expect(await screen.findByText(/No leave history available for/)).toBeInTheDocument();
  });
});

// route.ts:87,94,101 — approving is LEAD only, by the privilege number alone.
// The orphaned draft of this screen accepted `isLead`, the LEAD privilege OR
// `subordinateCount > 0`, which handed the approve queue to people the running
// app does not.
describe("who gets the approve tabs", () => {
  it("a lead does", async () => {
    state.isLead = true;
    show();
    expect(await screen.findByRole("tab", { name: "Approve" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Approval history" })).toBeInTheDocument();
  });

  it("a plain employee does not", async () => {
    show();
    await screen.findByRole("tab", { name: "Apply" });
    expect(screen.queryByRole("tab", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Approval history" })).not.toBeInTheDocument();
  });

  it("having reports without the privilege is not enough", async () => {
    state.subordinateCount = 12;
    show();
    await screen.findByRole("tab", { name: "Apply" });
    expect(screen.queryByRole("tab", { name: "Approve" })).not.toBeInTheDocument();
  });
});

describe("the approve tab", () => {
  it("asks for its own reports' pending sabbaticals", async () => {
    state.isLead = true;
    show();
    fireEvent.click(await screen.findByRole("tab", { name: "Approve" }));
    await waitFor(() => expect(leaveFilters.length).toBeGreaterThan(1));
    expect(leaveFilters.at(-1)).toMatchObject({
      subordinatesLeaves: true,
      leaveCategory: ["sabbatical"],
      statuses: ["PENDING"],
      orderBy: "DESC",
    });
  });

  it("asks only for decided requests on the history tab", async () => {
    state.isLead = true;
    show();
    fireEvent.click(await screen.findByRole("tab", { name: "Approval history" }));
    await waitFor(() => expect(leaveFilters.length).toBeGreaterThan(1));
    expect(leaveFilters.at(-1)).toMatchObject({
      subordinatesLeaves: true,
      leaveCategory: ["sabbatical"],
      statuses: ["APPROVED", "REJECTED"],
    });
  });
});

// ApproveLeaveTable.tsx:51-65,69-88. The team-share sentence is the whole point
// of the pre-dialog query: it tells the lead how much of their team is already
// booked to be away over the same dates. It is appended to the approve message
// and never to the reject one.
describe("deciding on a request", () => {
  const pendingRow = {
    id: 7,
    email: "report@wso2.com",
    startDate: "2027-03-01T00:00:00Z",
    endDate: "2027-03-20T00:00:00Z",
    numberOfDays: 20,
    approverEmail: "lead@wso2.com",
    status: "PENDING",
  };

  it("tells the lead what share of the team will be away", async () => {
    state.isLead = true;
    state.subordinateCount = 4;
    state.leaves = [pendingRow];
    show();
    fireEvent.click(await screen.findByRole("tab", { name: "Approve" }));
    fireEvent.click(await screen.findByRole("button", { name: "Approve" }));
    // One approved sabbatical returned for four reports = 25%.
    expect(
      await screen.findByText(
        "This will approve the sabbatical leave for report@wso2.com (2027-03-01 – 2027-03-20). 25% of your team will be on sabbatical during this period.",
      ),
    ).toBeInTheDocument();
  });

  it("leaves the share out of the reject message", async () => {
    state.isLead = true;
    state.subordinateCount = 4;
    state.leaves = [pendingRow];
    show();
    fireEvent.click(await screen.findByRole("tab", { name: "Approve" }));
    fireEvent.click(await screen.findByRole("button", { name: "Reject" }));
    expect(
      await screen.findByText(
        "This will reject the sabbatical leave request for report@wso2.com (2027-03-01 – 2027-03-20).",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/of your team will be on sabbatical/)).not.toBeInTheDocument();
  });

  it("sends the decision only after it is confirmed", async () => {
    state.isLead = true;
    state.subordinateCount = 4;
    state.leaves = [pendingRow];
    show();
    fireEvent.click(await screen.findByRole("tab", { name: "Approve" }));
    fireEvent.click(await screen.findByRole("button", { name: "Approve" }));
    expect(approveMutate).not.toHaveBeenCalled();

    fireEvent.click(await screen.findByRole("button", { name: "Yes, Approve" }));
    await waitFor(() => expect(approveMutate).toHaveBeenCalled());
    expect(approveMutate.mock.calls[0][0]).toEqual({ id: 7, action: "approve" });
  });
});
