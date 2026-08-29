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

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { PerspectiveProvider, useActivePerspective } from "./PerspectiveContext";

function ActiveKey() {
  return <span data-testid="active">{useActivePerspective().key}</span>;
}

/** Renders at `path`, optionally with the navigation state a caller passed. */
function activeAt(path: string, state?: unknown): string {
  const view = render(
    <MemoryRouter initialEntries={[{ pathname: path, state }]}>
      <PerspectiveProvider>
        <ActiveKey />
      </PerspectiveProvider>
    </MemoryRouter>,
  );
  const key = screen.getByTestId("active").textContent ?? "";
  view.unmount();
  return key;
}

describe("routes that own a perspective", () => {
  it("resolves each one to itself", () => {
    expect(activeAt("/me")).toBe("me");
    expect(activeAt("/me/leave/apply")).toBe("me");
    expect(activeAt("/people-ops")).toBe("people");
    expect(activeAt("/finance")).toBe("finance");
    expect(activeAt("/marketing-ops")).toBe("marketing");
  });
});

// /settings is top-level and belongs to no perspective — the only route in
// App.tsx that isn't under one. The fallback used to be People Ops, so opening
// Settings relabelled the rail "People Ops" and swapped in its sections; and
// SideRail navigates to active.path when the pathname differs, so it could
// bounce the user out of Settings altogether.
describe("/settings, which owns no perspective", () => {
  it("does not fall back to People Ops", () => {
    expect(activeAt("/settings")).not.toBe("people");
  });

  it("falls back to Me on a cold deep link, with nothing to go on", () => {
    expect(activeAt("/settings")).toBe("me");
  });

  it("keeps the rail on the perspective that sent the user there", () => {
    expect(activeAt("/settings", { fromPerspective: "marketing" })).toBe("marketing");
    expect(activeAt("/settings", { fromPerspective: "finance" })).toBe("finance");
    expect(activeAt("/settings", { fromPerspective: "people" })).toBe("people");
  });

  it("ignores state that names no real perspective", () => {
    expect(activeAt("/settings", { fromPerspective: "nonsense" })).toBe("me");
    expect(activeAt("/settings", { fromPerspective: 42 })).toBe("me");
    expect(activeAt("/settings", {})).toBe("me");
  });
});

describe("an unknown route", () => {
  it("falls back to Me rather than People Ops", () => {
    expect(activeAt("/nowhere")).toBe("me");
  });
});
