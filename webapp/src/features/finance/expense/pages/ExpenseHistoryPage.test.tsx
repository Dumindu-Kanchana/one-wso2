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

vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));
vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));

const line = {
  date: "2026-08-10",
  amount: 40,
  currency: "USD",
  currencyConversionRate: 300,
  reimbursementAmount: 12000,
  reimbursementCurrency: "LKR",
  expenseTypeId: 3,
  expenseType: "Taxi",
  comment: "Airport transfer",
  receiptUrl: "r1.pdf",
  travelJobNumber: "JOB-1",
};

const state = { status: "LEAD_REJECTED" as string };

// Every search payload the screen asks for, so filter assertions are about what
// reaches the backend rather than what renders.
const payloads: Record<string, unknown>[] = [];

const claimOf = () => ({
  id: "EC-7",
  createdDate: "2026-08-11T00:00:00Z",
  employeeEmail: "me@wso2.com",
  totalAmount: 12000,
  currencyCode: "LKR",
  leadEmails: ["lead@wso2.com"],
  statusDetails: {
    status: state.status,
    leadApprovedDate: null,
    leadRejectedDate: "2026-08-12T00:00:00Z",
    leadRejectedReason: "Missing detail",
    financeApproverEmail: null,
    financeApprovedDate: null,
    financeRejectedDate: null,
  },
  transactions: [line],
});

vi.mock("../useExpense", () => ({
  useExpenseAppData: () => ({
    data: {
      userInfo: { workEmail: "me@wso2.com", firstName: "Me", lastName: "M", managerEmail: "lead@wso2.com" },
      enableLeadView: false,
      enableFinanceView: false,
      currencyCode: "LKR",
      countryCode: "LK",
      travels: [{ jobNumber: "JOB-1", customerName: null, engagementCode: null, country: null, productUnit: null, businessUnit: null }],
      draft: null,
      pastDateRestrictionDays: 30,
    },
    isLoading: false,
    isError: false,
    isSuccess: true,
  }),
  useExpenseClaims: (payload: Record<string, unknown>) => {
    payloads.push(payload);
    return { data: [claimOf()], isLoading: false, isError: false, isSuccess: true };
  },
  useExpenseTypes: () => ({ data: [{ id: 3, type: "Taxi" }], isLoading: false, isError: false }),
  useExchangeRates: () => ({ data: [{ currencyCode: "USD", exchangeRate: 300 }], isLoading: false, isError: false }),
  useExpenseEmployees: () => ({ data: [], isLoading: false, isError: false }),
}));

