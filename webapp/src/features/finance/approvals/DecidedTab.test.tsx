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
import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// The decided list. Same three queues as Needs you, so the same disabled-query
// trap applies: a role this person lacks leaves its query pending for good.

const iso = (y: number, m: number, d: number, h = 9) => new Date(y, m, d, h).toISOString();

const flags = { lead: true, finance: true, opd: true };
const searches: { expense: Record<string, unknown>[]; opd: Record<string, unknown>[] } = {
  expense: [],
  opd: [],
};
const data = {
  lead: [] as unknown[],
  finance: [] as unknown[],
  opd: [] as unknown[],
  expenseFails: false,
  opdFails: false,
  appDataFails: false,
};

vi.mock("../expense/useExpense", () => ({
  useExpenseAppData: () => ({
    data: {
      userInfo: { workEmail: "me@wso2.com" },
      get enableLeadView() {
        return flags.lead;
      },
      get enableFinanceView() {
        return flags.finance;
      },
    },
    isPending: false,
    isLoading: false,
    isError: data.appDataFails,
    error: new Error("expense app-data down"),
  }),
  useExpenseClaims: (payload: Record<string, unknown>, enabled = true) => {
    if (enabled) searches.expense.push(payload);
    const isLead = Array.isArray(payload.status) && payload.status[0] === "PENDING_LEAD";
    return {
      data: !enabled ? [] : isLead ? data.lead : data.finance,
      // As React Query reports a DISABLED query: it never fetches, so it stays
      // `pending` forever while `isLoading` — pending AND fetching — is false.
      // Hardcoding `isPending: false` here is what let a screen that waits on
      // the wrong flag pass its tests and spin in the browser.
      isPending: !enabled,
      isLoading: false,
      isError: data.expenseFails && enabled,
      error: new Error("expense backend down"),
    };
  },
}));

vi.mock("../opd/useOpd", () => ({
  useOpdUserInfo: () => ({
    data: { userRoles: flags.opd ? [555] : [444] },
    isPending: false,
    isLoading: false,
  }),
  useOpdClaims: (payload: Record<string, unknown>, enabled = true) => {
    if (enabled) searches.opd.push(payload);
    return {
      data: enabled ? data.opd : [],
      isPending: !enabled,
      isLoading: false,
      isError: data.opdFails && enabled,
      error: new Error("opd backend down"),
    };
  },
}));

vi.mock("../expense/ExpenseClaimDetailsDialog", () => ({
  ExpenseClaimDetailsDialog: ({ claim }: { claim: unknown }) =>
    claim ? <div data-testid="expense-dialog" /> : null,
}));
vi.mock("../opd/OpdClaimDetailsDialog", () => ({
  OpdClaimDetailsDialog: ({ claim }: { claim: unknown }) =>
    claim ? <div data-testid="opd-dialog" /> : null,
}));

const { default: DecidedTab } = await import("./DecidedTab");

const expenseClaim = (over: Record<string, unknown>) => ({
  id: "EXP-1",
  transactions: [],
  totalAmount: 100,
  currencyCode: "USD",
  employeeEmail: "kasun@wso2.com",
  leadEmails: [],
  createdDate: iso(2026, 7, 20),
  statusDetails: {
    status: "APPROVED",
    leadApprovedDate: iso(2026, 7, 22),
    financeApprovedDate: iso(2026, 7, 24),
    financeApproverEmail: "fin@wso2.com",
    financeRejectedDate: null,
    leadRejectedDate: null,
  },
  ...over,
});

const opdClaim = (over: Record<string, unknown>) => ({
  id: "OPD-1",
  transactions: [{}],
  employeeEmail: "dilani@wso2.com",
  totalAmount: 8750,
  createdDate: iso(2026, 7, 15),
  statusDetails: {
    status: "APPROVED",
    financeApprovedDate: iso(2026, 7, 18),
    financeApproverEmail: "fin@wso2.com",
    financeRejectedDate: null,
  },
  ...over,
});

beforeEach(() => {
  flags.lead = true;
  flags.finance = true;
  flags.opd = true;
  searches.expense.length = 0;
  searches.opd.length = 0;
  data.lead = [];
  data.finance = [];
  data.opd = [];
  data.expenseFails = false;
  data.opdFails = false;
  data.appDataFails = false;
});

const show = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <DecidedTab />
    </QueryClientProvider>,
  );

