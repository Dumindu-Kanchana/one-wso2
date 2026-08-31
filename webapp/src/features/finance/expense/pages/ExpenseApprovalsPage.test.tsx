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
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));
vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));

const payloads: Record<string, unknown>[] = [];

// Which stages this person holds. Independent flags, so all three combinations
// are reachable and each renders a different screen.
const flags = { lead: true, finance: true };

vi.mock("../useExpense", () => ({
  useExpenseAppData: () => ({
    data: {
      userInfo: { workEmail: "approver@wso2.com", firstName: "A", lastName: "B" },
      get enableLeadView() {
        return flags.lead;
      },
      get enableFinanceView() {
        return flags.finance;
      },
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

const { default: ExpenseApprovalsTab } = await import("./ExpenseApprovalsPage");
const { NotificationsProvider } = await import("@context/notifications/NotificationsContext");

beforeEach(() => {
  payloads.length = 0;
  flags.lead = true;
  flags.finance = true;
});

/**
 * The tab, scoped to one stage the way a user reaches it: someone who holds a
 * single flag has no switch at all, which is also the simplest way to isolate
 * a stage in a test.
 */
function show(stage: "LEAD" | "FINANCE") {
  flags.lead = stage === "LEAD";
  flags.finance = stage === "FINANCE";
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <NotificationsProvider>
        <ExpenseApprovalsTab />
      </NotificationsProvider>
    </QueryClientProvider>,
  );
}

// Approvals.tsx:39-59. The two stages do not mirror each other: a lead's
// "Approved" tab spans everything they passed on, whatever finance did with it
// afterwards.
describe("what each approval stage asks for", () => {
  it("a lead's pending queue is its own stage, scoped to them", async () => {
    show("LEAD");
    await waitFor(() => expect(payloads.length).toBeGreaterThan(0));
    expect(payloads.at(-1)!.status).toEqual(["PENDING_LEAD"]);
    expect(payloads.at(-1)!.leadEmail).toBe("approver@wso2.com");
  });

  it("a lead's approved tab spans what finance did next", async () => {
    show("LEAD");
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
    show("FINANCE");
    await waitFor(() => expect(payloads.length).toBeGreaterThan(0));
    expect(payloads.at(-1)!.status).toEqual(["PENDING_FINANCE"]);
    expect(payloads.at(-1)!.leadEmail).toBeUndefined();
  });
});

// FilterHolder.tsx:218-249 — without these the only way to find a claim is to
// scroll everyone's queue.
describe("narrowing an approval queue", () => {
  it("sends no email or id by default", async () => {
    show("FINANCE");
    await waitFor(() => expect(payloads.length).toBeGreaterThan(0));
    expect(payloads.at(-1)!.email).toBeUndefined();
    expect(payloads.at(-1)!.ids).toBeUndefined();
  });

  it("filters to one claim id while keeping the tab's status", async () => {
    show("FINANCE");
    fireEvent.change(await screen.findByLabelText("Filter by claim ID"), {
      target: { value: "EC-3" },
    });
    await waitFor(() => expect(payloads.at(-1)!.ids).toEqual(["EC-3"]));
    expect(payloads.at(-1)!.status).toEqual(["PENDING_FINANCE"]);
  });

  it("keeps a lead scoped to their own reports while filtering", async () => {
    show("LEAD");
    fireEvent.change(await screen.findByLabelText("Filter by claim ID"), {
      target: { value: "EC-3" },
    });
    await waitFor(() => expect(payloads.at(-1)!.ids).toEqual(["EC-3"]));
    expect(payloads.at(-1)!.leadEmail).toBe("approver@wso2.com");
  });
});

// Raised on the OPD PR (#29) and applied here too: useExpenseClaims keys on the
// whole payload, so an undebounced claim-id field mints a key per keystroke and
// fires a search for every prefix. The source batches the same fields behind an
// Apply button (FilterHolder.tsx:53,81-82).
describe("typing a claim id does not search on every keystroke", () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  // The payload is rebuilt on every render, so counting calls proves nothing.
  // What drives a fetch is the query KEY changing, so count distinct ones.
  const distinctIds = () => new Set(payloads.map((p) => JSON.stringify(p.ids)));

  it("asks for nothing new while the field is still being typed", async () => {
    show("FINANCE");
    await waitFor(() => expect(payloads.length).toBeGreaterThan(0));

    const field = screen.getByLabelText("Filter by claim ID");
    for (const value of ["E", "EC", "EC-", "EC-3"]) {
      fireEvent.change(field, { target: { value } });
    }
    expect(distinctIds()).toEqual(new Set([JSON.stringify(undefined)]));
  });

  it("searches once the typing settles", async () => {
    show("FINANCE");
    await waitFor(() => expect(payloads.length).toBeGreaterThan(0));
    const field = screen.getByLabelText("Filter by claim ID");
    for (const value of ["E", "EC", "EC-", "EC-3"]) {
      fireEvent.change(field, { target: { value } });
    }
    await vi.advanceTimersByTimeAsync(400);
    await waitFor(() => expect(payloads.at(-1)!.ids).toEqual(["EC-3"]));
    expect(distinctIds()).toEqual(
      new Set([JSON.stringify(undefined), JSON.stringify(["EC-3"])]),
    );
  });
});