const resubmitMutate = vi.fn();
vi.mock("../useExpenseMutations", () => ({
  useExpenseClaimStatus: () => ({ mutate: vi.fn(), isPending: false }),
  useResubmitExpenseClaim: () => ({ mutate: resubmitMutate, isPending: false }),
  useExpenseReceiptUpload: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("../../components/FinanceShell", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const { default: ExpenseHistoryPage } = await import("./ExpenseHistoryPage");
const { NotificationsProvider } = await import("@context/notifications/NotificationsContext");

beforeEach(() => {
  resubmitMutate.mockClear();
  payloads.length = 0;
  state.status = "LEAD_REJECTED";
});

function show() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <NotificationsProvider>
        <ExpenseHistoryPage />
      </NotificationsProvider>
    </QueryClientProvider>,
  );
}

const open = async () => fireEvent.click(await screen.findByRole("button", { name: "View" }));

// ClaimDetails.tsx:120-128,224-231,379-390. A rejected expense claim is
// corrected and resubmitted under its own id (PUT /claims/{id}/transactions).
// The port had no path at all — a rejection meant re-entering every line, with
// its job number, expense type, currency and receipt.
describe("resubmitting a rejected claim", () => {
  it("is offered on a lead-rejected claim", async () => {
    show();
    await open();
    expect(await screen.findByRole("button", { name: "Resubmit" })).toBeInTheDocument();
  });

  it("is offered on a finance-rejected claim", async () => {
    state.status = "FINANCE_REJECTED";
    show();
    await open();
    expect(await screen.findByRole("button", { name: "Resubmit" })).toBeInTheDocument();
  });

  it("is not offered on an approved claim", async () => {
    state.status = "APPROVED";
    show();
    await open();
    await screen.findByRole("button", { name: "Close" });
    expect(screen.queryByRole("button", { name: "Resubmit" })).not.toBeInTheDocument();
  });

  it("says so when nothing was changed", async () => {
    show();
    await open();
    fireEvent.click(await screen.findByRole("button", { name: "Resubmit" }));
    expect(
      await screen.findByText(
        "You haven't changed any claim items. Are you sure you want to resubmit?",
      ),
    ).toBeInTheDocument();
    expect(resubmitMutate).not.toHaveBeenCalled();
  });

  it("sends the claim's own id and its lines once confirmed", async () => {
    show();
    await open();
    fireEvent.click(await screen.findByRole("button", { name: "Resubmit" }));
    const dialog = await screen.findByText("Claim Resubmission Confirmation");
    expect(dialog).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Resubmit" }).at(-1)!);

    await waitFor(() => expect(resubmitMutate).toHaveBeenCalled());
    const [payload] = resubmitMutate.mock.calls[0];
    // Its own id — this amends the claim, it does not start a new one.
    expect(payload.id).toBe("EC-7");
    // The trimmed payload: no derived reimbursement figures or expenseType.
    expect(payload.transactions).toEqual([
      {
        date: "2026-08-10",
        amount: 40,
        currency: "USD",
        expenseTypeId: 3,
        comment: "Airport transfer",
        receiptUrl: "r1.pdf",
        travelJobNumber: "JOB-1",
      },
    ]);
  });

  it("does nothing when the confirmation is dismissed", async () => {
    show();
    await open();
    fireEvent.click(await screen.findByRole("button", { name: "Resubmit" }));
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(screen.queryByText("Claim Resubmission Confirmation")).not.toBeInTheDocument(),
    );
    expect(resubmitMutate).not.toHaveBeenCalled();
  });
});

// ClaimDetails.tsx:174,399-400 — corrections are held locally until the claim
// is resubmitted, so closing with unsaved ones is confirmed rather than silent.
describe("correcting a line before resubmitting", () => {
  it("offers an edit control only while resubmission is possible", async () => {
    show();
    await open();
    expect(await screen.findByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  it("offers none on a claim that cannot be resubmitted", async () => {
    state.status = "APPROVED";
    show();
    await open();
    await screen.findByRole("button", { name: "Close" });
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("sends the corrected amount, not the original", async () => {
    show();
    await open();
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    fireEvent.change(await screen.findByDisplayValue("40"), { target: { value: "55" } });
    fireEvent.click(screen.getByRole("button", { name: "Save expense" }));

    fireEvent.click(await screen.findByRole("button", { name: "Resubmit" }));
    // The wording drops the "you haven't changed anything" hedge.
    expect(
      await screen.findByText("Are you sure you want to resubmit the claim?"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Resubmit" }).at(-1)!);

    await waitFor(() => expect(resubmitMutate).toHaveBeenCalled());
    expect(resubmitMutate.mock.calls[0][0].transactions[0].amount).toBe(55);
  });

  it("confirms before discarding unsaved corrections", async () => {
    show();
    await open();
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    fireEvent.change(await screen.findByDisplayValue("40"), { target: { value: "55" } });
    fireEvent.click(screen.getByRole("button", { name: "Save expense" }));

    fireEvent.click(await screen.findByRole("button", { name: "Close" }));
    expect(await screen.findByText("Edit Discard Confirmation")).toBeInTheDocument();
  });

  it("closes straight away when nothing was changed", async () => {
    show();
    await open();
    fireEvent.click(await screen.findByRole("button", { name: "Close" }));
    await waitFor(() =>
      expect(screen.queryByText("Edit Discard Confirmation")).not.toBeInTheDocument(),
    );
  });
});

// FilterHolder.tsx:175-178,249 and tableSlice.ts:46-51. The port offered only
// the period, so a claim of a known id or status could not be singled out.
describe("what the history screen filters on", () => {
  it("defaults to the latest 100 with no date bounds", async () => {
    show();
    await waitFor(() => expect(payloads.length).toBeGreaterThan(0));
    const p = payloads.at(-1)!;
    expect(p.limit).toBe(100);
    expect(p.startDate).toBeUndefined();
    expect(p.endDate).toBeUndefined();
  });

  it("sends no status or id until asked", async () => {
    show();
    await waitFor(() => expect(payloads.length).toBeGreaterThan(0));
    expect(payloads.at(-1)!.status).toBeUndefined();
    expect(payloads.at(-1)!.ids).toBeUndefined();
  });

  it("filters by status", async () => {
    show();
    fireEvent.mouseDown(await screen.findByLabelText("Status"));
    fireEvent.click(await screen.findByRole("option", { name: "Lead Rejected" }));
    await waitFor(() => expect(payloads.at(-1)!.status).toEqual(["LEAD_REJECTED"]));
  });

  it("sends a claim id as a one-element list, trimmed", async () => {
    show();
    fireEvent.change(await screen.findByLabelText("Filter by claim ID"), {
      target: { value: " EC-7 " },
    });
    await waitFor(() => expect(payloads.at(-1)!.ids).toEqual(["EC-7"]));
  });

  it("keeps the period alongside the other filters", async () => {
    show();
    fireEvent.change(await screen.findByLabelText("Filter by claim ID"), {
      target: { value: "EC-7" },
    });
    await waitFor(() => expect(payloads.at(-1)!.ids).toEqual(["EC-7"]));
    expect(payloads.at(-1)!.limit).toBe(100);
  });
});
