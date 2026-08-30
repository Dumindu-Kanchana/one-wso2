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
import { MemoryRouter } from "react-router";
import type { ReactNode } from "react";

const navigate = vi.fn();
vi.mock("react-router", async () => {
  const actual = await vi.importActual<typeof import("react-router")>("react-router");
  return { ...actual, useNavigate: () => navigate };
});

// The details dialog reaches @hooks/useAccessToken for receipt fetches, which
// pulls in the Asgardeo SDK; stubbed so the suite doesn't need a real session.
vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));
vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));

const CURRENT_YEAR = new Date().getFullYear();

const rejectedClaim = {
  id: "C-9",
  createdDate: `${CURRENT_YEAR}-03-02T00:00:00Z`,
  employeeEmail: "me@wso2.com",
  totalAmount: 1500,
  statusDetails: {
    status: "REJECTED",
    financeApprovedDate: null,
    financeRejectedDate: `${CURRENT_YEAR}-03-05T00:00:00Z`,
    financeRejectedReason: "Receipt unreadable",
  },
  transactions: [
    { date: `${CURRENT_YEAR}-03-01`, amount: 1500, comment: "GP visit", receiptUrl: "r1.pdf" },
  ],
};

const state = { claims: [rejectedClaim] as unknown[] };

vi.mock("../useOpd", () => ({
  useOpdUserInfo: () => ({
    data: { workEmail: "me@wso2.com", userRoles: [444] },
    isLoading: false,
    isError: false,
  }),
  useOpdClaims: () => ({
    data: state.claims,
    isLoading: false,
    isError: false,
    isSuccess: true,
  }),
  useOpdEmployees: () => ({ data: [], isLoading: false, isError: false }),
}));

vi.mock("../useOpdMutations", () => ({
  useOpdClaimStatus: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("../../components/FinanceShell", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const { default: OpdHistoryPage } = await import("./OpdHistoryPage");
const { NotificationsProvider } = await import("@context/notifications/NotificationsContext");

beforeEach(() => {
  navigate.mockClear();
  state.claims = [rejectedClaim];
});

function show() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <NotificationsProvider>
        <MemoryRouter>
          <OpdHistoryPage />
        </MemoryRouter>
      </NotificationsProvider>
    </QueryClientProvider>,
  );
}

// ClaimDetails.tsx:101-114,187-196,307,395-407. A rejected OPD claim can be
// taken up again: its bills seed a fresh claim. The port had no way to do this
// at all — a rejected claim was a dead end and the bills had to be re-entered
// by hand.
describe("resubmitting a rejected claim", () => {
  it("offers the action on a rejected claim", async () => {
    show();
    fireEvent.click(await screen.findByRole("button", { name: "View" }));
    expect(
      await screen.findByRole("button", { name: "Resubmit as New Claim" }),
    ).toBeInTheDocument();
  });

  it("does not offer it on an approved claim", async () => {
    state.claims = [
      { ...rejectedClaim, statusDetails: { ...rejectedClaim.statusDetails, status: "APPROVED" } },
    ];
    show();
    fireEvent.click(await screen.findByRole("button", { name: "View" }));
    await screen.findByRole("button", { name: "Close" });
    expect(screen.queryByRole("button", { name: "Resubmit as New Claim" })).not.toBeInTheDocument();
  });

  it("warns that the existing draft will be replaced", async () => {
    show();
    fireEvent.click(await screen.findByRole("button", { name: "View" }));
    fireEvent.click(await screen.findByRole("button", { name: "Resubmit as New Claim" }));
    expect(await screen.findByText("Claim Resubmission Confirmation")).toBeInTheDocument();
    expect(screen.getByText(/your existing draft will be cleared/)).toBeInTheDocument();
    // Nothing has happened yet.
    expect(navigate).not.toHaveBeenCalled();
  });

  it("carries the bills to the new-claim screen once confirmed", async () => {
    show();
    fireEvent.click(await screen.findByRole("button", { name: "View" }));
    fireEvent.click(await screen.findByRole("button", { name: "Resubmit as New Claim" }));
    fireEvent.click(await screen.findByRole("button", { name: "Resubmit" }));

    await waitFor(() => expect(navigate).toHaveBeenCalled());
    expect(navigate).toHaveBeenCalledWith("/me/opd/new", {
      state: { resubmitTransactions: rejectedClaim.transactions },
    });
  });

  it("does nothing when the confirmation is dismissed", async () => {
    show();
    fireEvent.click(await screen.findByRole("button", { name: "View" }));
    fireEvent.click(await screen.findByRole("button", { name: "Resubmit as New Claim" }));
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(screen.queryByText("Claim Resubmission Confirmation")).not.toBeInTheDocument(),
    );
    expect(navigate).not.toHaveBeenCalled();
  });
});
