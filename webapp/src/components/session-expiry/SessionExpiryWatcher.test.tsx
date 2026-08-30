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
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SessionExpiryWatcher from "./SessionExpiryWatcher";

const signIn = vi.fn();
const signOut = vi.fn();
vi.mock("@asgardeo/react", () => ({
  useAsgardeo: () => ({ signIn, signOut }),
}));

// The bridge is module state shared by every caller; stand in for it rather
// than reaching into the real one.
const { expired, subs } = vi.hoisted(() => ({
  expired: { value: false },
  subs: new Set<() => void>(),
}));
vi.mock("@api/authBridge", () => ({
  getSessionExpiredSnapshot: () => expired.value,
  subscribeSessionExpiry: (l: () => void) => {
    subs.add(l);
    return () => subs.delete(l);
  },
}));

function show(at = "/me/par/team") {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[at]}>
        <SessionExpiryWatcher />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  signIn.mockReset();
  signOut.mockReset();
  sessionStorage.clear();
  expired.value = false;
  subs.clear();
});

describe("SessionExpiryWatcher", () => {
  it("shows nothing while the session is renewable", () => {
    show();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("raises the dialog once the bridge has given up", () => {
    expired.value = true;
    show();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Your session has expired")).toBeInTheDocument();
  });

  it("offers no way to dismiss it — every request is being refused", async () => {
    expired.value = true;
    show();
    await userEvent.setup().keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  // A HAR of the real failure: zero authorize requests, API calls returning 201
  // throughout, and the dialog stuck until the user reloaded by hand. signIn()
  // resolves without navigating when the SDK still considers the session live —
  // precisely when this dialog is most likely to be wrong — so the button did
  // nothing and the modal has no dismiss.
  it("reloads, so the button always gets the user out", async () => {
    const reload = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, reload },
    });
    expired.value = true;
    show("/me/leave/apply");
    await userEvent.setup().click(screen.getByRole("button", { name: "Sign in again" }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("does not depend on the SDK agreeing that the session is gone", async () => {
    const reload = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, reload },
    });
    expired.value = true;
    show("/me/leave/apply");
    await userEvent.setup().click(screen.getByRole("button", { name: "Sign in again" }));
    expect(signIn).not.toHaveBeenCalled();
  });


  it("offers signing out as the other way forward", async () => {
    expired.value = true;
    show();
    await userEvent.setup().click(screen.getByRole("button", { name: "Sign out" }));
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(signIn).not.toHaveBeenCalled();
  });
});
