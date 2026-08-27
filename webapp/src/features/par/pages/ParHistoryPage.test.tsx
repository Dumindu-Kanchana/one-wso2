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
import ParHistoryPage from "./ParHistoryPage";
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
  useParMe: () => ({ data: { workEmail: "me@wso2.com" } }),
}));

const state = vi.hoisted(() => ({
  cycles: [] as unknown[],
  rating: undefined as unknown,
  ratingCalls: [] as unknown[],
}));

const idle = { isPending: false, isError: false, error: null };
vi.mock("../api/useParHistory", () => ({
  useMyClosedCycles: () => ({ ...idle, data: state.cycles }),
  useMyParRatingFor: (id: number | undefined, enabled: boolean) => {
    state.ratingCalls.push({ id, enabled });
    return { ...idle, data: state.rating };
  },
}));

function cycle(over: Partial<ParCycle> = {}): ParCycle {
  return {
    parCycleId: 1,
    parCycleName: "H1 2025",
    parCycleStatus: "CLOSED",
    parCycleStartDate: "2025-01-01",
    parCycleEndDate: "2025-06-30",
    parEvaluationStartDate: "2025-06-01",
    parEvaluationEndDate: "2025-06-30",
    parEmployeeDeadline: "2025-06-15",
    parThreeSixtyRatingDeadline: "2025-06-20",
    parLeadDeadline: "2025-06-25",
    parF2FDeadline: "2025-06-28",
    ...over,
  } as ParCycle;
}

function rating(over: Partial<ParRating> = {}): ParRating {
  return {
    parRatingId: 5,
    parCycleId: 1,
    parEmployeeEmail: "me@wso2.com",
    parEmployeeStatus: "SHARED",
    parLeadStatus: "SHARED",
    parF2fStatus: "COMPLETED",
    parEmployeeComment: "<p>I shipped the gateway.</p>",
    parLeadComment: "<p>Strong cycle.</p>",
    parRating: "Successful",
    ...over,
  } as ParRating;
}

beforeEach(() => {
  state.cycles = [cycle()];
  state.rating = rating();
  state.ratingCalls = [];
});

describe("with no closed cycles", () => {
  it("explains rather than showing an empty table", () => {
    state.cycles = [];
    render(<ParHistoryPage />);
    expect(screen.getByText(/don't have any closed cycles yet/i)).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });
});

describe("the list of closed cycles", () => {
  it("lists each cycle with its period", () => {
    render(<ParHistoryPage />);
    expect(screen.getByText("H1 2025")).toBeInTheDocument();
    expect(screen.getByText("1 Jan 2025 – 30 Jun 2025")).toBeInTheDocument();
  });

  it("fetches no appraisal until one is opened", () => {
    // A person with several years of cycles would otherwise fetch every
    // appraisal to render a table that shows none of them.
    render(<ParHistoryPage />);
    expect(state.ratingCalls.filter((c) => (c as { enabled: boolean }).enabled)).toHaveLength(0);
  });
});

describe("opening a cycle", () => {
  it("shows both sides of the appraisal", async () => {
    render(<ParHistoryPage />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Open" }));

    expect(screen.getByText("I shipped the gateway.")).toBeInTheDocument();
    expect(screen.getByText("Strong cycle.")).toBeInTheDocument();
  });

  it("shows the rating awarded", async () => {
    render(<ParHistoryPage />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByText("Rating: Successful")).toBeInTheDocument();
  });

  it("calls an unassigned rating an absence, not a value", async () => {
    // "NOT_ASSIGNED" is the backend saying no rating was given.
    state.rating = rating({ parRating: "NOT_ASSIGNED" });
    render(<ParHistoryPage />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Open" }));

    expect(screen.getByText("No rating recorded")).toBeInTheDocument();
    expect(screen.queryByText(/NOT_ASSIGNED/)).toBeNull();
  });

  it("says so when a side wrote nothing, rather than leaving a blank", async () => {
    state.rating = rating({ parLeadComment: "" });
    render(<ParHistoryPage />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByText(/lead didn't leave written feedback/i)).toBeInTheDocument();
  });

  it("reports the conversation alongside the two shares", async () => {
    // "Shared" on its own says nothing about whether the conversation happened.
    render(<ParHistoryPage />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByText(/Conversation: Completed/)).toBeInTheDocument();
  });

  it("closes again", async () => {
    render(<ParHistoryPage />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Open" }));
    await user.click(screen.getByRole("button", { name: "Hide" }));
    expect(screen.queryByText("I shipped the gateway.")).toBeNull();
  });
});

describe("a cycle with no appraisal recorded", () => {
  it("says so instead of rendering empty sections", async () => {
    state.rating = undefined;
    render(<ParHistoryPage />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByText(/no appraisal was recorded/i)).toBeInTheDocument();
  });
});
