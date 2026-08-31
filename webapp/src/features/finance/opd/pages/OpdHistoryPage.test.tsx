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

// Every search payload the screen asks for, so filter assertions are about
// what reaches the backend rather than what renders.
const payloads: Record<string, unknown>[] = [];

vi.mock("../useOpd", () => ({
  useOpdUserInfo: () => ({
    data: { workEmail: "me@wso2.com", userRoles: [444] },
    isLoading: false,
    isError: false,
  }),
  useOpdClaims: (payload: Record<string, unknown>) => {
    payloads.push(payload);
    return { data: state.claims, isLoading: false, isError: false, isSuccess: true };
  },
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
  payloads.length = 0;
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

// FilterHolder.tsx. The source filters on a year RANGE, a status and a claim
// id; the port had a single year dropdown, so a claim from two years ago — or a
// known claim id — could not be reached at all.
describe("what the history screen filters on", () => {
  it("defaults to this year", async () => {
    show();
    await waitFor(() => expect(payloads.length).toBeGreaterThan(0));
    const year = new Date().getFullYear();
    expect(payloads.at(-1)).toMatchObject({ startYear: year, endYear: year });
  });

  it("moves the whole range to last year", async () => {
    show();
    fireEvent.mouseDown(screen.getByLabelText("Period"));
    fireEvent.click(await screen.findByRole("option", { name: "Last Year" }));
    const year = new Date().getFullYear() - 1;
    await waitFor(() => expect(payloads.at(-1)).toMatchObject({ startYear: year, endYear: year }));
  });

  it("spans several years on Custom", async () => {
    show();
    fireEvent.mouseDown(screen.getByLabelText("Period"));
    fireEvent.click(await screen.findByRole("option", { name: "Custom" }));
    const start = new Date().getFullYear() - 3;
    fireEvent.mouseDown(await screen.findByLabelText("Start Year"));
    fireEvent.click(await screen.findByRole("option", { name: String(start) }));
    await waitFor(() => expect(payloads.at(-1)!.startYear).toBe(start));
    expect(payloads.at(-1)!.endYear).toBe(new Date().getFullYear());
  });

  it("sends no status until one is chosen", async () => {
    show();
    await waitFor(() => expect(payloads.length).toBeGreaterThan(0));
    expect(payloads.at(-1)!.status).toBeUndefined();
  });

  it("carries legacy pending claims when filtering by pending", async () => {
    show();
    fireEvent.mouseDown(screen.getByLabelText("Status"));
    fireEvent.click(await screen.findByRole("option", { name: "Pending Finance" }));
    await waitFor(() => expect(payloads.at(-1)!.status).toEqual(["PENDING", "PENDING_OLD"]));
  });

  it("does not offer the legacy status as its own choice", async () => {
    show();
    fireEvent.mouseDown(screen.getByLabelText("Status"));
    await screen.findByRole("option", { name: "All" });
    expect(screen.queryByRole("option", { name: /Pending Old/i })).not.toBeInTheDocument();
  });

  it("sends a claim id as a one-element list", async () => {
    show();
    fireEvent.change(screen.getByLabelText("Filter by claim ID"), { target: { value: " C-9 " } });
    await waitFor(() => expect(payloads.at(-1)!.ids).toEqual(["C-9"]));
  });

  it("omits the claim id when the box is empty", async () => {
    show();
    await waitFor(() => expect(payloads.length).toBeGreaterThan(0));
    expect(payloads.at(-1)!.ids).toBeUndefined();
  });
});

// Raised on PR #29. Both year lists offered the same five years, so a start
// after the end could reach the payload — returning nothing, with an empty-state
// message that read the range backwards. The source has the same hole
// (FilterHolder.tsx:207 disables Apply only on a null year).
describe("the custom period cannot be inverted", () => {
  it("offers no start year later than the end", async () => {
    show();
    fireEvent.mouseDown(screen.getByLabelText("Period"));
    fireEvent.click(await screen.findByRole("option", { name: "Custom" }));
    // Widen the start first, so the end has somewhere earlier to move to.
    fireEvent.mouseDown(await screen.findByLabelText("Start Year"));
    fireEvent.click(await screen.findByRole("option", { name: String(CURRENT_YEAR - 3) }));
    fireEvent.mouseDown(await screen.findByLabelText("End Year"));
    fireEvent.click(await screen.findByRole("option", { name: String(CURRENT_YEAR - 2) }));

    fireEvent.mouseDown(screen.getByLabelText("Start Year"));
    const options = (await screen.findAllByRole("option")).map((o) => o.textContent);
    expect(options).not.toContain(String(CURRENT_YEAR));
    expect(options).toContain(String(CURRENT_YEAR - 2));
  });

  it("offers no end year earlier than the start", async () => {
    show();
    fireEvent.mouseDown(screen.getByLabelText("Period"));
    fireEvent.click(await screen.findByRole("option", { name: "Custom" }));
    fireEvent.mouseDown(await screen.findByLabelText("Start Year"));
    fireEvent.click(await screen.findByRole("option", { name: String(CURRENT_YEAR - 1) }));

    fireEvent.mouseDown(screen.getByLabelText("End Year"));
    const options = (await screen.findAllByRole("option")).map((o) => o.textContent);
    expect(options).not.toContain(String(CURRENT_YEAR - 2));
    expect(options).toContain(String(CURRENT_YEAR));
  });

  it("never sends a start year after the end year", async () => {
    show();
    fireEvent.mouseDown(screen.getByLabelText("Period"));
    fireEvent.click(await screen.findByRole("option", { name: "Custom" }));
    await waitFor(() => expect(payloads.length).toBeGreaterThan(0));
    const { startYear, endYear } = payloads.at(-1) as { startYear: number; endYear: number };
    expect(startYear).toBeLessThanOrEqual(endYear);
  });
});
