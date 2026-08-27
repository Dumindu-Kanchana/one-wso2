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
import MyParPage from "./MyParPage";
import type { ParCycle, ParRating } from "../api/parTypes";

vi.mock("@asgardeo/react", () => ({
  useAsgardeo: () => ({ isSignedIn: true, signIn: vi.fn(), signOut: vi.fn() }),
}));
vi.mock("@hooks/useAsgardeoUser", () => ({
  useAsgardeoUser: () => ({ ready: true, email: "me@wso2.com", initials: "ME" }),
}));
vi.mock("../api/useParGate", () => ({
  useParGate: () => ({
    canSee: () => true,
    isAdmin: false,
    isTeamLead: false,
    isResolving: false,
    isError: false,
    retry: vi.fn(),
  }),
}));
vi.mock("../api/useParMe", () => ({
  isParBackendConfigured: () => true,
  useParMe: () => ({ data: { workEmail: "me@wso2.com", leadEmail: "lead@wso2.com" } }),
}));

const state = vi.hoisted(() => ({
  cycle: undefined as unknown,
  rating: undefined as unknown,
}));

const idle = { isPending: false, isError: false, error: null };
vi.mock("../api/useParEmployee", () => ({
  useMyParCycle: () => ({ ...idle, data: state.cycle }),
  useMyParRating: () => ({ ...idle, data: state.rating }),
  useMyReviewers: () => ({ ...idle, data: [] }),
  useMyReviewRequests: () => ({ ...idle, data: [] }),
  useMyThreeSixtyDraft: () => ({ ...idle, data: undefined }),
}));

const saveMutate = vi.fn();
vi.mock("../api/useParEmployeeMutations", () => ({
  useSaveMyPar: () => ({ mutate: saveMutate, isPending: false, isError: false, error: null }),
  useNominateReviewers: () => ({ mutate: vi.fn(), isPending: false, isError: false, error: null }),
  useSubmitThreeSixtyReview: () => ({ mutate: vi.fn(), isPending: false, isError: false, error: null }),
}));

vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showSuccess: vi.fn(), showError: vi.fn(), showWarning: vi.fn() }),
}));

const OPEN_CYCLE: ParCycle = {
  parCycleId: 7,
  parCycleName: "H1 2026",
  parCycleStatus: "OPEN",
  parCycleStartDate: "2026-01-01",
  parCycleEndDate: "2026-06-30",
  parEvaluationStartDate: "2026-06-01",
  parEvaluationEndDate: "2026-06-30",
  parEmployeeDeadline: "2099-06-30",
  parThreeSixtyRatingDeadline: "2099-07-07",
  parLeadDeadline: "2099-07-14",
  parF2FDeadline: "2099-07-28",
  parCycleConfigurations: {
    employeeParQuestion: "What did you deliver this cycle?",
    threeSixtyReviewQuestion: "How did they contribute?",
    parRatings: ["Successful"],
    threeSixtyReviewRatings: ["Strong"],
  },
};

function rating(over: Partial<ParRating> = {}): ParRating {
  return {
    parRatingId: 42,
    parCycleId: 7,
    parEmployeeEmail: "me@wso2.com",
    parEmployeeStatus: "DRAFT",
    parLeadStatus: "PENDING",
    parF2fStatus: "PENDING",
    parEmployeeComment: "<p>Shipped the gateway work.</p>",
    ...over,
  } as ParRating;
}

beforeEach(() => {
  saveMutate.mockClear();
  state.cycle = OPEN_CYCLE;
  state.rating = rating();
});

describe("when no cycle is open", () => {
  it("says so rather than showing an empty appraisal", () => {
    state.cycle = undefined;
    render(<MyParPage />);
    expect(screen.getByText(/no review cycle is open/i)).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Your review" })).toBeNull();
  });
});

describe("while the cycle is open and the deadline is ahead", () => {
  it("shows the cycle's own question, not a generic prompt", () => {
    render(<MyParPage />);
    expect(screen.getByText("What did you deliver this cycle?")).toBeInTheDocument();
  });

  it("offers an editable answer", () => {
    render(<MyParPage />);
    expect(screen.getByRole("textbox", { name: "Your review" })).toBeInTheDocument();
  });

  it("holds Save draft back until something changes", () => {
    render(<MyParPage />);
    expect(screen.getByRole("button", { name: /save draft/i })).toBeDisabled();
  });

  it("allows sharing an answer that already has content", () => {
    render(<MyParPage />);
    expect(screen.getByRole("button", { name: /share with lead/i })).toBeEnabled();
  });

  it("refuses to share nothing", () => {
    // Sharing is one-way, so an empty PAR shared by accident cannot be undone.
    state.rating = rating({ parEmployeeComment: "<p><br></p>" });
    render(<MyParPage />);
    expect(screen.getByRole("button", { name: /share with lead/i })).toBeDisabled();
  });
});

describe("sharing", () => {
  it("asks first, and says what it costs", async () => {
    render(<MyParPage />);
    await userEvent.setup().click(screen.getByRole("button", { name: /share with lead/i }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent(/won't be able to change it/i);
    // Asking is not doing.
    expect(saveMutate).not.toHaveBeenCalled();
  });

  it("sends the share only once confirmed", async () => {
    render(<MyParPage />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /share with lead/i }));
    await user.click(screen.getByRole("button", { name: "Share" }));

    expect(saveMutate).toHaveBeenCalledTimes(1);
    const args = saveMutate.mock.calls[0][0] as Record<string, unknown>;
    expect(args.share).toBe(true);
    expect(args.parRatingId).toBe(42);
  });
});

// Three different things lock the answer and they send the reader to three
// different places, so the message has to match the cause.
describe("when the answer is locked", () => {
  it("explains a share as one-way, and drops the editor", () => {
    state.rating = rating({ parEmployeeStatus: "SHARED" });
    render(<MyParPage />);
    expect(screen.getByText(/sharing is one-way/i)).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Your review" })).toBeNull();
    expect(screen.queryByRole("button", { name: /share with lead/i })).toBeNull();
  });

  it("still shows what was written", () => {
    state.rating = rating({ parEmployeeStatus: "SHARED" });
    render(<MyParPage />);
    expect(screen.getByText("Shipped the gateway work.")).toBeInTheDocument();
  });

  it("names the deadline when that is the reason, not the share", () => {
    state.cycle = { ...OPEN_CYCLE, parEmployeeDeadline: "2020-01-01" };
    render(<MyParPage />);
    expect(screen.getByText(/deadline for your part has passed/i)).toBeInTheDocument();
    expect(screen.queryByText(/sharing is one-way/i)).toBeNull();
  });

  it("names the closed cycle above every other reason", () => {
    state.cycle = { ...OPEN_CYCLE, parCycleStatus: "CLOSED", parEmployeeDeadline: "2020-01-01" };
    state.rating = rating({ parEmployeeStatus: "SHARED" });
    render(<MyParPage />);
    expect(screen.getByText(/this cycle is closed/i)).toBeInTheDocument();
  });
});
