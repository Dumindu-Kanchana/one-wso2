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
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import CancelDinnerDialog from "./CancelDinnerDialog";

// The dialog only needs a token and a subject; the network call is stubbed.
vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));
vi.mock("@hooks/useAsgardeoSub", () => ({
  useAsgardeoSub: () => ({ state: { status: "ready", sub: "user-under-test" }, retry: () => {} }),
}));
vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));

const showSuccess = vi.fn();
const showError = vi.fn();
vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showSuccess, showError, showWarning: vi.fn() }),
}));

// Resolves only when we say so, so the pending window can be inspected.
let releaseDelete: (() => void) | undefined;
const authedDelete = vi.fn(
  () =>
    new Promise<void>((resolve) => {
      releaseDelete = () => resolve();
    }),
);
vi.mock("@api/http", async () => {
  const actual = await vi.importActual<typeof import("@api/http")>("@api/http");
  return { ...actual, authedDelete: (...args: unknown[]) => authedDelete(...(args as [])) };
});

function renderDialog() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CancelDinnerDialog open onClose={() => {}} mealLabel="Fish" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  authedDelete.mockClear();
  showSuccess.mockClear();
  showError.mockClear();
  releaseDelete = undefined;
});

describe("CancelDinnerDialog", () => {
  // The regression this exists for: in the standalone app the confirm button
  // only changed colour while the request was in flight and stayed clickable,
  // so an impatient double-click sent two cancels.
  //
  // Asserted by driving raw click events at the button after the first one.
  // userEvent is deliberately not used for the follow-ups: it refuses to click a
  // disabled control, which would make this pass by throwing rather than by
  // proving the handler stayed shut.
  it("sends one cancel however many times the confirm is clicked", async () => {
    renderDialog();
    const confirm = screen.getByRole("button", { name: "Cancel order" });

    await userEvent.setup().click(confirm);
    expect(authedDelete).toHaveBeenCalledTimes(1);

    // Same button, now in its pending state.
    const pending = screen.getByRole("button", { name: "Cancelling…" });
    fireEvent.click(pending);
    fireEvent.click(pending);

    expect(authedDelete).toHaveBeenCalledTimes(1);
    releaseDelete?.();
  });

  it("disables both actions while the cancel is in flight", async () => {
    renderDialog();
    await userEvent.setup().click(screen.getByRole("button", { name: "Cancel order" }));

    expect(screen.getByRole("button", { name: "Cancelling…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Keep my order" })).toBeDisabled();
    releaseDelete?.();
  });
});
