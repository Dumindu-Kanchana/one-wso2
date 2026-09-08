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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";

vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));
vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));

import type { CcTransaction } from "../ccTypes";

const txn: CcTransaction = {
  id: 1,
  ccNumber: "1111",
  txnDate: "2026-08-20",
  txnDescription: "Hotel",
  txnAmount: 500,
  expenseTypeId: null,
  expenseCategoryLabel: null,
  expenseTypeLabel: null,
  txnComment: null,
  receiptFileName: null,
  contractFileName: null,
  subRegion: null,
  travelJobNumber: null,
  productUnit: null,
  businessUnit: null,
  employeeEmail: "me@wso2.com",
  leadEmail: "lead@wso2.com",
  financeApproverEmail: null,
  empPostedDate: null,
  leadApprovedDate: null,
  financeApprovedDate: null,
  reportSequenceNumber: null,
  status: "new",
};

vi.mock("../useCc", () => ({
  useCcUserInfo: () => ({
    data: { workEmail: "me@wso2.com", accessLevels: [] },
    isLoading: false,
    isError: false,
  }),
  useCreditCards: () => ({
    data: [{ id: 1, ccNumber: "1111", label: "Mine", status: "Active", employeeEmail: "me@wso2.com" }],
    isLoading: false,
    isError: false,
  }),
  useCcTransactions: () => ({ data: [txn], isLoading: false, isError: false, isSuccess: true }),
}));

// Every POST /transactions/save-draft the page makes.
const drafts: unknown[][] = [];
vi.mock("../useCcMutations", () => ({
  useCcEmployeeSubmit: () => ({ mutate: vi.fn(), isPending: false, isError: false, error: null }),
  useCcCardLabel: () => ({ mutate: vi.fn(), isPending: false }),
  useCcSaveDraft: () => ({
    mutateAsync: async (rows: unknown[]) => {
      drafts.push(rows);
    },
    isPending: false,
  }),
}));

// The dialog is not what is under test here; this stands in for finishing a
// categorisation so the autosave has something to persist.
vi.mock("../CcEditDialog", () => ({
  CcEditDialog: ({
    txn: open,
    onSave,
  }: {
    txn: CcTransaction | null;
    onSave: (t: CcTransaction) => void;
  }) =>
    open ? (
      <button onClick={() => onSave({ ...open, expenseTypeLabel: "Hotels", txnComment: "Client trip", productUnit: "Integration" })}>
        finish-categorising
      </button>
    ) : null,
}));

vi.mock("../../components/FinanceShell", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const { default: CcNewTransactionsPage } = await import("./CcNewTransactionsPage");
const { NotificationsProvider } = await import("@context/notifications/NotificationsContext");

beforeEach(() => {
  drafts.length = 0;
  vi.useFakeTimers({ shouldAdvanceTime: true });
});
afterEach(() => {
  vi.useRealTimers();
});

function show() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <NotificationsProvider>
        <CcNewTransactionsPage />
      </NotificationsProvider>
    </QueryClientProvider>,
  );
}

// EditPane.tsx:444-467 saves a part-finished categorisation to /save-draft five
// seconds after the last change (autoSaveDelay, :150). The port kept edits in
// component state and posted nothing until Submit, so leaving the page threw
// the work away. transaction.ts:29 is the endpoint mapping.
describe("a part-finished categorisation", () => {
  it("is not drafted before anything has been edited", async () => {
    show();
    await screen.findByText("Hotel");
    await vi.advanceTimersByTimeAsync(6000);
    expect(drafts).toHaveLength(0);
  });

  it("is kept on the server once categorised", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTimeAsync });
    show();
    await user.click(await screen.findByRole("button", { name: "Categorise" }));
    await user.click(await screen.findByRole("button", { name: "finish-categorising" }));

    await vi.advanceTimersByTimeAsync(5100);
    await waitFor(() => expect(drafts).toHaveLength(1));
    expect(drafts[0]).toHaveLength(1);
    expect((drafts[0][0] as CcTransaction).txnComment).toBe("Client trip");
  });

  it("waits the source's five seconds, not the util's default second", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTimeAsync });
    show();
    await user.click(await screen.findByRole("button", { name: "Categorise" }));
    await user.click(await screen.findByRole("button", { name: "finish-categorising" }));

    await vi.advanceTimersByTimeAsync(2000);
    expect(drafts).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(3200);
    await waitFor(() => expect(drafts).toHaveLength(1));
  });

  it("says so, so the reader knows the work is held", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTimeAsync });
    show();
    await user.click(await screen.findByRole("button", { name: "Categorise" }));
    await user.click(await screen.findByRole("button", { name: "finish-categorising" }));

    await vi.advanceTimersByTimeAsync(5100);
    await waitFor(() => expect(screen.getByText("Draft saved")).toBeInTheDocument());
  });
});

// The screen is on the grid now (NewTransactionsDataGrid.tsx). Hand-built it
// had no search, sorting or paging; the source gets all three from the
// component.
describe("the grid this screen sits on", () => {
  const rowBoxes = async () =>
    (await screen.findAllByRole("checkbox")).filter(
      (b) => b.getAttribute("name") === "select_row",
    );

  it("offers search, columns and filters", async () => {
    show();
    await screen.findByText("Hotel");
    for (const name of ["Columns", "Filters", "Search"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("offers no export — nothing here has been submitted yet", async () => {
    show();
    await screen.findByText("Hotel");
    expect(screen.queryByRole("button", { name: "Export" })).toBeNull();
  });

  it("says a row needs details until it has been categorised", async () => {
    show();
    expect(await screen.findByText("Needs details")).toBeInTheDocument();
  });

  it("will not submit a row that is still incomplete", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTimeAsync });
    show();
    await user.click((await rowBoxes())[0]);
    // Ticked, but nothing has been categorised, so there is nothing to submit.
    expect(screen.getByRole("button", { name: /Submit/ })).toBeDisabled();
  });

  it("submits once the ticked row is complete", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTimeAsync });
    show();
    await user.click(await screen.findByRole("button", { name: "Categorise" }));
    await user.click(await screen.findByRole("button", { name: "finish-categorising" }));
    await user.click((await rowBoxes())[0]);

    expect(screen.getByRole("button", { name: /Submit/ })).toBeEnabled();
  });
});
