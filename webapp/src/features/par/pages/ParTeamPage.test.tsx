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
import { MemoryRouter } from "react-router";
import ParTeamPage from "./ParTeamPage";
import type { ParTeam, ParTeamMember, ParTeamReport } from "../api/parTypes";

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

const state = vi.hoisted(() => ({
  isTeamLead: true,
  cycle: undefined as unknown,
  teams: [] as unknown[],
  report: undefined as unknown,
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
vi.mock("../api/useParTeams", () => ({
  useMyParTeams: () => ({ ...idle, data: state.teams }),
  useParTeamReport: () => ({ ...idle, data: state.report }),
}));

const CYCLE = {
  parCycleId: 7,
  parCycleName: "H1 2026",
  parCycleStatus: "OPEN",
  parThreeSixtyRatingDeadline: "2099-07-07",
};

function team(over: Partial<ParTeam> = {}): ParTeam {
  return {
    parTeamId: 1,
    parLeadEmail: "lead@wso2.com",
    parBusinessUnit: "Engineering",
    parDepartment: "Platform",
    parTeam: "Integration",
    parSubTeam: "Gateway",
    numberOfTeamMembers: 2,
    numberOf5pSlots: 1,
    numberOf20pSlots: 2,
    summary: {
      employeeParCompletedCount: 1,
      threeSixtyReviewCompletedCount: 0,
      leadsReviewCompletedCount: 0,
      f2fCompletedCount: 0,
    },
    ...over,
  } as ParTeam;
}

const MEMBERS: ParTeamMember[] = [
  {
    parRatingId: 11,
    parEmployeeEmail: "ann@wso2.com",
    parEmployeeName: "Ann Perera",
    parEmployeeStatus: "SHARED",
    parLeadStatus: "PENDING",
    parF2fStatus: "PENDING",
    par360ReviewStatus: "PENDING",
    par360ReviewCounts: { requestedReviewCount: 3, sharedReviewCount: 1 },
    parRating: "NOT_ASSIGNED",
  },
];

function report(over: Partial<ParTeamReport> = {}): ParTeamReport {
  return {
    ...team(),
    parCycleId: 7,
    available5pSlots: 1,
    available20pSlots: 0,
    details: MEMBERS,
    ...over,
  } as ParTeamReport;
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ParTeamPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  state.isTeamLead = true;
  state.cycle = CYCLE;
  state.teams = [team()];
  state.report = report();
});

// The screen reads other people's appraisals, so the gate is the first thing
// that has to hold.
describe("someone who is not a team lead", () => {
  it("is refused, and told it is not theirs rather than shown an error", () => {
    state.isTeamLead = false;
    renderPage();
    expect(screen.getByText(/isn't yours to open/i)).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });
});

describe("with no open cycle", () => {
  it("says so", () => {
    state.cycle = undefined;
    renderPage();
    expect(screen.getByText(/no review cycle is open/i)).toBeInTheDocument();
  });
});

describe("a team lead with no teams this cycle", () => {
  it("explains it without reading as a permission problem", () => {
    // They may have been assigned since the cycle opened — a real state, and
    // one an admin can fix by syncing.
    state.teams = [];
    renderPage();
    expect(screen.getByText(/don't have any teams in H1 2026/i)).toBeInTheDocument();
    expect(screen.queryByText(/isn't yours to open/i)).toBeNull();
  });
});

describe("with exactly one team", () => {
  it("opens it without asking, since there is nothing to choose", () => {
    renderPage();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.queryByText("Your teams")).toBeNull();
  });

  it("shows each member and where their PAR has got to", () => {
    renderPage();
    expect(screen.getByText("Ann Perera")).toBeInTheDocument();
    expect(screen.getByText("ann@wso2.com")).toBeInTheDocument();
    // Their own PAR is shared; the lead's review is not started.
    expect(screen.getByText("Shared")).toBeInTheDocument();
    expect(screen.getAllByText("Not started").length).toBeGreaterThan(0);
  });

  it("shows how many 360 reviews came back, not just that they are pending", () => {
    renderPage();
    expect(screen.getByText("1/3")).toBeInTheDocument();
  });

  it("reports quota REMAINING, which is what decides whether one can be awarded", () => {
    renderPage();
    expect(screen.getByText("Top 5%: 1 of 1 left")).toBeInTheDocument();
    expect(screen.getByText("Top 20%: 0 of 2 left")).toBeInTheDocument();
  });

  it("calls an unassigned rating an absence", () => {
    renderPage();
    expect(screen.queryByText(/NOT_ASSIGNED/)).toBeNull();
  });
});

describe("with several teams", () => {
  beforeEach(() => {
    state.teams = [team(), team({ parTeamId: 2, parSubTeam: "Registry" })];
  });

  it("asks which one, rather than guessing", () => {
    renderPage();
    expect(screen.getByText("Your teams")).toBeInTheDocument();
    expect(screen.getByText(/pick a team/i)).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("totals every team together above the picker", () => {
    // 2 members each, one PAR shared each.
    renderPage();
    expect(screen.getByText("4 people")).toBeInTheDocument();
    expect(screen.getByText("2 / 4")).toBeInTheDocument();
  });

  it("opens the team that was picked", async () => {
    renderPage();
    await userEvent.setup().click(screen.getByRole("button", { name: /Registry/ }));
    expect(screen.getByRole("table")).toBeInTheDocument();
  });
});

describe("an empty team", () => {
  it("shows no progress rather than a NaN bar", () => {
    // The source computed (completed * 100) / total, so 0 members gave NaN.
    state.teams = [
      team({
        numberOfTeamMembers: 0,
        summary: {
          employeeParCompletedCount: 0,
          threeSixtyReviewCompletedCount: 0,
          leadsReviewCompletedCount: 0,
          f2fCompletedCount: 0,
        },
      }),
    ];
    state.report = report({ details: [] });
    renderPage();

    expect(screen.getByText("0 people")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    for (const bar of screen.getAllByRole("progressbar")) {
      expect(bar.getAttribute("aria-valuenow")).not.toBe("NaN");
    }
    expect(screen.getByText(/no members in the current cycle/i)).toBeInTheDocument();
  });
});
