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

// These exercise the queryFn itself. Every other test in this feature mocks the
// hooks, which is why a search that fired, returned 200 and was then discarded
// went unnoticed: `res?.body` on a bare array is undefined, so every claim list
// rendered empty while the network tab looked healthy.

const responses: { searchClaims: unknown } = { searchClaims: [] };
const requests: { url: string; body?: unknown }[] = [];

vi.mock("@api/http", () => ({
  authedGet: (url: string) => {
    requests.push({ url });
    return Promise.resolve([]);
  },
  authedPost: (url: string, _t: string, body: unknown) => {
    requests.push({ url, body });
    return Promise.resolve(responses.searchClaims);
  },
  authedPut: () => Promise.resolve({}),
  authedDelete: () => Promise.resolve(undefined),
}));
vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));
vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));
vi.mock("@hooks/useAsgardeoSub", () => ({
  useAsgardeoSub: () => ({ state: { status: "ready", sub: "sub-1" }, retry: vi.fn() }),
  foldIdentityError: (q: unknown) => q,
}));
vi.mock("@config/apiConfig", () => ({
  isExpenseBackendConfigured: () => true,
  expenseServiceUrls: {
    appData: "https://expense.test/app-data",
    searchClaims: "https://expense.test/search-claims",
    claims: "https://expense.test/claims",
    claimDrafts: "https://expense.test/claim-drafts",
    claimStatus: (id: string) => `https://expense.test/claims/${id}/status`,
    claimTransactions: (id: string) => `https://expense.test/claims/${id}/transactions`,
    employees: "https://expense.test/employees",
    expenseTypes: () => "https://expense.test/user-configurations/expense-types",
    exchangeRates: (b: string, d: string) => `https://expense.test/currencies/${b}/rates/${d}`,
    receiptUpload: (e: string) => `https://expense.test/claims/${e}/receipts`,
    receiptFile: (f: string) => `https://expense.test/receipts/${f}`,
  },
}));

const { useExpenseClaims } = await import("./useExpense");

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const claim = { id: "EC-1", transactions: [], totalAmount: 10 };

beforeEach(() => {
  requests.length = 0;
  responses.searchClaims = [];
});

// tableSlice.ts:57 assigns `resp.data` straight to `Claim[]`, and axios's `data`
// IS the response body — so /search-claims answers with the array itself, not a
// `{ body: [...] }` wrapper. Unwrapping one discarded every result.
describe("what /search-claims answers with", () => {
  it("keeps the claims the backend returned", async () => {
    responses.searchClaims = [claim];
    const { result } = renderHook(() => useExpenseClaims({ email: "me@wso2.com" }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([claim]);
  });

  it("posts to the search endpoint with the filter as the body", async () => {
    renderHook(() => useExpenseClaims({ email: "me@wso2.com", limit: 100 }), { wrapper });
    await waitFor(() => expect(requests.length).toBeGreaterThan(0));
    expect(requests[0].url).toBe("https://expense.test/search-claims");
    expect(requests[0].body).toEqual({ email: "me@wso2.com", limit: 100 });
  });

  it("gives an empty list, not a crash, if the shape is ever not an array", async () => {
    responses.searchClaims = { body: [claim] };
    const { result } = renderHook(() => useExpenseClaims({ email: "me@wso2.com" }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });
});
