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
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));
vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));

const base = {
  ccNumber: "4444",
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
  employeeEmail: "me@wso2.com",
  leadEmail: "lead@wso2.com",
  financeApproverEmail: null,
  empPostedDate: null,
  leadApprovedDate: null,
  financeApprovedDate: null,
  reportSequenceNumber: null,
};

vi.mock("../useCc", () => ({
  useCcUserInfo: () => ({ data: { workEmail: "me@wso2.com" }, isLoading: false, isError: false }),
  useCcTransactions: () => ({
    data: [
      { ...base, id: 1, txnDescription: "Still with lead", status: "pending_lead" },
      { ...base, id: 2, txnDescription: "Gone to finance", status: "pending_finance" },
    ],
    isLoading: false,
    isError: false,
  }),
  useCcMenus: () => ({
    expenseTypes: { data: { categories: [], types: {} }, isLoading: false },
    subRegions: { data: { subRegions: [] }, isLoading: false },
    units: { data: { productUnits: [], businessUnits: [] }, isLoading: false },
    jobNumbers: { data: { jobNumbers: [] }, isLoading: false },
  }),
  useCcJobNumberDetails: () => ({ data: undefined, isLoading: false, isError: false }),
}));

const saveEdit = vi.fn();
vi.mock("../useCcMutations", () => ({
  useCcSaveEdit: () => ({ mutate: saveEdit, isPending: false }),
  useCcAttachment: () => ({
    upload: { mutateAsync: vi.fn(), isPending: false },
    remove: { mutateAsync: vi.fn(), isPending: false },
  }),
}));

vi.mock("../../components/FinanceShell", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const { default: CcPendingPage } = await import("./CcPendingPage");
const { NotificationsProvider } = await import("@context/notifications/NotificationsContext");

beforeEach(() => saveEdit.mockClear());

function show() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <NotificationsProvider>
        <CcPendingPage />
      </NotificationsProvider>
    </QueryClientProvider>,
  );
}

// PendingTransactionsDataGrid.tsx:232-237 — a submission can still be corrected
// while it sits with the lead, saved through /save-edit. Once finance has it,
// it cannot. The port offered no editing at all on this screen.
describe("correcting a submission that is still with the lead", () => {
  it("offers Edit on a lead-stage row", async () => {
    show();
    await waitFor(() => expect(screen.getByText("Still with lead")).toBeInTheDocument());
    expect(screen.getAllByRole("button", { name: "Edit" })).toHaveLength(1);
  });

  it("offers none once finance has it", async () => {
    show();
    await waitFor(() => expect(screen.getByText("Gone to finance")).toBeInTheDocument());
    // Only the lead-stage row has one, so exactly one button for two rows.
    expect(screen.getAllByRole("button", { name: "Edit" })).toHaveLength(1);
  });
});
