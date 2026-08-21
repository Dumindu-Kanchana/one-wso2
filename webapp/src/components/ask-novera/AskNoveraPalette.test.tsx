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
import AskNoveraPalette from "@components/ask-novera/AskNoveraPalette";
import { __resetForTests, togglePin } from "@features/pinned/pinnedStore";

// The palette resolves the pinned bucket through this; a fixed sub keeps it stable.
vi.mock("@hooks/useAsgardeoSub", () => ({
  useAsgardeoSub: () => ({
    state: { status: "ready", sub: "user-under-test" },
    retry: () => {},
  }),
}));

const onClose = vi.fn();

beforeEach(() => {
  localStorage.clear();
  __resetForTests();
  onClose.mockClear();
});

/** Renders the palette alongside a control that must stay unreachable. */
function renderPalette() {
  return render(
    <MemoryRouter>
      <button type="button">behind the overlay</button>
      <AskNoveraPalette onClose={onClose} />
    </MemoryRouter>,
  );
}

describe("AskNoveraPalette", () => {
  it("presents as a modal dialog", () => {
    renderPalette();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("Ask Novera")).toBeInTheDocument();
  });

  it("lists pinned entries", () => {
    togglePin({ kind: "page", id: "/me/my-team", label: "My Team", href: "/me/my-team" });
    renderPalette();
    expect(screen.getByRole("button", { name: "My Team" })).toBeInTheDocument();
  });

  // Being a real modal, the overlay also hides the rest of the page from the
  // accessibility tree — which the hand-rolled version never did. Hence
  // getByText rather than getByRole for the control behind it.
  it("hides the page behind it from assistive technology", () => {
    renderPalette();
    expect(screen.getByText("behind the overlay").closest("[aria-hidden]")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  // The regression this exists for: the hand-rolled version trapped Tab only
  // while the panel had nothing focusable inside it, so listing pins let Tab
  // walk straight out of the overlay to the page behind it.
  it("keeps Tab inside the overlay when pinned rows are listed", async () => {
    togglePin({ kind: "page", id: "/me/my-team", label: "My Team", href: "/me/my-team" });
    togglePin({ kind: "page", id: "/people-ops", label: "People Ops", href: "/people-ops" });
    renderPalette();

    const user = userEvent.setup();
    const outside = screen.getByText("behind the overlay");
    // The portal, not the dialog element: the focus trap's sentinel nodes are
    // the dialog's siblings inside it.
    const portal = screen.getByRole("dialog").closest(".MuiModal-root");

    // Enough passes to wrap around the whole trap more than once.
    for (let i = 0; i < 8; i++) {
      await user.tab();
      expect(outside).not.toHaveFocus();
      expect(portal).toContainElement(document.activeElement as HTMLElement);
    }
  });

  it("closes on Escape", async () => {
    renderPalette();
    await userEvent.setup().keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
});
