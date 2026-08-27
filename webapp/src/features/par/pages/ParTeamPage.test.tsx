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
vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({
    showSuccess: state.notify.success,
    showError: state.notify.error,
    showWarning: state.notify.warning,
  }),
}));
vi.mock("../api/useParMe", () => ({
  isParBackendConfigured: () => true,
  useParMe: () => ({ data: { workEmail: "lead@wso2.com" } }),
}));

const state = vi.hoisted(() => ({
  isTeamLead: true,
  cycle: undefined as unknown,
  teams: [] as unknown[],
  report: undefined as unknown,
  reports: [] as unknown[],
  reportsEnabled: [] as boolean[],
  allocation: [] as unknown[],
  allocationEnabled: [] as boolean[],
  chainLevels: {} as Record<string, unknown[]>,
  chainAsked: [] as string[],
  notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
  bulkResult: { succeeded: 0, failed: 0, reasons: [] as string[], failedEmails: [] as string[] },
  bulkArgs: [] as unknown[],
}));

vi.mock("../api/useParLead", () => ({
  useBulkShareLeadReviews: () => ({
    mutate: (args: unknown, opts?: { onSuccess?: (s: unknown) => void }) => {
      state.bulkArgs.push(args);
      opts?.onSuccess?.(state.bulkResult);
    },
    isPending: false,
  }),
  useSendThreeSixtyReminders: () => ({ mutate: vi.fn(), isPending: false }),
  useSyncEmployeeIntoCycle: () => ({ mutate: vi.fn(), isPending: false }),
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
vi.mock("../api/useParReports", () => ({
  useMyReports: (_cycleId: number | undefined, enabled: boolean) => {
    state.reportsEnabled.push(enabled);
    return { ...idle, data: state.reports };
  },
  // The chain browser asks per level; the stub answers from `chainLevels`,
  // keyed by whose reports were requested.
  useReportsFor: (_cycleId: number | undefined, leadEmail: string | undefined) => {
    state.chainAsked.push(leadEmail ?? "");
    return { ...idle, data: state.chainLevels[leadEmail ?? ""] ?? [] };
  },
}));
vi.mock("../api/useParAllocation", () => ({
  useMyQuotaAllocation: (_cycleId: number | undefined, enabled: boolean) => {
    state.allocationEnabled.push(enabled);
    return { ...idle, data: state.allocation };
  },
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

const INDIRECT = [
  {
    parRatingId: 91,
    parCycleId: 7,
    parEmployeeEmail: "deep@wso2.com",
    parEmployeeName: "Deep Silva",
    parEmployeeStatus: "DRAFT",
    parLeadStatus: "PENDING",
    reportingType: "Indirect",
    isEmployeeALead: "true",
    parDirectLead: "sub@wso2.com",
    parTeam: "Integration",
  },
  {
    parRatingId: 92,
    parCycleId: 7,
    parEmployeeEmail: "direct@wso2.com",
    parEmployeeName: "Dee Rect",
    parEmployeeStatus: "DRAFT",
    reportingType: "direct",
    isEmployeeALead: "False",
  },
];

const ALLOCATION = [
  {
    parQuotaId: 1,
    parSpecialQuotaName: "Platform pool",
    parTop5Quota: 2,
    parTop20Quota: 4,
    parBusinessUnit: "Engineering",
    parDepartment: "Platform",
    parTeam: "Integration",
  },
  {
    parQuotaId: 2,
    parSpecialQuotaName: "Small pool",
    parTop5Quota: 1,
    parTop20Quota: 0,
    parBusinessUnit: "Engineering",
    parDepartment: "Apps",
    parTeam: "Console",
  },
];

// lead@ -> Ann (a lead) and Bob (not); Ann -> Cid.
const CHAIN_LEVELS: Record<string, unknown[]> = {
  "lead@wso2.com": [
    {
      parRatingId: 1,
      parCycleId: 7,
      parEmployeeEmail: "ann@wso2.com",
      parEmployeeName: "Ann Perera",
      parEmployeeStatus: "SHARED",
      isEmployeeALead: "true",
    },
    {
      parRatingId: 2,
      parCycleId: 7,
      parEmployeeEmail: "bob@wso2.com",
      parEmployeeName: "Bob Silva",
      parEmployeeStatus: "DRAFT",
      isEmployeeALead: "False",
    },
  ],
  "ann@wso2.com": [
    {
      parRatingId: 3,
      parCycleId: 7,
      parEmployeeEmail: "cid@wso2.com",
      parEmployeeName: "Cid Fernando",
      parEmployeeStatus: "PENDING",
      isEmployeeALead: "False",
    },
  ],
};

beforeEach(() => {
  state.isTeamLead = true;
  state.cycle = CYCLE;
  state.teams = [team()];
  state.report = report();
  state.reports = INDIRECT;
  state.reportsEnabled = [];
  state.allocation = ALLOCATION;
  state.allocationEnabled = [];
  state.chainLevels = CHAIN_LEVELS;
  state.chainAsked = [];
  state.notify.success.mockClear();
  state.notify.error.mockClear();
  state.notify.warning.mockClear();
  state.bulkArgs = [];
  state.bulkResult = { succeeded: 1, failed: 0, reasons: [], failedEmails: [] };
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

// Tabs here, unlike the review screen: these are alternative lists of people,
// only one of which is read at a time.
describe("the additional-reports tab", () => {
  it("is offered alongside the lead's own team", () => {
    renderPage();
    expect(screen.getByRole("tab", { name: "My team" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Additional reports" })).toBeInTheDocument();
  });

  it("fetches nothing until it is opened", () => {
    // Most leads never look, and it is a whole reporting line.
    renderPage();
    expect(state.reportsEnabled.every((e) => e === false)).toBe(true);
  });

  it("fetches once opened", async () => {
    renderPage();
    await userEvent.setup().click(screen.getByRole("tab", { name: "Additional reports" }));
    expect(state.reportsEnabled.some((e) => e === true)).toBe(true);
  });

  it("lists only the indirect reports", async () => {
    renderPage();
    await userEvent.setup().click(screen.getByRole("tab", { name: "Additional reports" }));

    expect(screen.getByText("Deep Silva")).toBeInTheDocument();
    // A direct report belongs to the other tab, not this one.
    expect(screen.queryByText("Dee Rect")).toBeNull();
  });

  it("says who actually reviews them, which the reading lead does not", async () => {
    renderPage();
    await userEvent.setup().click(screen.getByRole("tab", { name: "Additional reports" }));
    expect(screen.getByText("Reviewed by sub@wso2.com")).toBeInTheDocument();
  });

  it("badges a report who is themselves a lead, whatever case the flag arrives in", async () => {
    // The source tested `=== "True"` exactly here, so a backend answering
    // "true" never showed this badge.
    renderPage();
    await userEvent.setup().click(screen.getByRole("tab", { name: "Additional reports" }));
    expect(screen.getByText("Lead")).toBeInTheDocument();
  });

  it("narrows on search, and restores when cleared", async () => {
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "Additional reports" }));

    const box = screen.getByLabelText("Search reports");
    await user.type(box, "zzz");
    expect(screen.getByText(/nobody here matches that/i)).toBeInTheDocument();

    await user.clear(box);
    expect(screen.getByText("Deep Silva")).toBeInTheDocument();
  });

  it("explains an empty line rather than showing a bare table", async () => {
    state.reports = [];
    renderPage();
    await userEvent.setup().click(screen.getByRole("tab", { name: "Additional reports" }));
    expect(screen.getByText(/nobody reports to you indirectly/i)).toBeInTheDocument();
  });
});

describe("the Top 5% / 20% tab", () => {
  const open = async () =>
    userEvent.setup().click(screen.getByRole("tab", { name: "Top 5% / 20%" }));

  it("fetches nothing until opened", () => {
    renderPage();
    expect(state.allocationEnabled.every((e) => e === false)).toBe(true);
  });

  it("groups teams under the quota pool they draw from", async () => {
    renderPage();
    await open();
    expect(screen.getByText("Platform pool")).toBeInTheDocument();
    expect(screen.getByText("Engineering · Platform · Integration")).toBeInTheDocument();
    expect(screen.getByText("Top 5%: 2")).toBeInTheDocument();
  });

  it("describes a 1-and-0 pool as one flexible slot", async () => {
    // Read literally it says "one Top 5%, no Top 20%", which tells a lead they
    // cannot award something they can.
    renderPage();
    await open();
    expect(screen.getByText("1 slot · Top 5% or Top 20%")).toBeInTheDocument();
    expect(screen.queryByText("Top 20%: 0")).toBeNull();
  });

  it("narrows teams without hiding the pool's own figures", async () => {
    renderPage();
    await open();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Search allocation"), "Console");

    // The matching pool stays, with its quota visible; the other goes.
    expect(screen.getByText("Small pool")).toBeInTheDocument();
    expect(screen.queryByText("Platform pool")).toBeNull();
  });

  it("explains an empty allocation", async () => {
    state.allocation = [];
    renderPage();
    await open();
    expect(screen.getByText(/no Top 5% \/ 20% quota has been allocated/i)).toBeInTheDocument();
  });
});

describe("the report-chain tab", () => {
  const open = async () =>
    userEvent.setup().click(screen.getByRole("tab", { name: "Report chain" }));

  it("starts at the signed-in lead", async () => {
    renderPage();
    await open();
    expect(screen.getByText("Ann Perera")).toBeInTheDocument();
    expect(screen.getByText("Bob Silva")).toBeInTheDocument();
  });

  it("offers a drill-down only for someone who has reports of their own", async () => {
    // A leaf drills into an empty level, which reads as the control being broken.
    renderPage();
    await open();
    expect(screen.getAllByRole("button", { name: /their team/i })).toHaveLength(1);
  });

  it("drills into the next level and shows the trail", async () => {
    renderPage();
    await open();
    await userEvent.setup().click(screen.getByRole("button", { name: /their team/i }));

    expect(screen.getByText("Cid Fernando")).toBeInTheDocument();
    expect(screen.queryByText("Bob Silva")).toBeNull();
    // The trail names where you came from and where you are.
    expect(screen.getByRole("button", { name: "You" })).toBeInTheDocument();
  });

  it("comes back up via the trail", async () => {
    renderPage();
    await open();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /their team/i }));
    await user.click(screen.getByRole("button", { name: "You" }));

    expect(screen.getByText("Bob Silva")).toBeInTheDocument();
    expect(screen.queryByText("Cid Fernando")).toBeNull();
  });

  it("says so when a level is empty rather than showing a bare table", async () => {
    state.chainLevels = { "lead@wso2.com": [] };
    renderPage();
    await open();
    expect(screen.getByText(/nobody reports to you in this cycle/i)).toBeInTheDocument();
  });
});

// One PATCH per person with no bulk endpoint, so partial success is normal
// rather than an edge case.
describe("bulk sharing", () => {
  it("is refused until something is selected", () => {
    renderPage();
    expect(screen.getByRole("button", { name: /share selected/i })).toBeDisabled();
    expect(screen.getByText(/select people to share or copy/i)).toBeInTheDocument();
  });

  it("is refused for a selection that is not all drafts", async () => {
    // Ann's lead review is PENDING, not DRAFT.
    renderPage();
    await userEvent.setup().click(screen.getByRole("checkbox", { name: /select ann perera/i }));

    expect(screen.getByRole("button", { name: /share selected/i })).toBeDisabled();
    expect(screen.getByText(/every review you select has to be a draft/i)).toBeInTheDocument();
  });

  it("shares a draft selection once confirmed, and says it is one at a time", async () => {
    state.report = report({
      details: [{ ...MEMBERS[0], parLeadStatus: "DRAFT" }],
    });
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole("checkbox", { name: /select ann perera/i }));
    await user.click(screen.getByRole("button", { name: /share selected/i }));

    expect(screen.getByRole("dialog")).toHaveTextContent(/one at a time/i);
    await user.click(screen.getByRole("button", { name: "Share" }));
    expect(state.bulkArgs).toHaveLength(1);
    expect(state.notify.success).toHaveBeenCalled();
  });

  it("reports a partial result in full rather than as success", async () => {
    state.report = report({ details: [{ ...MEMBERS[0], parLeadStatus: "DRAFT" }] });
    state.bulkResult = {
      succeeded: 3,
      failed: 2,
      reasons: ["Top 5% group is full"],
      failedEmails: ["x@wso2.com", "y@wso2.com"],
    };
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole("checkbox", { name: /select ann perera/i }));
    await user.click(screen.getByRole("button", { name: /share selected/i }));
    await user.click(screen.getByRole("button", { name: "Share" }));

    // Both halves, who failed, and why — none of it collapsed away.
    expect(state.notify.warning).toHaveBeenCalledWith("3 shared, 2 couldn't be");
    expect(screen.getByText(/not shared: x@wso2.com, y@wso2.com/i)).toBeInTheDocument();
    expect(screen.getByText("Top 5% group is full")).toBeInTheDocument();
  });

  it("selects and clears every member from the header", async () => {
    renderPage();
    const user = userEvent.setup();
    const all = screen.getByRole("checkbox", { name: /select every member/i });
    await user.click(all);
    expect(screen.getByText("1 selected")).toBeInTheDocument();
    await user.click(all);
    expect(screen.getByText(/select people to share or copy/i)).toBeInTheDocument();
  });
});

