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
import ParAdminPage from "./ParAdminPage";
import type { ParCycle } from "../api/parTypes";

vi.mock("@asgardeo/react", () => ({
  useAsgardeo: () => ({ isSignedIn: true, signIn: vi.fn(), signOut: vi.fn() }),
}));
vi.mock("@hooks/useAsgardeoUser", () => ({
  useAsgardeoUser: () => ({ ready: true, email: "admin@wso2.com", initials: "AD" }),
}));
vi.mock("@hooks/useSecureSignOut", () => ({ useSecureSignOut: () => vi.fn() }));
vi.mock("../api/useParMe", () => ({
  isParBackendConfigured: () => true,
  useParMe: () => ({ data: { workEmail: "admin@wso2.com" } }),
}));
vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showSuccess: vi.fn(), showError: vi.fn(), showWarning: vi.fn() }),
}));

const state = vi.hoisted(() => ({
  isAdmin: true,
  byStatus: {} as Record<string, unknown[]>,
  polled: [] as { status: string; poll: boolean }[],
}));

vi.mock("../api/useParGate", () => ({
  useParGate: () => ({
    canSee: () => state.isAdmin,
    isAdmin: state.isAdmin,
    isTeamLead: false,
    isResolving: false,
    isError: false,
    retry: vi.fn(),
  }),
}));

const idle = { isPending: false, isError: false, error: null };
vi.mock("../api/useParAdmin", () => ({
  useCyclesByStatus: (status: string, opts?: { pollWhileNonEmpty?: boolean }) => {
    state.polled.push({ status, poll: Boolean(opts?.pollWhileNonEmpty) });
    return { ...idle, data: state.byStatus[status] ?? [] };
  },
  useGlobalConfigurations: () => ({ ...idle, data: undefined }),
  useCreateParCycle: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateParCycle: () => ({ mutate: vi.fn(), isPending: false }),
  useSetParCycleStatus: () => ({ mutate: vi.fn(), isPending: false }),
  useAllCycleTeams: () => ({ ...idle, data: [] }),
  useCycleParRatings: () => ({ ...idle, data: [] }),
  useSendParReminder: () => ({ mutate: vi.fn(), isPending: false }),
  useUngroupedQuotaTeams: () => ({ ...idle, data: [] }),
  useSaveQuotaGroups: () => ({ mutate: vi.fn(), isPending: false }),
  PAR_REMINDER_LABELS: {
    employees: "Employees who haven't shared their PAR",
    leads: "Leads who haven't shared their review",
    specialRating: "Leads who haven't finalised Top 5% / 20%",
    threeSixty: "Colleagues who owe 360° feedback",
  },
  PENDING_POLL_MS: 10_000,
}));

const cycle = (over: Partial<ParCycle> = {}): ParCycle =>
  ({
    parCycleId: 7,
    parCycleName: "H1 2026",
    parCycleStatus: "OPEN",
    parCycleStartDate: "2026-01-01",
    parCycleEndDate: "2026-06-30",
    ...over,
  }) as ParCycle;

function renderPage() {
  return render(
    <MemoryRouter>
      <ParAdminPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  state.isAdmin = true;
  state.byStatus = {};
  state.polled = [];
});

// This screen creates cycles and closes them for the whole organisation, so the
// gate is the first thing that has to hold.
describe("the admin gate", () => {
  it("refuses a non-admin", () => {
    state.isAdmin = false;
    renderPage();
    expect(screen.getByText(/isn't yours to open/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /create a cycle/i })).toBeNull();
  });
});

// Ported branch order: open > quota-pending > pending > none.
describe("the state machine", () => {
  it("offers to create one when nothing is in flight", () => {
    renderPage();
    expect(screen.getByText(/no cycle in progress/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create a cycle/i })).toBeInTheDocument();
  });

  it("shows the org summary for an open cycle", () => {
    state.byStatus.OPEN = [cycle()];
    renderPage();
    expect(screen.getByText("H1 2026")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close cycle" })).toBeInTheDocument();
  });

  it("asks for quota when a cycle is waiting on it", () => {
    state.byStatus.PENDING_QUOTA = [cycle({ parCycleStatus: "PENDING_QUOTA" })];
    renderPage();
    expect(screen.getByText(/allocate quota/i)).toBeInTheDocument();
    // §9.4 said plainly, which the standalone app does not.
    expect(screen.getByText(/held in this browser until you save/i)).toBeInTheDocument();
  });

  it("reports the creation job, and warns what a silent stop means", () => {
    state.byStatus.PENDING = [cycle({ parCycleStatus: "PENDING" })];
    renderPage();
    expect(screen.getByText(/re-checks every ten seconds/i)).toBeInTheDocument();
    // §9.3 carried forward: a failed job leaves the slot occupied.
    expect(screen.getByText(/the job failed/i)).toBeInTheDocument();
  });

  it("prefers the open cycle when several statuses are non-empty", () => {
    state.byStatus.OPEN = [cycle()];
    state.byStatus.PENDING_QUOTA = [cycle({ parCycleId: 8 })];
    state.byStatus.PENDING = [cycle({ parCycleId: 9 })];
    renderPage();
    expect(screen.getByRole("button", { name: "Close cycle" })).toBeInTheDocument();
    expect(screen.queryByText(/allocate quota/i)).toBeNull();
  });
});

describe("the pending poll", () => {
  it("is asked for on PENDING and on nothing else", () => {
    renderPage();
    const polling = state.polled.filter((p) => p.poll).map((p) => p.status);
    expect(polling).toEqual(["PENDING"]);
  });
});

describe("closing a cycle", () => {
  it("asks first, and says it cannot be reopened here", async () => {
    state.byStatus.OPEN = [cycle()];
    renderPage();
    await userEvent.setup().click(screen.getByRole("button", { name: "Close cycle" }));
    expect(screen.getByRole("dialog")).toHaveTextContent(/cannot be reopened/i);
  });
});

describe("creating a cycle", () => {
  it("opens the form, which will not submit while empty", async () => {
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /create a cycle/i }));

    expect(screen.getByRole("textbox", { name: "The employee's question" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /create cycle/i }));
    expect(screen.getByText(/fields need attention/i)).toBeInTheDocument();
  });
});

describe("the history tab", () => {
  it("lists closed cycles", async () => {
    state.byStatus.CLOSED = [cycle({ parCycleStatus: "CLOSED", parCycleName: "H2 2025" })];
    renderPage();
    await userEvent.setup().click(screen.getByRole("tab", { name: "History" }));
    expect(screen.getByText("H2 2025")).toBeInTheDocument();
  });

  it("says so when nothing has closed", async () => {
    renderPage();
    await userEvent.setup().click(screen.getByRole("tab", { name: "History" }));
    expect(screen.getByText(/no cycle has been closed yet/i)).toBeInTheDocument();
  });
});
