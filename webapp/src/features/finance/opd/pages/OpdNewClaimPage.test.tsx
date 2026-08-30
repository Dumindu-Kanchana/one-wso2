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

// First tests for any of the three finance ports. The audit against
// digiops-finance/apps/opd-claims found five behaviours that were dropped in
// the port; these cover the ones that change what a user can do.

const CURRENT_YEAR = new Date().getFullYear();
const LAST_YEAR = CURRENT_YEAR - 1;

const state = {
  lastYearClaimSummary: null as { totalClaimedAmount: number; totalRemaining: number; totalClaimLimit: number } | null,
  draft: null as { transactions: unknown[] } | null,
  roles: [444],
};

vi.mock("../useOpd", () => ({
  useOpdUserInfo: () => ({
    data: { workEmail: "me@wso2.com", userRoles: state.roles },
    isLoading: false,
    isError: false,
  }),
  useOpdAppData: () => ({
    data: {
      claimSummary: { totalClaimedAmount: 5000, totalRemaining: 45000, totalClaimLimit: 50000 },
      lastYearClaimSummary: state.lastYearClaimSummary,
      draft: state.draft,
    },
    isLoading: false,
    isError: false,
    isSuccess: true,
  }),
}));

const submitMutate = vi.fn();
const draftRemove = vi.fn();
vi.mock("../useOpdMutations", () => ({
  useOpdReceiptUpload: () => ({ mutateAsync: vi.fn(async () => "receipt-1.pdf"), isPending: false }),
  useSubmitOpdClaim: () => ({ mutate: submitMutate, isPending: false, isError: false, error: null }),
  useOpdDraftSync: () => ({
    save: { mutateAsync: vi.fn(async () => undefined) },
    remove: { mutate: draftRemove, mutateAsync: vi.fn(async () => undefined) },
  }),
}));

vi.mock("../../components/FinanceShell", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const { default: OpdNewClaimPage } = await import("./OpdNewClaimPage");
const { NotificationsProvider } = await import("@context/notifications/NotificationsContext");

beforeEach(() => {
  submitMutate.mockClear();
  draftRemove.mockClear();
  state.lastYearClaimSummary = null;
  state.draft = null;
  state.roles = [444];
});

function show() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <NotificationsProvider>
        <MemoryRouter>
          <OpdNewClaimPage />
        </MemoryRouter>
      </NotificationsProvider>
    </QueryClientProvider>,
  );
}

const withLastYear = () => {
  state.lastYearClaimSummary = { totalClaimedAmount: 1000, totalRemaining: 9000, totalClaimLimit: 10000 };
};

