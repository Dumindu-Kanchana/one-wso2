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
import PinThisPageButton from "@features/pinned/components/PinThisPageButton";
import {
  MAX_PINNED,
  __resetForTests,
  readEntries,
  togglePin,
} from "@features/pinned/pinnedStore";

// The SDK reads window.config at module load and performs a real token decode;
// neither exists under jsdom. Only `isSignedIn` matters to this component.
vi.mock("@asgardeo/react", () => ({
  useAsgardeo: () => ({ isSignedIn: true }),
}));

// The button resolves identity through this; a fixed sub keeps the bucket stable.
vi.mock("@hooks/useAsgardeoSub", () => ({
  useAsgardeoSub: () => ({
    state: { status: "ready", sub: "user-under-test" },
    retry: () => {},
  }),
}));

const showWarning = vi.fn();
vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showWarning }),
}));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <PinThisPageButton />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  __resetForTests();
  showWarning.mockClear();
});

describe("PinThisPageButton", () => {
  it("pins the current route and reflects it in the control", async () => {
    renderAt("/me/leave/history");
    const button = screen.getByRole("button", { name: /pin this page/i });
    expect(button).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(button);

    expect(readEntries().filter((e) => e.pinned).map((e) => e.href)).toEqual([
      "/me/leave/history",
    ]);
    expect(
      screen.getByRole("button", { name: /unpin this page/i }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("stores the registry label, not a path guess", async () => {
    renderAt("/me/opd/history");
    await userEvent.click(screen.getByRole("button", { name: /pin this page/i }));
    expect(readEntries()[0].label).toBe("OPD Claims · Claim History");
  });

  it("unpins on a second click", async () => {
    renderAt("/people-ops");
    await userEvent.click(screen.getByRole("button", { name: /pin this page/i }));
    await userEvent.click(screen.getByRole("button", { name: /unpin this page/i }));
    expect(readEntries().filter((e) => e.pinned)).toEqual([]);
  });

  it("warns instead of failing silently when the set is full", async () => {
    for (let i = 0; i < MAX_PINNED; i++) {
      togglePin({ kind: "page", id: `/filler-${i}`, label: `F${i}`, href: `/filler-${i}` });
    }
    renderAt("/me/my-team");
    await userEvent.click(screen.getByRole("button", { name: /pin this page/i }));

    expect(showWarning).toHaveBeenCalledWith(
      expect.stringContaining(String(MAX_PINNED)),
    );
    // Nothing was evicted to make room.
    expect(readEntries().filter((e) => e.pinned)).toHaveLength(MAX_PINNED);
  });
});
