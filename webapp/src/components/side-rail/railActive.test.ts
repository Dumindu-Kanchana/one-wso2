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

import { describe, expect, it } from "vitest";
import { activeGroupIds, activeItemId, onPathOrBelow } from "./railActive";
import type { PerspectiveSection } from "@constants/perspectives";

// Driven off the real registry, not a fixture: the bug this covers was a rail
// path that stopped being a whole route, and a fixture would have been updated
// alongside the routes and never noticed.
const { ME_APPS } = await import("@constants/meApps");

const leaveApp = ME_APPS.find((a) => a.key === "leave")!;
const sections: PerspectiveSection[] = [
  {
    id: "leave",
    label: leaveApp.name,
    children: leaveApp.items.map((it) => ({ id: it.id, label: it.label, path: it.path })),
  },
  {
    id: "my-team-section",
    label: "My Team",
    children: [{ id: "my-team", label: "My Team", path: "/me/my-team" }],
  },
];

const itemFor = (pathname: string) =>
  activeItemId({ sections, pathname, overviewPath: "/me", overviewId: "overview" });

// Every screen the Leave app can be on. A row must light on all of them, and
// the group holding it must be open, or the lit row is folded out of sight.
const LEAVE_URLS: [string, string][] = [
  ["/me/leave/general", "leave-general"],
  ["/me/leave/general/apply", "leave-general"],
  ["/me/leave/general/history", "leave-general"],
  ["/me/leave/general/reports", "leave-general"],
  ["/me/leave/sabbatical", "leave-sabbatical"],
  ["/me/leave/sabbatical/apply", "leave-sabbatical"],
  ["/me/leave/sabbatical/history", "leave-sabbatical"],
  ["/me/leave/sabbatical/approve", "leave-sabbatical"],
  ["/me/leave/sabbatical/approval-history", "leave-sabbatical"],
  ["/me/leave/sabbatical/report", "leave-sabbatical"],
];

describe("which row is selected", () => {
  for (const [url, expected] of LEAVE_URLS) {
    it(`lights ${expected} on ${url}`, () => {
      expect(itemFor(url)).toBe(expected);
    });
  }

  it("keeps a detail route under its own section", () => {
    expect(itemFor("/me/my-team/E123")).toBe("my-team");
  });

  it("falls back to the overview when nothing else matches", () => {
    expect(itemFor("/me")).toBe("overview");
  });

  it("lights nothing on an unrelated route", () => {
    expect(itemFor("/somewhere-else")).toBe("");
  });
});

// The reported bug. Every leave URL resolved its row correctly, but the group
// was computed with an exact match only, so on a tab route no child matched and
// the accordion stayed shut — the highlight was there and invisible.
describe("which groups are open", () => {
  for (const [url] of LEAVE_URLS) {
    it(`opens Leave on ${url}`, () => {
      expect(activeGroupIds(sections, url).has("leave")).toBe(true);
    });
  }

  it("opens the section a detail route belongs to", () => {
    expect(activeGroupIds(sections, "/me/my-team/E123").has("my-team-section")).toBe(true);
  });

  it("opens nothing on an unrelated route", () => {
    expect(activeGroupIds(sections, "/somewhere-else").size).toBe(0);
  });

  it("does not open a group for a path that merely shares a prefix string", () => {
    expect(activeGroupIds(sections, "/me/leave/generalization").size).toBe(0);
  });
});

describe("matching by segment, not by string", () => {
  it("claims a path and everything beneath it", () => {
    expect(onPathOrBelow("/me/leave/general", "/me/leave/general")).toBe(true);
    expect(onPathOrBelow("/me/leave/general", "/me/leave/general/apply")).toBe(true);
    expect(onPathOrBelow("/me/leave/general", "/me/leave/general/apply/")).toBe(true);
  });

  it("does not claim a longer word starting with it", () => {
    expect(onPathOrBelow("/me/leave/general", "/me/leave/generalization")).toBe(false);
  });

  it("does not claim a sibling", () => {
    expect(onPathOrBelow("/me/leave/general", "/me/leave/sabbatical/apply")).toBe(false);
  });
});

// The two-pass ordering, asserted against a shape the registry does not
// currently contain but is one entry away from: a row whose path owns another
// row's. Today only `/me` and `/people-ops` own anything, and both are
// perspective paths matched exactly, so nothing exercises this — which is
// exactly why it is worth stating rather than leaving to be rediscovered.
describe("an exact match beats a descendant one", () => {
  const nested: PerspectiveSection[] = [
    {
      id: "reports",
      label: "Reports",
      children: [
        { id: "reports-home", label: "All", path: "/people-ops/reports" },
        { id: "reports-active", label: "Active", path: "/people-ops/reports/active-employees" },
      ],
    },
  ];
  const item = (pathname: string) =>
    activeItemId({ sections: nested, pathname, overviewPath: "/people-ops", overviewId: "ov" });

  it("gives the deeper row its own URL, not the one that owns it", () => {
    expect(item("/people-ops/reports/active-employees")).toBe("reports-active");
  });

  it("still gives the owning row its own URL", () => {
    expect(item("/people-ops/reports")).toBe("reports-home");
  });

  it("falls back to the owner for a URL only it can claim", () => {
    expect(item("/people-ops/reports/something-else")).toBe("reports-home");
  });

  // Both rows can claim this one: it sits under the owner AND under the deeper
  // row. Taking whichever appears first in the registry makes the lit row
  // depend on the order entries happen to be written in.
  it("gives a deeper URL to the deeper row, not the one listed first", () => {
    expect(item("/people-ops/reports/active-employees/E123")).toBe("reports-active");
  });

  it("does the same when the deeper row is listed first", () => {
    const reordered: PerspectiveSection[] = [
      {
        id: "reports",
        label: "Reports",
        children: [
          { id: "reports-active", label: "Active", path: "/people-ops/reports/active-employees" },
          { id: "reports-home", label: "All", path: "/people-ops/reports" },
        ],
      },
    ];
    expect(
      activeItemId({
        sections: reordered,
        pathname: "/people-ops/reports/active-employees/E123",
        overviewPath: "/people-ops",
        overviewId: "ov",
      }),
    ).toBe("reports-active");
  });
});