// NewClaim.tsx:129-172,271-272,382. lastYearClaimSummary was declared in
// opdTypes.ts and never read, so a claim against last year's balance — which
// the backend still reports as claimable — could not be made at all.
describe("claiming against last year's balance", () => {
  it("offers no year choice when the backend reports no last-year balance", async () => {
    show();
    await screen.findByText("Bills in this claim");
    expect(screen.queryByRole("tab", { name: "Last Year" })).not.toBeInTheDocument();
  });

  it("offers the choice when there is one", async () => {
    withLastYear();
    show();
    expect(await screen.findByRole("tab", { name: "This Year" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Last Year" })).toBeInTheDocument();
  });

  it("shows this year's limit on This Year", async () => {
    withLastYear();
    show();
    await screen.findByRole("tab", { name: "Last Year" });
    expect(screen.getByText("Rs. 45,000.00")).toBeInTheDocument();
  });

  it("swaps to last year's limit on Last Year", async () => {
    withLastYear();
    show();
    fireEvent.click(await screen.findByRole("tab", { name: "Last Year" }));
    // The whole balance row follows the tab, not just a caption.
    expect(await screen.findByText("Rs. 9,000.00")).toBeInTheDocument();
    expect(screen.queryByText("Rs. 45,000.00")).not.toBeInTheDocument();
  });

  it("moves the bill-date bounds onto the chosen year", async () => {
    withLastYear();
    show();
    fireEvent.click(await screen.findByRole("tab", { name: "Last Year" }));
    fireEvent.click(screen.getByRole("button", { name: /Add bill/ }));
    const dateField = await screen.findByLabelText("Bill date");
    // CustomDatePicker.tsx:93-101 — a past year runs the whole year, not to today.
    expect(dateField).toHaveAttribute("min", `${LAST_YEAR}-01-01`);
    expect(dateField).toHaveAttribute("max", `${LAST_YEAR}-12-31`);
  });

  it("keeps this year's bounds ending today", async () => {
    withLastYear();
    show();
    fireEvent.click(await screen.findByRole("button", { name: "+ Add bill" }));
    const dateField = await screen.findByLabelText("Bill date");
    expect(dateField).toHaveAttribute("min", `${CURRENT_YEAR}-01-01`);
    expect(dateField.getAttribute("max")).not.toBe(`${CURRENT_YEAR}-12-31`);
  });
});

// NewClaim.tsx:57-63 — a draft filed against last year has to reopen on last
// year, or its dates fall outside the picker's bounds.
describe("a seeded draft decides the year", () => {
  it("opens on Last Year for a last-year draft", async () => {
    withLastYear();
    state.draft = {
      transactions: [{ date: `${LAST_YEAR}-06-01`, amount: 500, comment: "GP", receiptUrl: "r.pdf" }],
    };
    show();
    const lastYearTab = await screen.findByRole("tab", { name: "Last Year" });
    await waitFor(() => expect(lastYearTab).toHaveAttribute("aria-selected", "true"));
  });
});

// ExpenseForm.tsx:129-144. The picker's bounds steer this, but the date input
// is typeable, so mixing years has to be refused rather than merely discouraged
// — the backend files a claim against one year's balance.
describe("a claim cannot mix years", () => {
  async function addBill(date: string) {
    fireEvent.click(await screen.findByRole("button", { name: "+ Add bill" }));
    fireEvent.change(await screen.findByLabelText("Bill date"), { target: { value: date } });
    fireEvent.change(screen.getByPlaceholderText("0.00"), { target: { value: "500" } });
    fireEvent.change(screen.getByPlaceholderText(/GP consultation/), {
      target: { value: "Consultation" },
    });
    // The receipt is required; the upload mock resolves to a file name.
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["x"], "receipt.pdf", { type: "application/pdf" });
    fireEvent.change(fileInput, { target: { files: [file] } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Add bill" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Add bill" }));
  }

  it("refuses a bill from a different year than the first", async () => {
    withLastYear();
    show();
    await addBill(`${CURRENT_YEAR}-03-01`);
    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: "Remove bill" })).toHaveLength(1),
    );

    await addBill(`${LAST_YEAR}-03-01`);
    expect(
      await screen.findByText("All transactions in a claim must belong to the same year."),
    ).toBeInTheDocument();

    // The dialog stays open with the refused entry intact, so it can be
    // corrected. Close it before counting — MUI marks the page behind an open
    // dialog aria-hidden, which role queries honour.
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: "Remove bill" })).toHaveLength(1),
    );
  });
});

// NewClaim.tsx:65-72,442-465 — confirming discards every bill entered so far,
// so it is put to the user before the switch happens.
describe("switching year with bills already added", () => {
  it("asks first, and does not switch when dismissed", async () => {
    withLastYear();
    state.draft = {
      transactions: [{ date: `${CURRENT_YEAR}-03-01`, amount: 500, comment: "GP", receiptUrl: "r.pdf" }],
    };
    show();
    fireEvent.click(await screen.findByRole("tab", { name: "Last Year" }));
    expect(await screen.findByText("Change Year Warning")).toBeInTheDocument();
    expect(screen.getByText("GP")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByText("Change Year Warning")).not.toBeInTheDocument());
    expect(screen.getByText("GP")).toBeInTheDocument();
  });

  it("clears the bills and the draft when confirmed", async () => {
    withLastYear();
    state.draft = {
      transactions: [{ date: `${CURRENT_YEAR}-03-01`, amount: 500, comment: "GP", receiptUrl: "r.pdf" }],
    };
    show();
    fireEvent.click(await screen.findByRole("tab", { name: "Last Year" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(screen.queryByText("GP")).not.toBeInTheDocument());
    // The server draft goes too — otherwise it would be re-seeded on return.
    expect(draftRemove).toHaveBeenCalled();
  });
});
