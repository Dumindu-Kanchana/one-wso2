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

const payloads: Record<string, unknown>[] = [];

vi.mock("../useExpense", () => ({
  useExpenseAppData: () => ({
    data: {
      userInfo: { workEmail: "approver@wso2.com", firstName: "A", lastName: "B" },
      enableLeadView: true,
      enableFinanceView: true,
      currencyCode: "LKR",
      countryCode: "LK",
      travels: [],
      draft: null,
      pastDateRestrictionDays: 30,
    },
    isLoading: false,
    isError: false,
    isSuccess: true,
  }),
  useExpenseClaims: (payload: Record<string, unknown>) => {
    payloads.push(payload);
    return { data: [], isLoading: false, isError: false, isSuccess: true };
  },
  useExpenseEmployees: () => ({ data: [], isLoading: false, isError: false }),
}));

vi.mock("../useExpenseMutations", () => ({
  useExpenseClaimStatus: () => ({ mutate: vi.fn(), isPending: false }),
  useResubmitExpenseClaim: () => ({ mutate: vi.fn(), isPending: false }),
  useExpenseReceiptUpload: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("../../components/FinanceShell", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const { ExpenseLeadApprovalsPage, ExpenseFinanceApprovalsPage } = await import(
  "./ExpenseApprovalsPage"
);
const { NotificationsProvider } = await import("@context/notifications/NotificationsContext");

beforeEach(() => {
  payloads.length = 0;
});

function show(Page: () => ReactNode) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <NotificationsProvider>
        <Page />
      </NotificationsProvider>
    </QueryClientProvider>,
  );
}

// Approvals.tsx:39-59. The two stages do not mirror each other: a lead's
// "Approved" tab spans everything they passed on, whatever finance did with it
// afterwards.
describe("what each approval stage asks for", () => {
  it("a lead's pending queue is its own stage, scoped to them", async () => {
    show(ExpenseLeadApprovalsPage);
    await waitFor(() => expect(payloads.length).toBeGreaterThan(0));
    expect(payloads.at(-1)!.status).toEqual(["PENDING_LEAD"]);
    expect(payloads.at(-1)!.leadEmail).toBe("approver@wso2.com");
  });

  it("a lead's approved tab spans what finance did next", async () => {
    show(ExpenseLeadApprovalsPage);
    fireEvent.click(await screen.findByRole("tab", { name: /Approved/ }));
    await waitFor(() =>
      expect(payloads.at(-1)!.status).toEqual([
        "PENDING_FINANCE",
        "APPROVED",
        "FINANCE_REJECTED",
      ]),
    );
  });

  it("finance sees only its own stage, unscoped by lead", async () => {
    show(ExpenseFinanceApprovalsPage);
    await waitFor(() => expect(payloads.length).toBeGreaterThan(0));
    expect(payloads.at(-1)!.status).toEqual(["PENDING_FINANCE"]);
    expect(payloads.at(-1)!.leadEmail).toBeUndefined();
  });
});

// FilterHolder.tsx:218-249 — without these the only way to find a claim is to
// scroll everyone's queue.
describe("narrowing an approval queue", () => {
  it("sends no email or id by default", async () => {
    show(ExpenseFinanceApprovalsPage);
    await waitFor(() => expect(payloads.length).toBeGreaterThan(0));
    expect(payloads.at(-1)!.email).toBeUndefined();
    expect(payloads.at(-1)!.ids).toBeUndefined();
  });

  it("filters to one claim id while keeping the tab's status", async () => {
    show(ExpenseFinanceApprovalsPage);
    fireEvent.change(await screen.findByLabelText("Filter by claim ID"), {
      target: { value: "EC-3" },
    });
    await waitFor(() => expect(payloads.at(-1)!.ids).toEqual(["EC-3"]));
    expect(payloads.at(-1)!.status).toEqual(["PENDING_FINANCE"]);
  });

  it("keeps a lead scoped to their own reports while filtering", async () => {
    show(ExpenseLeadApprovalsPage);
    fireEvent.change(await screen.findByLabelText("Filter by claim ID"), {
      target: { value: "EC-3" },
    });
    await waitFor(() => expect(payloads.at(-1)!.ids).toEqual(["EC-3"]));
    expect(payloads.at(-1)!.leadEmail).toBe("approver@wso2.com");
  });
});
