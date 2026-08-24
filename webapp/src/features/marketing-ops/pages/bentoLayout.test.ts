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
import { BENTO_COLS, naturalColSpan, packBento, type BentoTile } from "./bentoLayout";

// The property that matters is the one you can't see in a code review but can
// see immediately on the page: no hole between tiles. Everything else here is a
// specific case of that.
//
// This used to be asserted by summing spans and checking the total against
// BENTO_COLS, which is NOT what CSS grid does and passed on layouts that render
// holes — see the note in bentoLayout.ts. So the check below places the tiles the
// way the browser will.

/**
 * Auto-place the packed spans and report the gaps, exactly as CSS grid's
 * `grid-auto-flow: row` would: a tile that doesn't fit the remaining columns
 * moves to the next row and leaves the columns it skipped empty.
 *
 * `interior` counts empty columns with tiles placed after them — a hole. Those
 * must always be zero.
 * `trailing` counts empty columns in the final row, which is a short last row
 * and allowed.
 */
function place(tiles: readonly BentoTile[], cols: number) {
  let col = 0;
  let interior = 0;
  const rows: number[][] = [[]];

  for (const p of packBento(tiles)) {
    if (col + p.colSpan > cols) {
      interior += cols - col;
      col = 0;
      rows.push([]);
    }
    rows[rows.length - 1].push(p.colSpan);
    col += p.colSpan;
    if (col === cols) {
      col = 0;
      rows.push([]);
    }
  }

  return {
    interior,
    trailing: col === 0 ? 0 : cols - col,
    rows: rows.filter((r) => r.length > 0),
  };
}

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

// ---- the sets RBAC actually produces --------------------------------------
//
// The access gate decides how many tiles exist AND how many links each holds, so
// every set a real caller can land on has to place as cleanly as the admin's.
//
// These are the real sets, not arbitrary slices, and the difference matters:
// Utilities is the one app with no `requires`, so every authorized caller has it
// — but it is LAST in registry order, so a trailing slice of FULL drops it first
// and tests a set nobody can ever have. Each case is named for the Asgardeo
// capability that produces it.
const pick = (...keys: string[]) => FULL.filter((t) => keys.includes(t.key));

const BY_CAPABILITY: Record<string, BentoTile[]> = {
  // Authorized, no capabilities. Utilities is open to any authorized caller.
  "baseline, no ISAC": pick("utilities"),
  baseline: pick("utilities", "isac"),
  // `events` alone → "My Submissions" only. Its sibling `events-review` is a
  // separate grant, so a submitter's Events tile holds ONE link, not two.
  "events (submitter)": [{ key: "events", weight: 1 }, ...pick("utilities", "isac")],
  "events + events-review": pick("events", "utilities", "isac"),
  emailworkbench: pick("email-workbench", "utilities", "isac"),
  "adcampaigns + crmupload": pick("ad-campaigns", "crm-upload", "utilities", "isac"),
  // The set that exposed the cell-sum bug on PR #20: it sums to 8 cells, a clean
  // multiple of 4, and the old pack still left two holes at four columns.
  "emailworkbench + events + crmupload": pick(
    "email-workbench",
    "events",
    "crm-upload",
    "utilities",
    "isac",
  ),
  // isAdmin is a master key in hasMarketingOpsCapability, so an admin sees every
  // operation as well as the Admin tile — there is no "admin but only some
  // operations" set to cover.
  "isAdmin, no ISAC": pick(
    "email-workbench",
    "ad-campaigns",
    "events",
    "crm-upload",
    "utilities",
    "admin",
  ),
  isAdmin: FULL,
};

describe("packBento", () => {
  // Both breakpoints the page renders: four columns at `lg`, two below it.
  // Two columns is not a free pass — a 2-wide tile fills a whole row there, so
  // the same skipped-column problem applies.
  it.each(Object.entries(BY_CAPABILITY))("leaves no hole at 4 columns: %s", (_name, tiles) => {
    expect(place(tiles, BENTO_COLS).interior).toBe(0);
  });

  it.each(Object.entries(BY_CAPABILITY))("leaves no hole at 2 columns: %s", (_name, tiles) => {
    expect(place(tiles, 2).interior).toBe(0);
  });

  // Three tidy rows, nothing skipped and nothing left over.
  //   row 1   feature (2)  | Ad Campaigns | Events
  //   row 2   CRM Upload   | Utilities
  //   row 3   Admin        | ISAC
  it("gives the full set the intended shape", () => {
    expect(packBento(FULL)).toEqual([
      { key: "email-workbench", colSpan: 2 },
      { key: "ad-campaigns", colSpan: 1 },
      { key: "events", colSpan: 1 },
      { key: "crm-upload", colSpan: 2 },
      { key: "utilities", colSpan: 2 },
      { key: "admin", colSpan: 2 },
      { key: "isac", colSpan: 2 },
    ]);
    expect(place(FULL, BENTO_COLS)).toMatchObject({
      interior: 0,
      trailing: 0,
      rows: [
        [2, 1, 1],
        [2, 2],
        [2, 2],
      ],
    });
  });

  it("always gives the feature the full double width", () => {
    for (const tiles of Object.values(BY_CAPABILITY)) {
      if (tiles.length < 3) continue;
      expect(packBento(tiles)[0].colSpan).toBe(2);
    }
  });

  // No tile spans two rows — the 2x2 feature left empty card under its own
  // links. See the note in bentoLayout.
  it("returns width only", () => {
    for (const p of packBento(FULL)) {
      expect(Object.keys(p).sort()).toEqual(["colSpan", "key"]);
    }
  });

  it("keeps the caller's order", () => {
    expect(packBento(FULL).map((p) => p.key)).toEqual(FULL.map((t) => t.key));
  });

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

  // The documented floor: with nothing narrow left to widen, the last row stays
  // short rather than the pack looping or reshaping the feature. Short is fine;
  // a hole with tiles after it is not, which the interior checks above cover.
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
    expect(place(allWide, BENTO_COLS)).toMatchObject({ interior: 0, trailing: 2 });
  });
});

// The other half of the RBAC contract: a tile is sized by the links THIS caller
// can see, so one the gate reduced asks for less width rather than keeping a
// four-link footprint with three links missing from it.
//
// Tested on naturalColSpan rather than through packBento, because packBento may
// widen a narrow tile to close a row — a real behaviour, but one that would mask
// the sizing rule if the two were asserted together.
describe("naturalColSpan", () => {
  it("sizes a tile from the links this caller can see", () => {
    // Events is the only app the gate can partly reduce: `events` and
    // `events-review` are separate grants.
    expect(naturalColSpan({ key: "events", weight: 1 }, 2)).toBe(1);
    expect(naturalColSpan({ key: "events", weight: 2 }, 2)).toBe(1);
    // A third screen would earn the second column.
    expect(naturalColSpan({ key: "events", weight: 3 }, 2)).toBe(2);
    expect(naturalColSpan({ key: "crm-upload", weight: 4 }, 3)).toBe(2);
  });

  it("never leaves the feature narrow, however few links it has", () => {
    expect(naturalColSpan({ key: "utilities", weight: 1 }, 0)).toBe(2);
  });
});
