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

/**
 * What the server actually sends back, read through the REAL http helpers.
 *
 * ccWireFormat.test.tsx mocks `@api/http` wholesale, so it can prove which URL
 * was called but never how the answer is read — it stubs out the exact layer
 * that decides JSON versus text. That is why it passed while every successful
 * write in this feature was being reported to the reader as a failure.
 *
 * The cc backend declares its write successes as
 * `record {| *http:Ok; string body; |}` (backend types.bal:91-93, :129-131),
 * where `body` IS the payload. So a 200 carries a bare sentence. Running that
 * through JSON.parse throws, and the mutation's onError fires after the work
 * has already been done on the server.
 */
vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));
vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));

const reply = { status: 200, body: "" };
const calls: string[] = [];

beforeEach(() => {
  reply.status = 200;
  reply.body = "";
  calls.length = 0;
  vi.stubGlobal("fetch", async (url: string) => {
    calls.push(String(url));
    return {
      ok: reply.status >= 200 && reply.status < 300,
      status: reply.status,
      headers: { get: () => null },
      text: async () => reply.body,
      json: async () => JSON.parse(reply.body),
    };
  });
});

const {
  useCcApprove,
  useCcCardLabel,
  useCcEmployeeSubmit,
  useCcSaveDraft,
  useCcSaveEdit,
} = await import("./useCcMutations");

function wrap({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

// The exact sentences the backend returns, from service.bal.
const SENTENCES = {
  submit: "Successfully submitted 3 credit card transaction(s) for lead approval.",
  draft: "Successfully saved 3 drafted credit card transaction(s).",
  edit: "Successfully saved 2 edited credit card transaction(s).",
  approve: "Successfully approved 2 credit card transaction(s).",
  label: "Successfully updated the credit card: 5 label: Travel.",
};

describe("a write that succeeded is treated as a success", () => {
  it("employee-submit, whose 200 is a sentence", async () => {
    reply.body = SENTENCES.submit;
    const { result } = renderHook(() => useCcEmployeeSubmit(), { wrapper: wrap });
    result.current.mutate([]);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.isError).toBe(false);
  });

  it("save-draft, which the autosave calls every five seconds", async () => {
    reply.body = SENTENCES.draft;
    const { result } = renderHook(() => useCcSaveDraft(), { wrapper: wrap });
    result.current.mutate([]);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("save-edit", async () => {
    reply.body = SENTENCES.edit;
    const { result } = renderHook(() => useCcSaveEdit(), { wrapper: wrap });
    result.current.mutate([]);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("lead-approve", async () => {
    reply.body = SENTENCES.approve;
    const { result } = renderHook(() => useCcApprove("lead"), { wrapper: wrap });
    result.current.mutate([1, 2]);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("finance-approve", async () => {
    reply.body = SENTENCES.approve;
    const { result } = renderHook(() => useCcApprove("finance"), { wrapper: wrap });
    result.current.mutate([1, 2]);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("the card rename, which is a PATCH", async () => {
    reply.body = SENTENCES.label;
    const { result } = renderHook(() => useCcCardLabel(), { wrapper: wrap });
    result.current.mutate({ id: 5, label: "Travel" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe("a write that genuinely failed still fails", () => {
  it("a 500 is an error, not a success", async () => {
    reply.status = 500;
    reply.body = "Error saving credit card transactions.";
    const { result } = renderHook(() => useCcEmployeeSubmit(), { wrapper: wrap });
    result.current.mutate([]);
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
