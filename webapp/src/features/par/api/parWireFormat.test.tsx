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
import { decodeParComment } from "../util/parCommentCodec";

// The test that was missing. Every PAR comment crosses the wire as base64 of
// URI-encoded HTML; this port sent raw HTML, which would have written records
// the real app cannot read. Asserted on the PATCH body, because the codec
// having tests of its own says nothing about whether it is actually wired in.

const patched: { url: string; body: unknown }[] = [];
vi.mock("@api/http", () => ({
  authedPatch: (url: string, _token: string, body: unknown) => {
    patched.push({ url, body });
    return Promise.resolve({});
  },
  authedPost: () => Promise.resolve({}),
  authedGet: () => Promise.resolve([]),
}));

vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));
vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));
vi.mock("@hooks/useAsgardeoSub", () => ({
  useAsgardeoSub: () => ({ state: { status: "ready", sub: "sub-1" }, retry: vi.fn() }),
  foldIdentityError: (q: unknown) => q,
}));
vi.mock("@hooks/useAsgardeoUser", () => ({
  useAsgardeoUser: () => ({ ready: true, email: "me@wso2.com" }),
}));
vi.mock("./useParMe", () => ({ isParBackendConfigured: () => true, useParMe: () => ({}) }));

const { useSaveMyPar, useSubmitThreeSixtyReview } = await import("./useParEmployeeMutations");
const { useSaveLeadReview } = await import("./useParLead");

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const HTML = "<p>Shipped the <strong>gateway</strong>.</p>";

beforeEach(() => {
  patched.length = 0;
});

describe("what the employee's own save puts on the wire", () => {
  it("sends base64, not the HTML it was given", async () => {
    const { result } = renderHook(() => useSaveMyPar(), { wrapper });
    result.current.mutate({
      parCycleId: 7,
      parRatingId: 42,
      parEmployeeComment: HTML,
    });

    await waitFor(() => expect(patched).toHaveLength(1));
    const body = patched[0].body as { parEmployeeComment: string };
    expect(body.parEmployeeComment).not.toBe(HTML);
    expect(decodeParComment(body.parEmployeeComment)).toBe(HTML);
  });
});

describe("what the lead's save puts on the wire", () => {
  it("encodes the lead comment", async () => {
    const { result } = renderHook(() => useSaveLeadReview(), { wrapper });
    result.current.mutate({
      parCycleId: 7,
      parRatingId: 42,
      employeeEmail: "ann@wso2.com",
      parLeadComment: HTML,
      parRating: "Successful",
      parSpecialRating: "NOT_ASSIGNED",
      parPerformanceNoticeAck: "",
    });

    await waitFor(() => expect(patched).toHaveLength(1));
    const body = patched[0].body as { parLeadComment: string; parRating: string };
    expect(body.parLeadComment).not.toBe(HTML);
    expect(decodeParComment(body.parLeadComment)).toBe(HTML);
    // Fields that are not prose are untouched.
    expect(body.parRating).toBe("Successful");
  });
});

describe("what a 360 submission puts on the wire", () => {
  it("encodes the review comment", async () => {
    const { result } = renderHook(() => useSubmitThreeSixtyReview(), { wrapper });
    result.current.mutate({
      parCycleId: 7,
      employeeEmail: "ann@wso2.com",
      reviewStatus: "SHARED",
      reviewRating: "Strong",
      reviewComment: HTML,
    });

    await waitFor(() => expect(patched).toHaveLength(1));
    const body = patched[0].body as { reviewComment: string; reviewRating: string };
    expect(decodeParComment(body.reviewComment)).toBe(HTML);
    expect(body.reviewRating).toBe("Strong");
  });

  it("sends an empty comment as empty, not as encoded emptiness", async () => {
    const { result } = renderHook(() => useSubmitThreeSixtyReview(), { wrapper });
    result.current.mutate({
      parCycleId: 7,
      employeeEmail: "ann@wso2.com",
      reviewStatus: "REJECTED",
    });

    await waitFor(() => expect(patched).toHaveLength(1));
    expect((patched[0].body as { reviewComment: string }).reviewComment).toBe("");
  });
});
