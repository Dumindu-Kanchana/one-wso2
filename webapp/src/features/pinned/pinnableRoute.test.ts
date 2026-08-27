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
import { isKnownRoute, pinnableRoute } from "@features/pinned/pinnableRoute";

describe("pinnableRoute", () => {
  it("labels a perspective landing route from the registry", () => {
    expect(pinnableRoute("/people-ops")).toMatchObject({
      kind: "page",
      id: "/people-ops",
      label: "People Ops",
      href: "/people-ops",
    });
  });

  it("qualifies an app item with its app so global pins stay unambiguous", () => {
    // "History" alone appears under OPD, Credit Card, and Expense Claims.
    expect(pinnableRoute("/me/opd/history").label).toBe("OPD Claims · Claim History");
    expect(pinnableRoute("/me/expense/history").label).toBe(
      "Expense Claims · Claim History",
    );
    expect(pinnableRoute("/me/opd/history").label).not.toBe(
      pinnableRoute("/me/expense/history").label,
    );
  });

  // A route added without a registry `path` gets a guessed label instead of a
  // qualified one, so this doubles as the check that a newly ported app was
  // wired into the registry and not just into the router.
  it("qualifies a ported app's screen from the registry", () => {
    expect(pinnableRoute("/workspace/menu").label).toBe("Menu · Home");
    expect(isKnownRoute("/workspace/menu")).toBe(true);
    // Same check for PAR: a route added to App.tsx but not to the registry
    // would get a guessed label instead of a qualified one.
    expect(pinnableRoute("/me/par").label).toBe("PAR · My PAR");
    expect(isKnownRoute("/me/par")).toBe(true);
    expect(pinnableRoute("/me/par/history").label).toBe("PAR · History");
    expect(isKnownRoute("/me/par/history")).toBe(true);
    expect(pinnableRoute("/me/par/team").label).toBe("PAR · My Team's PAR");
    expect(isKnownRoute("/me/par/team")).toBe(true);
  });

  // Detail routes aren't in the registry — one entry cannot enumerate every
  // employee — so they take their parent's label plus the leaf. Without this a
  // pin reads as a bare id with nothing to say where it came from.
  it("qualifies a detail route by the route it sits under", () => {
    expect(pinnableRoute("/me/my-team/E123").label).toBe("My Team · E123");
    expect(pinnableRoute("/me/opd/history/CLM-9").label).toBe("OPD Claims · Claim History · CLM-9");
  });

  it("labels a leaf section that is a route", () => {
    expect(pinnableRoute("/me/my-team").label).toBe("My Team");
  });

  it("treats query state as a distinct 'search' pin", () => {
    const plain = pinnableRoute("/me/leave/history");
    const filtered = pinnableRoute("/me/leave/history", "?status=pending");
    expect(plain.kind).toBe("page");
    expect(filtered.kind).toBe("search");
    // Distinct ids, so pinning the filtered view doesn't overwrite the plain one.
    expect(filtered.id).not.toBe(plain.id);
    expect(filtered.href).toBe("/me/leave/history?status=pending");
  });

  it("ignores an empty query string rather than calling it a search", () => {
    expect(pinnableRoute("/people-ops", "?").kind).toBe("page");
    expect(pinnableRoute("/people-ops", "").kind).toBe("page");
  });

  it("falls back to a humanized segment for an unregistered route", () => {
    expect(pinnableRoute("/some/unknown-page").label).toBe("Unknown page");
    expect(pinnableRoute("/").label).toBe("Page");
  });

  // React Router matches a trailing slash, so the URL reaches here either way.
  // Without normalizing, the registry lookup missed: the label degraded to a
  // guess and the id/href differed, so the same page pinned twice.
  it("resolves a route with a trailing slash to its canonical entry", () => {
    expect(pinnableRoute("/me/opd/history/")).toMatchObject({
      kind: "page",
      id: "/me/opd/history",
      label: "OPD Claims · Claim History",
      href: "/me/opd/history",
    });
    expect(pinnableRoute("/me/opd/history/")).toEqual(pinnableRoute("/me/opd/history"));
  });

  it("keeps the root path intact when normalizing", () => {
    expect(pinnableRoute("/").href).toBe("/");
  });
});

describe("isKnownRoute", () => {
  it("distinguishes registry routes from guessed ones", () => {
    expect(isKnownRoute("/people-ops")).toBe(true);
    expect(isKnownRoute("/me/leave/apply")).toBe(true);
    expect(isKnownRoute("/some/unknown-page")).toBe(false);
  });

  it("recognises a route with a trailing slash", () => {
    expect(isKnownRoute("/me/leave/apply/")).toBe(true);
  });
});

// pinnableRoute runs during render (PinThisPageButton calls it while
// rendering), so a throw here takes the button down rather than just labelling
// itself oddly.
describe("malformed percent encoding in a detail route", () => {
  it("keeps the raw segment instead of throwing", () => {
    // decodeURIComponent("%") throws URIError.
    expect(() => pinnableRoute("/me/my-team/%")).not.toThrow();
    expect(pinnableRoute("/me/my-team/%").label).toBe("My Team · %");
  });

  it("survives other invalid escapes", () => {
    for (const leaf of ["%zz", "%E0%A4%A", "100%"]) {
      expect(() => pinnableRoute(`/me/my-team/${leaf}`), leaf).not.toThrow();
    }
  });

  it("still decodes a valid escape", () => {
    expect(pinnableRoute("/me/my-team/E%20123").label).toBe("My Team · E 123");
  });
});

