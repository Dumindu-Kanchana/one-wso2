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
  txnDescription: "Hotel",
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
  employeeEmail: "someone@wso2.com",
  leadEmail: "lead@wso2.com, other@wso2.com",
  financeApproverEmail: null,
  empPostedDate: null,
  leadApprovedDate: null,
  financeApprovedDate: null,
  reportSequenceNumber: null,
};

const withLead = { ...base, id: 1, status: "pending_lead" };
const withFinance = { ...base, id: 2, status: "pending_finance" };

const state = { access: ["finance"] as string[] };

vi.mock("../useCc", () => ({
  useCcMenus: () => ({
    expenseTypes: { data: { categories: [], types: {} }, isLoading: false },
    subRegions: { data: { subRegions: [] }, isLoading: false },
    units: { data: { productUnits: [], businessUnits: [] }, isLoading: false },
    jobNumbers: { data: { jobNumbers: [] }, isLoading: false },
  }),
  useCcJobNumberDetails: () => ({ data: undefined, isLoading: false, isError: false }),
  useCcUserInfo: () => ({
    data: { workEmail: "lead@wso2.com", accessLevels: state.access },
    isLoading: false,
    isError: false,
  }),
  useCcTransactions: () => ({
    data: [withLead, withFinance],
    isLoading: false,
    isError: false,
  }),
}));

vi.mock("../ccTypes", async () => {
  const actual = await vi.importActual<typeof import("../ccTypes")>("../ccTypes");
  return { ...actual, ccHasAccess: (_u: unknown, lvl: string) => state.access.includes(lvl) };
});

const saveEdit = vi.fn();
vi.mock("../useCcMutations", () => ({
  useCcApprove: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCcSaveEdit: () => ({ mutate: saveEdit, isPending: false }),
  useCcAttachment: () => ({
    upload: { mutateAsync: vi.fn(), isPending: false },
    remove: { mutateAsync: vi.fn(), isPending: false },
  }),
}));

vi.mock("../../components/FinanceShell", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const { default: CcApprovePage } = await import("./CcApprovePage");
const { NotificationsProvider } = await import("@context/notifications/NotificationsContext");

beforeEach(() => {
  state.access = ["finance"];
});

function show() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <NotificationsProvider>
        <CcApprovePage />
      </NotificationsProvider>
    </QueryClientProvider>,
  );
}

// approve-submissions/index.tsx:122-126 — finance's queue spans both stages, so
// they can see what is still waiting on a lead. ApproveTransactionsDataGrid
// .tsx:157-166 then stops them selecting it. The port showed only its own
// stage, so work sitting with a lead was invisible to finance entirely.
describe("what a finance approver sees", () => {
  it("shows rows still with the lead as well as its own", async () => {
    show();
    await waitFor(() => expect(screen.getAllByRole("checkbox").length).toBeGreaterThan(0));
    // Two rows: one pending_lead, one pending_finance.
    expect(screen.getAllByRole("row")).toHaveLength(3); // header + 2
  });

  it("cannot select the row still with the lead", async () => {
    show();
    const boxes = await screen.findAllByRole("checkbox");
    // Row order follows the data: pending_lead first.
    expect(boxes[0]).toBeDisabled();
    expect(boxes[1]).toBeEnabled();
  });
});

describe("what a lead sees", () => {
  beforeEach(() => {
    state.access = ["lead"];
  });

  it("sees only its own stage", async () => {
    show();
    await waitFor(() => expect(screen.getAllByRole("checkbox").length).toBeGreaterThan(0));
    expect(screen.getAllByRole("row")).toHaveLength(2); // header + 1
  });

  it("can select it", async () => {
    show();
    const boxes = await screen.findAllByRole("checkbox");
    expect(boxes[0]).toBeEnabled();
  });
});