// The bug this file exists for: a queue disabled because the person lacks that
// role stays `pending` in React Query, so a screen waiting on `isPending` never
// leaves its skeleton.
describe("when a role is missing", () => {
  it("renders for someone who only approves OPD", async () => {
    flags.lead = false;
    flags.finance = false;
    data.opd = [opdClaim({})];
    show();
    expect(await screen.findByText("OPD-1")).toBeInTheDocument();
  });

  it("renders for someone who only approves expense claims", async () => {
    flags.opd = false;
    data.finance = [expenseClaim({})];
    show();
    expect(await screen.findByText("EXP-1")).toBeInTheDocument();
  });

  it("reaches the empty state rather than spinning", async () => {
    flags.lead = false;
    flags.finance = false;
    show();
    expect(await screen.findByText("Nothing has been decided yet.")).toBeInTheDocument();
  });
});

describe("what it asks for", () => {
  it("asks finance for the claims it settled", () => {
    flags.lead = false;
    flags.opd = false;
    show();
    expect(searches.expense.at(-1)?.status).toEqual(["APPROVED", "FINANCE_REJECTED"]);
  });

  // A lead who is not also finance sees what they passed on or turned down,
  // scoped to their own reports the way their pending queue is.
  it("asks a lead for their own reports, including what finance did next", () => {
    flags.finance = false;
    flags.opd = false;
    show();
    expect(searches.expense.at(-1)).toMatchObject({ leadEmail: "me@wso2.com" });
    expect(searches.expense.at(-1)?.status).toContain("PENDING_FINANCE");
  });

  // Holding both, the finance queue already covers everything they settled, so
  // asking the lead queue too would list the same claims twice.
  it("asks once, not twice, of someone holding both flags", () => {
    show();
    expect(searches.expense).toHaveLength(1);
    expect(searches.expense[0].status).toEqual(["APPROVED", "FINANCE_REJECTED"]);
  });

  it("asks OPD for settled claims only", () => {
    show();
    expect(searches.opd.at(-1)?.status).toEqual(["APPROVED", "REJECTED"]);
  });
});

describe("what it shows", () => {
  it("names who decided, where the backend records it", async () => {
    data.opd = [opdClaim({})];
    show();
    const row = (await screen.findByText("OPD-1")).closest("tr")!;
    expect(within(row).getByText("fin@wso2.com")).toBeInTheDocument();
  });

  // The lead side records dates but no approver, so naming one would be a
  // guess. A dash says "not recorded" rather than inventing a name.
  it("shows a dash where no approver was recorded", async () => {
    data.finance = [
      expenseClaim({
        id: "EXP-LEADONLY",
        statusDetails: {
          status: "PENDING_FINANCE",
          leadApprovedDate: iso(2026, 7, 22),
          financeApproverEmail: null,
          financeApprovedDate: null,
          financeRejectedDate: null,
          leadRejectedDate: null,
        },
      }),
    ];
    show();
    const row = (await screen.findByText("EXP-LEADONLY")).closest("tr")!;
    expect(within(row).getByText("—")).toBeInTheDocument();
    expect(within(row).getByText("Sent to finance")).toBeInTheDocument();
  });

  it("distinguishes an approval from a rejection", async () => {
    data.opd = [
      opdClaim({ id: "OPD-NO", statusDetails: { status: "REJECTED", financeRejectedDate: iso(2026, 7, 18), financeApproverEmail: "fin@wso2.com", financeApprovedDate: null } }),
    ];
    show();
    const row = (await screen.findByText("OPD-NO")).closest("tr")!;
    expect(within(row).getByText("Rejected")).toBeInTheDocument();
  });

  it("keeps the queue that loaded when the other backend is down", async () => {
    data.opdFails = true;
    data.finance = [expenseClaim({ id: "EXP-OK" })];
    show();
    expect(await screen.findByText("EXP-OK")).toBeInTheDocument();
    expect(screen.getByText(/couldn't be loaded/)).toBeInTheDocument();
  });
});


// Same trap as Needs you: the call that decides which queues run. When it fails
// the flags read false, the queues are disabled rather than failing, and a
// disabled query reports no error — so the screen would say nothing had been
// decided when nothing had loaded.
describe("when the call that decides the queues fails", () => {
  it("says something failed rather than reporting an empty list", async () => {
    data.appDataFails = true;
    show();
    expect(await screen.findByText(/couldn't be loaded/)).toBeInTheDocument();
    expect(screen.queryByText("Nothing has been decided yet.")).not.toBeInTheDocument();
  });
});
