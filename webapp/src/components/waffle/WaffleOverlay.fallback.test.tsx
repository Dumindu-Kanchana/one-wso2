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

/**
 * The line-glyph fallback, on its own, because it cannot be reached otherwise.
 *
 * Every perspective that exists today has a mark, so the fallback branch in
 * WaffleOverlay is unreachable through the real registry — an assertion about it
 * there passes without executing. That is precisely how documented fallbacks rot.
 * This file registers a perspective with no mark so the branch actually runs.
 *
 * It also stands in for the next real one: PERSPECTIVES gains entries over time,
 * and authoring a mark is a design task rather than a code change, so a new
 * perspective is expected to arrive un-marked and still render a usable tile.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { HouseIcon, PackageIcon } from "@wso2/oxygen-ui-icons-react";

vi.mock("@hooks/useAsgardeoSub", () => ({
  useAsgardeoSub: () => ({ state: { status: "ready", sub: "user-under-test" }, retry: () => {} }),
}));

vi.mock("@context/perspective/PerspectiveContext", () => ({
  useActivePerspective: () => ({ key: "me", label: "Me", path: "/me", access: true }),
}));

// "me" keeps its real mark; "warehouse" is invented and has none.
vi.mock("@constants/perspectives", () => ({
  PERSPECTIVES: [
    { key: "me", label: "Me", icon: HouseIcon, access: true, path: "/me" },
    { key: "warehouse", label: "Warehouse", icon: PackageIcon, access: true, path: "/warehouse" },
  ],
  FUNCTIONAL_PERSPECTIVES: [
    { key: "me", label: "Me", icon: HouseIcon, access: true, path: "/me" },
    { key: "warehouse", label: "Warehouse", icon: PackageIcon, access: true, path: "/warehouse" },
  ],
  reachablePerspectives: () => [
    { key: "me", label: "Me", icon: HouseIcon, access: true, path: "/me" },
    { key: "warehouse", label: "Warehouse", icon: PackageIcon, access: true, path: "/warehouse" },
  ],
  findPerspectiveByKey: (k: string) =>
    k === "me" ? { key: "me", label: "Me", icon: HouseIcon, access: true, path: "/me" } : undefined,
  findPerspectiveByPath: () => undefined,
}));

const { default: WaffleOverlay } = await import("@components/waffle/WaffleOverlay");

/** Opens the launcher against a throwaway anchor, as the top bar does. */
function renderLauncher() {
  const anchor = document.createElement("button");
  document.body.appendChild(anchor);
  render(
    <MemoryRouter>
      <WaffleOverlay anchorEl={anchor} onClose={() => {}} />
    </MemoryRouter>,
  );
}

const panel = () => screen.getByRole("dialog", { name: "All apps" });

describe("launcher fallback for a perspective with no mark", () => {
  it("renders its line glyph instead, so the tile still works", () => {
    renderLauncher();
    const tile = within(panel()).getAllByRole("button", { name: "Switch to Warehouse" })[0];
    expect(tile.querySelector('svg[viewBox="0 0 48 48"]')).toBeNull();
    expect(tile.querySelector("svg.lucide"), "no line glyph either").not.toBeNull();
  });

  it("still gives the marked perspective beside it its mark", () => {
    renderLauncher();
    const tile = within(panel()).getAllByRole("button", { name: "Switch to Me" })[0];
    expect(tile.querySelector('svg[viewBox="0 0 48 48"]')).not.toBeNull();
  });
});
