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

vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));
vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));

const base = {
  txnDate: "2026-08-20",
  txnAmount: 500,
  expenseTypeId: 1,
  expenseCategoryLabel: "Travel",
  expenseTypeLabel: "Hotels",
  txnComment: "Client trip",
  receiptFileName: "r.pdf",
  contractFileName: null,
  subRegion: null,
  travelJobNumber: "JOB-1",
  productUnit: "Integration",
  businessUnit: "Platform",
  status: "submitted",
  financeApproverEmail: "fin@wso2.com",
  empPostedDate: "2026-08-21T00:00:00Z",
  leadApprovedDate: "2026-08-22T00:00:00Z",
  financeApprovedDate: "2026-08-23T00:00:00Z",
  reportSequenceNumber: "R-7",
};

const rows = [
  { ...base, id: 1, ccNumber: "1111", txnDescription: "Mine", employeeEmail: "me@wso2.com", leadEmail: "lead-a@wso2.com" },
  { ...base, id: 2, ccNumber: "2222", txnDescription: "Theirs", employeeEmail: "them@wso2.com", leadEmail: "lead-b@wso2.com, lead-a@wso2.com" },
  // Submitted, not yet approved by anyone, and on a card with no lead set.
  {
    ...base,
    id: 3,
    ccNumber: "1111",
    txnDescription: "Waiting",
    employeeEmail: "me@wso2.com",
    leadEmail: null,
    leadApprovedDate: null,
    financeApproverEmail: null,
    financeApprovedDate: null,
  },
];

const state = { access: ["lead"] as string[] };

vi.mock("../useCc", () => ({
  useCcUserInfo: () => ({
    data: { workEmail: "me@wso2.com", accessLevels: state.access },
    isLoading: false,
    isError: false,
  }),
  useCcTransactions: () => ({ data: rows, isLoading: false, isError: false }),
}));

vi.mock("../ccTypes", async () => {
  const actual = await vi.importActual<typeof import("../ccTypes")>("../ccTypes");
  return { ...actual, ccHasAccess: (_u: unknown, lvl: string) => state.access.includes(lvl) };
});

vi.mock("../../components/FinanceShell", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const { default: CcHistoryPage } = await import("./CcHistoryPage");
const { NotificationsProvider } = await import("@context/notifications/NotificationsContext");

beforeEach(() => {
  state.access = ["lead"];
});

function show() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <NotificationsProvider>
        <CcHistoryPage />
      </NotificationsProvider>
    </QueryClientProvider>,
  );
}

const pick = async (label: string, option: string) => {
  fireEvent.mouseDown(await screen.findByRole("combobox", { name: label }));
  fireEvent.click(await screen.findByRole("option", { name: option }));
};

// submission-history/index.tsx:74-76,142-156 — a lead or finance narrows by
// person, card and lead as well as status. The port had status alone, so
// finding one person's spend meant reading the whole table.
describe("narrowing the history", () => {
  it("offers the extra filters to someone who can see others", async () => {
    show();
    for (const l of ["User", "Card", "Lead"]) {
      expect(await screen.findByRole("combobox", { name: l })).toBeInTheDocument();
    }
  });

  it("offers none of them to a plain employee, whose list is already their own", async () => {
    state.access = [];
    show();
    await waitFor(() => expect(screen.getByText("Mine")).toBeInTheDocument());
    expect(screen.queryByRole("combobox", { name: "User" })).not.toBeInTheDocument();
    expect(screen.queryByText("Theirs")).not.toBeInTheDocument();
  });

  it("filters to one person", async () => {
    show();
    await pick("User", "them@wso2.com");
    await waitFor(() => expect(screen.queryByText("Mine")).not.toBeInTheDocument());
    expect(screen.getByText("Theirs")).toBeInTheDocument();
  });

  it("filters to one card", async () => {
    show();
    await pick("Card", "1111");
    await waitFor(() => expect(screen.queryByText("Theirs")).not.toBeInTheDocument());
  });

  it("matches a lead within a card's comma-separated list", async () => {
    show();
    // lead-a is the second of two leads on "Theirs" and the only one on "Mine".
    await pick("Lead", "lead-a@wso2.com");
    await waitFor(() => expect(screen.getByText("Mine")).toBeInTheDocument());
    expect(screen.getByText("Theirs")).toBeInTheDocument();

    await pick("Lead", "lead-b@wso2.com");
    await waitFor(() => expect(screen.queryByText("Mine")).not.toBeInTheDocument());
  });
});

// TransactionDetailsDialog.tsx. The port typed leadApprovedDate,
// financeApprovedDate, financeApproverEmail and reportSequenceNumber and
// rendered none of them, so there was no way to see who approved what, or when.
describe("what became of a transaction", () => {
  it("shows the approval trail", async () => {
    show();
    fireEvent.click((await screen.findAllByRole("button", { name: "Details" }))[0]);

    expect(await screen.findByText("Lead Approved Date")).toBeInTheDocument();
    expect(screen.getByText("Finance Approved Date")).toBeInTheDocument();
    expect(screen.getByText("fin@wso2.com")).toBeInTheDocument();
  });

  it("shows the categorisation the table has no room for", async () => {
    show();
    fireEvent.click((await screen.findAllByRole("button", { name: "Details" }))[0]);
    for (const label of ["Expense Category", "Job Number", "Product Unit", "Business Unit"]) {
      expect(await screen.findByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText("Integration")).toBeInTheDocument();
  });
});

// :232 — `leadEmail?.split(",")[0]`. The field is the card's comma-separated
// assigned-lead list, so showing it whole would name several people as having
// approved one transaction. :230-335 also distinguishes "never happened" from
// "not recorded", which a bare dash does not.
describe("the approval trail names one lead", () => {
  it("shows only the first assigned lead", async () => {
    show();
    // Row 2's card carries two leads.
    fireEvent.click((await screen.findAllByRole("button", { name: "Details" }))[1]);

    const label = await screen.findByText("Lead approver");
    const value = label.parentElement as HTMLElement;
    expect(value).toHaveTextContent("lead-b@wso2.com");
    expect(value).not.toHaveTextContent("lead-a@wso2.com");
  });

  it("says why a value is missing rather than showing a dash", async () => {
    show();
    // Row 3 has been submitted and approved by nobody.
    fireEvent.click((await screen.findAllByRole("button", { name: "Details" }))[2]);

    const dateLabel = await screen.findByText("Lead Approved Date");
    expect(dateLabel.parentElement).toHaveTextContent("(not approved)");
    expect(screen.getByText("Lead approver").parentElement).toHaveTextContent(
      "(not provided)",
    );
  });
});
