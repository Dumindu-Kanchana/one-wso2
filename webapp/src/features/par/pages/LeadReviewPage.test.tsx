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
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import LeadReviewPage from "./LeadReviewPage";
import type { ParCycle, ParRating } from "../api/parTypes";

vi.mock("@asgardeo/react", () => ({
  useAsgardeo: () => ({ isSignedIn: true, signIn: vi.fn(), signOut: vi.fn() }),
}));
vi.mock("@hooks/useAsgardeoUser", () => ({
  useAsgardeoUser: () => ({ ready: true, email: "lead@wso2.com", initials: "LE" }),
}));
vi.mock("@hooks/useSecureSignOut", () => ({ useSecureSignOut: () => vi.fn() }));
vi.mock("../api/useParMe", () => ({
  isParBackendConfigured: () => true,
  useParMe: () => ({ data: { workEmail: "lead@wso2.com" } }),
}));
vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showSuccess: vi.fn(), showError: vi.fn(), showWarning: vi.fn() }),
}));

const state = vi.hoisted(() => ({
  isTeamLead: true,
  cycle: undefined as unknown,
  rating: undefined as unknown,
  closedCycles: [] as unknown[],
}));

vi.mock("../api/useParGate", () => ({
  useParGate: () => ({
    canSee: () => state.isTeamLead,
    isAdmin: false,
    isTeamLead: state.isTeamLead,
    isResolving: false,
    isError: false,
    retry: vi.fn(),
  }),
}));

const idle = { isPending: false, isError: false, error: null };
vi.mock("../api/useParEmployee", () => ({
  useMyParCycle: () => ({ ...idle, data: state.cycle }),
}));
vi.mock("../api/useParHistory", () => ({
  useClosedCyclesFor: () => ({ ...idle, data: state.closedCycles }),
  useParRatingFor: () => ({ ...idle, data: undefined }),
}));

const saveMutate = vi.fn();
const f2fMutate = vi.fn();
vi.mock("../api/useParLead", () => ({
  useReportParRating: () => ({ ...idle, data: state.rating }),
  useReportThreeSixtyReviews: () => ({ ...idle, data: [] }),
  useSaveLeadReview: () => ({ mutate: saveMutate, isPending: false, isError: false, error: null }),
  useRecordF2f: () => ({ mutate: f2fMutate, isPending: false, isError: false, error: null }),
}));

const CYCLE = {
  parCycleId: 7,
  parCycleName: "H1 2026",
  parCycleStatus: "OPEN",
  parEmployeeDeadline: "2099-06-30",
  parThreeSixtyRatingDeadline: "2099-07-07",
  parLeadDeadline: "2099-07-14",
  parF2FDeadline: "2099-07-28",
  parCycleConfigurations: {
    employeeParQuestion: "q",
    threeSixtyReviewQuestion: "q",
    parRatings: ["Successful", "Needs Improvement"],
    threeSixtyReviewRatings: ["Strong"],
  },
} as unknown as ParCycle;

