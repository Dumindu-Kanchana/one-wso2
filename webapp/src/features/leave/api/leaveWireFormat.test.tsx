// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// Four of the five defects the audit found are payload defects: a query param
// that is not sent, a filter that is not applied, a recipient list that goes out
// empty. None of them would show in a unit test of the helper that builds the
// request — they only show on the wire. So these assert the URL and the body.

const requests: { method: string; url: string; body?: unknown }[] = [];
vi.mock("@api/http", () => ({
  authedGet: (url: string) => {
    requests.push({ method: "GET", url });
    return Promise.resolve([]);
  },
  authedPost: (url: string, _token: string, body: unknown) => {
    requests.push({ method: "POST", url, body });
    return Promise.resolve({});
  },
  authedDelete: (url: string) => {
    requests.push({ method: "DELETE", url });
    return Promise.resolve(undefined);
  },
}));
vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));
vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));
vi.mock("@hooks/useAsgardeoSub", () => ({
  useAsgardeoSub: () => ({ state: { status: "ready", sub: "sub-1" }, retry: vi.fn() }),
  foldIdentityError: (q: unknown) => q,
}));
vi.mock("@config/apiConfig", () => ({
  isLeaveBackendConfigured: () => true,
  leaveServiceUrls: {
    employees: "https://leave.test/employees",
    leaves: "https://leave.test/leaves",
    leave: (id: number) => `https://leave.test/leaves/${id}`,
    leaveAction: (id: number, a: string) => `https://leave.test/leaves/${id}/${a}`,
    userInfo: "https://leave.test/user-info",
    appConfigs: "https://leave.test/app-configs",
    leaveEntitlement: (e: string) => `https://leave.test/employees/${e}/leave-entitlement`,
  },
}));

const { useLeaveEmployees, useLeaves } = await import("./useLeaveData");
const { useSubmitLeave, useCancelLeave } = await import("./useLeaveMutations");

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  requests.length = 0;
});

// L4. The backend hands `status: ()` straight to the HR GraphQL filter when the
// param is absent, so the picker is populated from whatever that defaults to
// rather than the three the source names.
describe("the employee list", () => {
  it("asks for the three statuses the source asks for", async () => {
    renderHook(() => useLeaveEmployees(), { wrapper });
    await waitFor(() => expect(requests).toHaveLength(1));

    const url = new URL(requests[0].url);
    expect(url.pathname).toBe("/employees");
    expect(url.searchParams.getAll("employeeStatuses")).toEqual([
      "Active",
      "Marked leaver",
      "Left",
    ]);
  });
});

// L1. Not a display filter — it changes which rows the backend returns. With it
// present the backend resolves the employee set by leadEmail and clears
// approverEmail; without it, it filters on the stored approverEmail.
describe("the report filter", () => {
  it("carries employeeStatuses on the wire", async () => {
    renderHook(
      () =>
        useLeaves({
          startDate: "2026-01-01",
          endDate: "2026-12-31",
          statuses: ["APPROVED"],
          approverEmail: "lead@wso2.com",
          employeeStatuses: ["Active", "Marked leaver"],
        }),
      { wrapper },
    );
    await waitFor(() => expect(requests).toHaveLength(1));

    const url = new URL(requests[0].url);
    expect(url.searchParams.getAll("employeeStatuses")).toEqual(["Active", "Marked leaver"]);
    expect(url.searchParams.get("approverEmail")).toBe("lead@wso2.com");
  });

  it("encodes an email rather than interpolating it raw", async () => {
    // The source builds this one param with a bare template literal
    // (leaveService.ts:122) while encoding every sibling.
    renderHook(() => useLeaves({ email: "a+b@wso2.com", statuses: ["APPROVED"] }), { wrapper });
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0].url).toContain("email=a%2Bb%40wso2.com");
  });
});

describe("submitting a leave", () => {
  it("posts the recipients it was given", async () => {
    const { result } = renderHook(() => useSubmitLeave(), { wrapper });
    result.current.mutate({
      startDate: "2026-03-02",
      endDate: "2026-03-02",
      periodType: "one",
      isMorningLeave: null,
      leaveType: "casual",
      comment: null,
      emailRecipients: ["colleague@wso2.com"],
      isPublicComment: false,
    });
    await waitFor(() => expect(requests).toHaveLength(1));

    expect(requests[0].method).toBe("POST");
    expect(requests[0].url).toContain("isValidationOnlyMode=false");
    expect(requests[0].body).toMatchObject({
      leaveType: "casual",
      emailRecipients: ["colleague@wso2.com"],
    });
  });
});

// L2. Submitting spends entitlement, and ["leave-entitlement"] carries a
// five-minute staleTime — so invalidating only ["leaves"] left the balance
// panel showing pre-submit figures for that long.
describe("what a submit invalidates", () => {
  it("invalidates the balance as well as the list", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidated: unknown[] = [];
    const spy = vi.spyOn(client, "invalidateQueries").mockImplementation((arg) => {
      invalidated.push((arg as { queryKey?: unknown })?.queryKey);
      return Promise.resolve();
    });

    const { result } = renderHook(() => useSubmitLeave(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });
    result.current.mutate({
      startDate: "2026-03-02",
      endDate: "2026-03-02",
      periodType: "one",
      isMorningLeave: null,
      leaveType: "casual",
      comment: null,
      emailRecipients: [],
      isPublicComment: false,
    });

    await waitFor(() => expect(invalidated.length).toBeGreaterThanOrEqual(2));
    expect(invalidated).toContainEqual(["leaves"]);
    expect(invalidated).toContainEqual(["leave-entitlement"]);
    spy.mockRestore();
  });
});

describe("cancelling", () => {
  it("deletes by id, with no body", async () => {
    const { result } = renderHook(() => useCancelLeave(), { wrapper });
    result.current.mutate(42);
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]).toMatchObject({ method: "DELETE", url: "https://leave.test/leaves/42" });
  });
});
