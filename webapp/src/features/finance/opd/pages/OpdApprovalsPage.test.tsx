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

// Every search payload the screen asks for, so the assertions are about what
// reaches the backend rather than what happens to render.
const payloads: Record<string, unknown>[] = [];

vi.mock("../useOpd", () => ({
  useOpdUserInfo: () => ({
    data: { workEmail: "finance@wso2.com", userRoles: [555] },
    isLoading: false,
    isError: false,
  }),
  useOpdClaims: (payload: Record<string, unknown>) => {
    payloads.push(payload);
    return { data: [], isLoading: false, isError: false, isSuccess: true };
  },
  useOpdEmployees: () => ({ data: [], isLoading: false, isError: false }),
}));

vi.mock("../useOpdMutations", () => ({
  useOpdClaimStatus: () => ({ mutate: vi.fn(), isPending: false }),
}));

// The tab reports its own backend's connectivity now, rather than leaving it to
// a shared frame — Claim approval spans two backends and either may be missing.
vi.mock("@config/apiConfig", async () => {
  const actual = await vi.importActual<typeof import("@config/apiConfig")>("@config/apiConfig");
  return { ...actual, isOpdBackendConfigured: () => true };
});

vi.mock("../../components/FinanceShell", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const { default: OpdApprovalsPage } = await import("./OpdApprovalsPage");
const { NotificationsProvider } = await import("@context/notifications/NotificationsContext");

beforeEach(() => {
  payloads.length = 0;
});

function show() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <NotificationsProvider>
        <OpdApprovalsPage />
      </NotificationsProvider>
    </QueryClientProvider>,
  );
}

// filteredClaimsSlice.ts:82-89. Claims filed before the status was split carry
// PENDING_OLD, and the source adds it whenever PENDING is the only status
// asked for. Asking for PENDING alone hides those claims from finance
// completely — they cannot be seen, let alone approved.
describe("what the finance queue asks for", () => {
  it("includes legacy pending claims on the Pending tab", async () => {
    show();
    await waitFor(() => expect(payloads.length).toBeGreaterThan(0));
    expect(payloads.at(-1)!.status).toEqual(["PENDING", "PENDING_OLD"]);
  });

  it("leaves the year open on Pending, so nothing ages out of the queue", async () => {
    show();
    await waitFor(() => expect(payloads.length).toBeGreaterThan(0));
    expect(payloads.at(-1)!.startYear).toBeUndefined();
    expect(payloads.at(-1)!.endYear).toBeUndefined();
  });

  it("asks only for APPROVED on the Approved tab, scoped to this year", async () => {
    show();
    fireEvent.click(await screen.findByRole("tab", { name: /Approved/ }));
    await waitFor(() => expect(payloads.at(-1)!.status).toEqual(["APPROVED"]));
    expect(payloads.at(-1)!.startYear).toBe(new Date().getFullYear());
  });

  it("asks only for REJECTED on the Rejected tab", async () => {
    show();
    fireEvent.click(await screen.findByRole("tab", { name: /Rejected/ }));
    await waitFor(() => expect(payloads.at(-1)!.status).toEqual(["REJECTED"]));
  });
});

// FilterHolder.tsx:271-296,300-306 — the finance view can narrow the queue to
// one employee or one claim id. Without them the only way to find a claim is to
// scroll the whole company's.
describe("narrowing the finance queue", () => {
  it("sends no email or id by default", async () => {
    show();
    await waitFor(() => expect(payloads.length).toBeGreaterThan(0));
    expect(payloads.at(-1)!.email).toBeUndefined();
    expect(payloads.at(-1)!.ids).toBeUndefined();
  });

  it("filters to one claim id", async () => {
    show();
    fireEvent.change(screen.getByLabelText("Filter by claim ID"), { target: { value: "C-42" } });
    await waitFor(() => expect(payloads.at(-1)!.ids).toEqual(["C-42"]));
  });

  it("keeps the tab's status while filtering", async () => {
    show();
    fireEvent.change(screen.getByLabelText("Filter by claim ID"), { target: { value: "C-42" } });
    await waitFor(() => expect(payloads.at(-1)!.ids).toEqual(["C-42"]));
    expect(payloads.at(-1)!.status).toEqual(["PENDING", "PENDING_OLD"]);
  });
});

// Raised on PR #29. useOpdClaims keys on the whole payload, so an undebounced
// claim-id field mints a key per keystroke and fires a company-wide search for
// every prefix — seven of eight matching nothing. The source batches the same
// fields behind an Apply button (FilterHolder.tsx:53,81-82,333-334).
describe("typing a claim id does not search on every keystroke", () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  // The payload is rebuilt on every render, so counting calls proves nothing.
  // What drives a fetch is the query KEY changing, so count distinct ones.
  const distinctIds = () => new Set(payloads.map((p) => JSON.stringify(p.ids)));

  it("asks for nothing new while the field is still being typed", async () => {
    show();
    await waitFor(() => expect(payloads.length).toBeGreaterThan(0));

    const field = screen.getByLabelText("Filter by claim ID");
    for (const value of ["C", "C-", "C-4", "C-42"]) {
      fireEvent.change(field, { target: { value } });
    }
    // Four keystrokes, still one query key — no prefix search went out.
    expect(distinctIds()).toEqual(new Set([JSON.stringify(undefined)]));
  });

  it("searches once the typing settles", async () => {
    show();
    await waitFor(() => expect(payloads.length).toBeGreaterThan(0));
    const field = screen.getByLabelText("Filter by claim ID");
    for (const value of ["C", "C-", "C-4", "C-42"]) {
      fireEvent.change(field, { target: { value } });
    }
    await vi.advanceTimersByTimeAsync(400);
    await waitFor(() => expect(payloads.at(-1)!.ids).toEqual(["C-42"]));
    // Two keys in total: the unfiltered one, and the settled search.
    expect(distinctIds()).toEqual(
      new Set([JSON.stringify(undefined), JSON.stringify(["C-42"])]),
    );
  });
});