function rating(over: Partial<ParRating> = {}): ParRating {
  return {
    parRatingId: 42,
    parCycleId: 7,
    parEmployeeEmail: "ann@wso2.com",
    parEmployeeName: "Ann Perera",
    parEmployeeStatus: "SHARED",
    parLeadStatus: "DRAFT",
    parF2fStatus: "PENDING",
    parEmployeeComment: "<p>I shipped the gateway.</p>",
    parLeadComment: "<p>Strong cycle.</p>",
    // The eligible rating, so the Top 5% / 20% section is on screen by default.
    parRating: "Successful",
    ...over,
  } as ParRating;
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/me/par/team/ann%40wso2.com"]}>
      <Routes>
        <Route path="/me/par/team/:employeeEmail" element={<LeadReviewPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

const shareButton = () => screen.getByRole("button", { name: /share with them/i });

beforeEach(() => {
  saveMutate.mockClear();
  f2fMutate.mockClear();
  state.isTeamLead = true;
  state.cycle = CYCLE;
  state.rating = rating();
  state.closedCycles = [];
});

describe("the gate", () => {
  it("refuses someone who is not a team lead", () => {
    state.isTeamLead = false;
    renderPage();
    expect(screen.getByText(/isn't yours to open/i)).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Your feedback" })).toBeNull();
  });
});

describe("the report's identity", () => {
  it("decodes the email out of the URL", () => {
    renderPage();
    expect(screen.getByText("ann@wso2.com")).toBeInTheDocument();
  });

  it("says so when they have no PAR in this cycle", () => {
    state.rating = undefined;
    renderPage();
    expect(screen.getByText(/doesn't have a PAR in H1 2026/i)).toBeInTheDocument();
  });
});

describe("before the employee has shared theirs", () => {
  it("says why rather than offering an editor", () => {
    state.rating = rating({ parEmployeeStatus: "PENDING" });
    renderPage();
    expect(screen.getByText(/haven't shared their own PAR yet/i)).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Your feedback" })).toBeNull();
  });
});

describe("writing the review", () => {
  it("shows what the employee wrote alongside the editor", () => {
    // Stacked, not tabbed: the lead needs their words in front of them while
    // writing rather than one click away.
    renderPage();
    expect(screen.getByText("I shipped the gateway.")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Your feedback" })).toBeInTheDocument();
  });

  it("asks before sharing, and says it is one-way", async () => {
    renderPage();
    await userEvent.setup().click(shareButton());
    expect(screen.getByRole("dialog")).toHaveTextContent(/won't be able to change it/i);
    expect(saveMutate).not.toHaveBeenCalled();
  });

  it("shares only once confirmed", async () => {
    renderPage();
    const user = userEvent.setup();
    await user.click(shareButton());
    await user.click(screen.getByRole("button", { name: "Share" }));

    expect(saveMutate).toHaveBeenCalledTimes(1);
    const args = saveMutate.mock.calls[0][0] as Record<string, unknown>;
    expect(args.share).toBe(true);
    expect(args.employeeEmail).toBe("ann@wso2.com");
  });
});

// The two rating-conditional rules. Both block a one-way action, so both are
// checked here as well as in the predicate's own tests.
describe("the rating that demands evidence", () => {
  async function chooseNeedsImprovement() {
    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox", { name: "Rating" }));
    await user.click(await screen.findByRole("option", { name: "Needs Improvement" }));
    return user;
  }

  it("blocks the share until both halves are supplied", async () => {
    renderPage();
    await chooseNeedsImprovement();

    expect(shareButton()).toBeDisabled();
    expect(screen.getByText(/needs a confirmation .* and at least one supporting document/i)).toBeInTheDocument();
  });

  it("offers a paste field so a failed Drive consent is not a dead end", async () => {
    renderPage();
    await chooseNeedsImprovement();
    expect(screen.getByRole("textbox", { name: /paste a document link/i })).toBeInTheDocument();
  });

  it("still blocks with the confirmation ticked but nothing attached", async () => {
    renderPage();
    const user = await chooseNeedsImprovement();
    await user.click(screen.getByRole("checkbox", { name: /two performance discussions/i }));
    expect(shareButton()).toBeDisabled();
  });
});

describe("Top 5% / 20%", () => {
  it("is offered only for the eligible rating", () => {
    renderPage();
    expect(screen.getByRole("combobox", { name: /Top 5% \/ 20%/ })).toBeInTheDocument();
  });

  it("stays disabled until the decision is confirmed", async () => {
    renderPage();
    const selector = screen.getByRole("combobox", { name: /Top 5% \/ 20%/ });
    expect(selector).toHaveAttribute("aria-disabled", "true");

    await userEvent.setup().click(screen.getByRole("checkbox", { name: /functional lead/i }));
    expect(screen.getByRole("combobox", { name: /Top 5% \/ 20%/ })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("disappears when the rating no longer permits it", async () => {
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox", { name: "Rating" }));
    await user.click(await screen.findByRole("option", { name: "Needs Improvement" }));
    expect(screen.queryByRole("combobox", { name: /Top 5% \/ 20%/ })).toBeNull();
  });
});

describe("the face-to-face record", () => {
  it("is closed until the lead review is shared", () => {
    renderPage();
    expect(screen.getByText(/share your review first/i)).toBeInTheDocument();
  });

  it("opens once it is", () => {
    state.rating = rating({ parLeadStatus: "SHARED" });
    renderPage();
    expect(screen.getByRole("combobox", { name: "Status" })).toBeInTheDocument();
  });

  it("refuses to record a conversation with no date", async () => {
    state.rating = rating({ parLeadStatus: "SHARED" });
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox", { name: "Status" }));
    await user.click(await screen.findByRole("option", { name: "Held" }));

    expect(screen.getByRole("button", { name: /save record/i })).toBeDisabled();
    expect(screen.getByText(/pick a date to save this/i)).toBeInTheDocument();
    expect(f2fMutate).not.toHaveBeenCalled();
  });
});

// The shared panel takes its wording as data precisely so this reads from the
// lead's side rather than the employee's.
describe("the report's earlier cycles", () => {
  it("is shown as context, worded from the lead's side", () => {
    renderPage();
    expect(screen.getByText("Earlier cycles")).toBeInTheDocument();
    expect(screen.getByText(/they don't have any closed cycles yet/i)).toBeInTheDocument();
  });

  it("lists them when there are any", () => {
    state.closedCycles = [
      {
        parCycleId: 3,
        parCycleName: "H2 2025",
        parCycleStatus: "CLOSED",
        parCycleStartDate: "2025-07-01",
        parCycleEndDate: "2025-12-31",
      },
    ];
    renderPage();
    expect(screen.getByText("H2 2025")).toBeInTheDocument();
    expect(screen.getByText("1 Jul 2025 – 31 Dec 2025")).toBeInTheDocument();
  });
});

