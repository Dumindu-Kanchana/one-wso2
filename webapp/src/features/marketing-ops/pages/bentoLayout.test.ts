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
import { BENTO_COLS, packBento, type BentoTile } from "./bentoLayout";

// The property that matters is the one you can't see in a code review but can
// see immediately on the page: the tiles have to fill whole rows. Everything
// else here is a specific case of that.

const cells = (tiles: readonly BentoTile[]) =>
  packBento(tiles).reduce((n, p) => n + p.colSpan, 0);

// What a fully-authorized caller sees, in the order the page passes them:
// the five operations in registry order, then Marketing Admin, then ISAC.
const FULL: BentoTile[] = [
  { key: "email-workbench", weight: 4 },
  { key: "ad-campaigns", weight: 1 },
  { key: "events", weight: 2 },
  { key: "crm-upload", weight: 4 },
  { key: "utilities", weight: 2 },
  { key: "admin", weight: 4 },
  { key: "isac", weight: 1 },
];

describe("packBento", () => {
  it("fills whole rows for the full set", () => {
    expect(cells(FULL) % BENTO_COLS).toBe(0);
  });

  // Three tidy rows: 2 + 1 + 1 + 2 + 2 + 2 + 2 = 12 cells.
  //   row 1   feature (2)  | Ad Campaigns | Events
  //   row 2   CRM Upload   | Utilities
  //   row 3   Admin        | ISAC
  it("gives the full set the intended shape", () => {
    expect(packBento(FULL)).toEqual([
      // the feature: double width, top-left, the page's entry point
      { key: "email-workbench", colSpan: 2 },
      { key: "ad-campaigns", colSpan: 1 },
      { key: "events", colSpan: 1 },
      // wide on its own merit — four screens to list two-up
      { key: "crm-upload", colSpan: 2 },
      // these two were widened by the pack step to close the last rows
      { key: "utilities", colSpan: 2 },
      // wide on merit again: four admin panels
      { key: "admin", colSpan: 2 },
      { key: "isac", colSpan: 2 },
    ]);
  });

  // ---- the sets RBAC actually produces ------------------------------------
  //
  // The access gate decides how many tiles exist AND how many links each holds,
  // so every set a real caller can land on has to pack as cleanly as the admin's.
  // This is the case the old auto-fit grid handled for free and a fixed-column
  // bento does not.
  //
  // These are the real sets, not arbitrary slices, and the difference matters:
  // Utilities is the one app with no `requires`, so every authorized caller has
  // it — but it is LAST in registry order, which means a trailing slice of FULL
  // drops it first and tests a set nobody can ever have. Each case below is
  // named for the Asgardeo capability that produces it.
  const BY_CAPABILITY: Record<string, BentoTile[]> = {
    // Authorized, no capabilities. Utilities is open to any authorized caller.
    "baseline, no ISAC": [{ key: "utilities", weight: 2 }],
    baseline: [
      { key: "utilities", weight: 2 },
      { key: "isac", weight: 1 },
    ],
    // `events` alone → "My Submissions" only. Its sibling `events-review` is a
    // separate grant, so a submitter's Events tile holds ONE link, not two.
    "events (submitter)": [
      { key: "events", weight: 1 },
      { key: "utilities", weight: 2 },
      { key: "isac", weight: 1 },
    ],
    "events + events-review": [
      { key: "events", weight: 2 },
      { key: "utilities", weight: 2 },
      { key: "isac", weight: 1 },
    ],
    emailworkbench: [
      { key: "email-workbench", weight: 4 },
      { key: "utilities", weight: 2 },
      { key: "isac", weight: 1 },
    ],
    "adcampaigns + crmupload": [
      { key: "ad-campaigns", weight: 1 },
      { key: "crm-upload", weight: 4 },
      { key: "utilities", weight: 2 },
      { key: "isac", weight: 1 },
    ],
    "emailworkbench + events + crmupload": [
      { key: "email-workbench", weight: 4 },
      { key: "events", weight: 2 },
      { key: "crm-upload", weight: 4 },
      { key: "utilities", weight: 2 },
      { key: "isac", weight: 1 },
    ],
    // isAdmin is a master key in hasMarketingOpsCapability, so an admin sees
    // every operation as well as the Admin tile — there is no "admin but only
    // some operations" set to cover.
    "isAdmin, no ISAC": FULL.filter((t) => t.key !== "isac"),
    isAdmin: FULL,
  };

  it.each(Object.entries(BY_CAPABILITY))("fills whole rows: %s", (_name, tiles) => {
    // One tile can only ever be half a row — see the two-or-fewer case below.
    if (tiles.length < 2) return;
    expect(cells(tiles) % BENTO_COLS).toBe(0);
  });

  // The other half of the RBAC contract: a tile is sized by the links THIS
  // caller can see, so one the gate reduced is narrow rather than keeping a
  // four-link footprint with three links missing from it.
  //
  // Events is the only app the gate can partly reduce — `events` and
  // `events-review` are separate grants — so it is the one that shows this.
  it("sizes each tile from the links this caller can see", () => {
    const eventsSpan = (weight: number) =>
      packBento([
        { key: "email-workbench", weight: 4 },
        { key: "events", weight },
        { key: "crm-upload", weight: 4 },
        { key: "utilities", weight: 2 },
        { key: "isac", weight: 1 },
      ]).find((p) => p.key === "events")!.colSpan;

    expect(eventsSpan(1)).toBe(1); // `events` only — one link
    expect(eventsSpan(2)).toBe(1); // + `events-review` — still under WIDE_AT
    expect(eventsSpan(3)).toBe(2); // a third screen would earn the width
  });

  it("always gives the feature the full double width", () => {
    for (let n = 3; n <= FULL.length; n++) {
      const [first] = packBento(FULL.slice(0, n));
      expect(first).toEqual({ key: "email-workbench", colSpan: 2 });
    }
  });

  // No tile spans two rows any more — the 2x2 feature left empty card under its
  // own links. See the note in bentoLayout.
  it("returns width only", () => {
    for (const p of packBento(FULL)) {
      expect(Object.keys(p).sort()).toEqual(["colSpan", "key"]);
    }
  });

  it("keeps the caller's order", () => {
    expect(packBento(FULL).map((p) => p.key)).toEqual(FULL.map((t) => t.key));
  });

  // A lone operation rendered 2x2 would be a billboard for one link — the same
  // mistake as the full-width admin strip this layout replaced.
  it("fills one row between them at two tiles or fewer", () => {
    expect(packBento(FULL.slice(0, 1))).toEqual([{ key: "email-workbench", colSpan: 2 }]);
    expect(packBento(FULL.slice(0, 2))).toEqual([
      { key: "email-workbench", colSpan: 2 },
      { key: "ad-campaigns", colSpan: 2 },
    ]);
  });

  it("handles an empty set", () => {
    expect(packBento([])).toEqual([]);
  });

  // The documented floor: with nothing narrow left to widen, the last row keeps
  // a gap rather than the pack looping forever or reshaping the feature.
  it("stops instead of looping when every tile is already wide", () => {
    const allWide: BentoTile[] = [
      { key: "a", weight: 4 },
      { key: "b", weight: 4 },
      { key: "c", weight: 4 },
    ];
    expect(packBento(allWide)).toEqual([
      { key: "a", colSpan: 2 },
      { key: "b", colSpan: 2 },
      { key: "c", colSpan: 2 },
    ]);
  });
});
