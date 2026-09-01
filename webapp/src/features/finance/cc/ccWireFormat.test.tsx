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
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { localIsoDateOffset } from "@utils/localDate";

// These exercise the query functions themselves. The expense port taught us
// that hook-mocked screen tests cannot see a broken data path — a search that
// fired, returned 200 and was discarded passed 42 of them.

const requests: { method: string; url: string }[] = [];
const responses = { cards: [] as unknown[] };

vi.mock("@api/http", () => ({
  authedGet: (url: string) => {
    requests.push({ method: "GET", url });
    return Promise.resolve(responses.cards);
  },
  authedPost: (url: string) => {
    requests.push({ method: "POST", url });
    return Promise.resolve({});
  },
  authedPatch: (url: string) => {
    requests.push({ method: "PATCH", url });
    return Promise.resolve({});
  },
  authedDelete: (url: string) => {
    requests.push({ method: "DELETE", url });
    return Promise.resolve(undefined);
  },
  fetchWithReauth: vi.fn(),
  HttpError: class extends Error {},
}));
vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));
vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));
vi.mock("@hooks/useAsgardeoSub", () => ({
  useAsgardeoSub: () => ({ state: { status: "ready", sub: "sub-1" }, retry: vi.fn() }),
  foldIdentityError: (q: unknown) => q,
}));
vi.mock("@config/apiConfig", () => ({
  isCcBackendConfigured: () => true,
  ccServiceUrls: {
    userInfo: "https://cc.test/user-info",
    creditCards: "https://cc.test/credit-cards",
    creditCardLabel: (id: number, label: string) =>
      `https://cc.test/credit-cards/${id}?label=${encodeURIComponent(label)}`,
    transactions: (q: string) => `https://cc.test/transactions${q}`,
    jobNumberDetails: (j: string) => `https://cc.test/travels/${encodeURIComponent(j)}`,
    transactionSummary: "https://cc.test/transactions/new-transaction-summary",
    submittedByCategory: "https://cc.test/transactions/submitted-transaction-summary",
    cardHolderCompliance: "https://cc.test/transactions/card-holder-compliance-summary",
  },
}));

const {
  useCreditCards,
  useCcTransactions,
  useCcCardHolderCompliance,
  useCcSubmittedByCategory,
  useCcTransactionSummary,
} = await import("./useCc");

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const active = { id: 1, ccNumber: "1111", label: "Travel", status: "Active" };
const closed = { id: 2, ccNumber: "2222", label: "Old", status: "Inactive" };

beforeEach(() => {
  requests.length = 0;
  responses.cards = [active, closed];
});

// creditCard.ts:57-62 keeps only active cards unless asked otherwise. The flag
// was already in the port's cache key but never applied, so a closed card still
// appeared in the picker.
describe("which credit cards reach the picker", () => {
  it("drops closed cards by default", async () => {
    const { result } = renderHook(() => useCreditCards(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([active]);
  });

  it("keeps them when inactive ones are asked for", async () => {
    const { result } = renderHook(() => useCreditCards(true), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([active, closed]);
  });

  it("treats the status case-insensitively, as the source does", async () => {
    responses.cards = [{ ...active, status: "ACTIVE" }, { ...closed, status: "inactive" }];
    const { result } = renderHook(() => useCreditCards(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
  });
});

// utils.ts:21-33 advances the window's end by a day before formatting it.
// Asking up to today can exclude transactions dated today.
describe("the transaction window", () => {
  it("asks up to tomorrow, not today", async () => {
    renderHook(() => useCcTransactions(), { wrapper });
    await waitFor(() => expect(requests.length).toBeGreaterThan(0));
    const url = requests[0].url;
    expect(url).toContain(`dateTo=${localIsoDateOffset(1)}`);
    expect(url).not.toContain(`dateTo=${localIsoDateOffset(0)}`);
  });

  // utils.ts:21-33 — fetchTransactions defaults to `range || 7`, and New /
  // Pending / Approve all call it with no range. The port opened on 30 days,
  // so those screens listed three weeks of transactions the source hides.
  it("looks back seven days by default", async () => {
    renderHook(() => useCcTransactions(), { wrapper });
    await waitFor(() => expect(requests.length).toBeGreaterThan(0));
    expect(requests[0].url).toContain(`dateFrom=${localIsoDateOffset(-7)}`);
  });

  it("honours a caller's own window over the default", async () => {
    renderHook(() => useCcTransactions({ dateFrom: "2026-01-01", dateTo: "2026-02-01" }), {
      wrapper,
    });
    await waitFor(() => expect(requests.length).toBeGreaterThan(0));
    expect(requests[0].url).toContain("dateFrom=2026-01-01");
    expect(requests[0].url).toContain("dateTo=2026-02-01");
  });

  it("sends all three parameters the backend requires", async () => {
    renderHook(() => useCcTransactions(), { wrapper });
    await waitFor(() => expect(requests.length).toBeGreaterThan(0));
    for (const p of ["dateFrom=", "dateTo=", "includeInactive="]) {
      expect(requests[0].url).toContain(p);
    }
  });
});

// transactionSummary.ts:54 / submittedExpensesByCategory.ts:50 /
// cardHolderCompliance.ts:52 all spread each parameter only when truthy, so a
// false flag or an absent date is left off the query string entirely.
describe("what the dashboard asks for", () => {
  it("omits ownedCardsOnly rather than sending false", async () => {
    renderHook(() => useCcTransactionSummary(undefined, false), { wrapper });
    await waitFor(() => expect(requests.length).toBeGreaterThan(0));
    expect(requests[0].url).not.toContain("ownedCardsOnly");
  });

  it("sends it when the view is narrowed to own cards", async () => {
    renderHook(() => useCcTransactionSummary(undefined, true), { wrapper });
    await waitFor(() => expect(requests.length).toBeGreaterThan(0));
    expect(requests[0].url).toContain("ownedCardsOnly=true");
  });

  it("leaves dateFrom off for the all-time period", async () => {
    renderHook(() => useCcTransactionSummary(undefined, false), { wrapper });
    await waitFor(() => expect(requests.length).toBeGreaterThan(0));
    expect(requests[0].url).not.toContain("dateFrom");
  });

  it("bounds the category breakdown at both ends", async () => {
    renderHook(
      () => useCcSubmittedByCategory({ dateFrom: "2026-03-01", dateTo: "2026-08-31" }, false),
      { wrapper },
    );
    await waitFor(() => expect(requests.length).toBeGreaterThan(0));
    expect(requests[0].url).toContain("dateFrom=2026-03-01");
    expect(requests[0].url).toContain("dateTo=2026-08-31");
  });

  // index.tsx:80-83 dispatches the compliance fetch only inside the admin
  // guard, so a card holder's browser never issues the request at all.
  it("does not call compliance when it is not shown", async () => {
    renderHook(() => useCcCardHolderCompliance(undefined, false, false), { wrapper });
    await new Promise((r) => setTimeout(r, 20));
    expect(requests).toHaveLength(0);
  });

  it("calls it once an approver is on the company view", async () => {
    renderHook(() => useCcCardHolderCompliance(undefined, false, true), { wrapper });
    await waitFor(() => expect(requests.length).toBeGreaterThan(0));
    expect(requests[0].url).toContain("card-holder-compliance-summary");
  });
});
