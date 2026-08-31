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
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import WaffleOverlay from "@components/waffle/WaffleOverlay";
import { readFavourites } from "@features/favourites/favouritesStore";
import { PERSPECTIVES } from "@constants/perspectives";

vi.mock("@hooks/useAsgardeoSub", () => ({
  useAsgardeoSub: () => ({ state: { status: "ready", sub: "user-under-test" }, retry: () => {} }),
}));

vi.mock("@context/perspective/PerspectiveContext", () => ({
  useActivePerspective: () => ({ key: "me", label: "Me", path: "/me", access: true }),
}));

beforeEach(() => localStorage.clear());

function renderLauncher() {
  const anchor = document.createElement("button");
  document.body.appendChild(anchor);
  render(
    <MemoryRouter>
      <WaffleOverlay anchorEl={anchor} onClose={() => {}} />
    </MemoryRouter>,
  );
  return anchor;
}

/** The panel, so queries don't pick up the anchor or other stray nodes. */
const panel = () => screen.getByRole("dialog", { name: "All apps" });

describe("launcher favourites", () => {
  it("offers a star on an app that can be opened", () => {
    renderLauncher();
    expect(
      within(panel()).getByRole("button", { name: "Add Finance to favourites" }),
    ).toBeInTheDocument();
  });

  it("offers no star on an app that cannot be opened", () => {
    renderLauncher();
    // Named from the registry rather than hardcoded: the previous version named
    // a perspective that has since been removed, so it asserted the absence of
    // something that could not have been there.
    const unopenable = PERSPECTIVES.find((p) => !p.access);
    expect(unopenable, "no unopenable perspective left to check").toBeDefined();
    expect(
      within(panel()).queryByRole("button", {
        name: new RegExp(`${unopenable!.label} to favourites`),
      }),
    ).toBeNull();
    // And it is still offered as a tile, just not as a favourite.
    expect(
      within(panel()).getByRole("button", { name: `${unopenable!.label} — not available yet` }),
    ).toBeInTheDocument();
  });

  it("keeps the star out of the tile button, so the markup stays valid", () => {
    renderLauncher();
    const star = within(panel()).getByRole("button", { name: "Add Finance to favourites" });
    // A <button> inside a <button> is invalid HTML that browsers resolve
    // unpredictably, so the star must be a sibling of the tile.
    expect(star.closest("button")).toBe(star);
  });

  it("shows Favourites from the start, holding Me", () => {
    // Me is a default favourite. The launcher has no "For you" group any more,
    // so this is the only tile for it on a first visit.
    renderLauncher();
    expect(within(panel()).getByRole("heading", { name: "Favourites" })).toBeInTheDocument();
    expect(readFavourites("user-under-test")).toEqual(["me"]);
  });

  it("appends a newly favourited app after the default", () => {
    renderLauncher();
    return userEvent
      .setup()
      .click(within(panel()).getByRole("button", { name: "Add Finance to favourites" }))
      .then(() => {
        expect(readFavourites("user-under-test")).toEqual(["me", "finance"]);
      });
  });

  it("hides the group entirely once the user has removed everything", () => {
    // An empty "Favourites" heading is worse than no heading. This is the case
    // the group's own render guard exists for.
    localStorage.setItem("one-wso2.favourites.v1.user-under-test", JSON.stringify([]));
    renderLauncher();
    expect(within(panel()).queryByRole("heading", { name: "Favourites" })).toBeNull();
  });

  it("shows a favourited app in both Favourites and its own group", () => {
    localStorage.setItem("one-wso2.favourites.v1.user-under-test", JSON.stringify(["finance"]));
    renderLauncher();
    // Two tiles for the same app is the point of a shortcut, not a bug.
    expect(within(panel()).getAllByRole("button", { name: "Switch to Finance" })).toHaveLength(2);
  });

  it("removes a favourite again", async () => {
    localStorage.setItem("one-wso2.favourites.v1.user-under-test", JSON.stringify(["finance"]));
    renderLauncher();
    const remove = within(panel()).getAllByRole("button", {
      name: "Remove Finance from favourites",
    });
    await userEvent.setup().click(remove[0]);
    expect(readFavourites("user-under-test")).toEqual([]);
    expect(within(panel()).queryByRole("heading", { name: "Favourites" })).toBeNull();
  });
});
