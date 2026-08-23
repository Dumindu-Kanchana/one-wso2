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

// Tile widths for the Marketing Ops landing page's bento grid.
//
// Split out of MarketingOpsPage because it is the one part of that page with a
// rule rather than a shape, and because a bento's weakness is exactly here: it
// has a FIXED column count, so a set of tiles whose spans don't add up to a
// multiple of it leaves a visible hole in the last row. The old layout couldn't
// have this bug — `auto-fit` reflows to whatever fits — but it paid for that
// with a ragged grid of equal-weight tiles and no entry point.
//
// The access gate makes the hole a real case, not a hypothetical: an operation
// whose every screen is hidden isn't rendered at all, so the tile count varies
// per caller. Hence a pack step rather than hardcoded widths per operation.
//
// ---- why width only, and no tile is two rows tall ------------------------
//
// The feature tile used to be 2x2. Two rows tall is the strongest way to say
// "start here", and it was the first thing to go wrong: a header plus four links
// is ~172px, the two rows beside it came to ~248px, and the whole 75px
// difference sat as empty card under the last link. Filling it needed content
// the page doesn't want — a description (tried; it reads as documentation on a
// launcher) or live status (tried; it reads as clutter).
//
// So the grid is one row deep everywhere and the feature earns its prominence
// from width, the brand wash and a larger glyph instead. Every tile is then as
// tall as its own row needs, which is the only arrangement here with no empty
// card interior anywhere. It also makes this module simpler: a width, and
// nothing else.

export const BENTO_COLS = 4;

export interface BentoTile {
  key: string;
  // How many screens the tile leads to. Decides its natural width — a tile with
  // several screens needs the room to list them two-up, one with a single screen
  // does not.
  weight: number;
}

export interface BentoPlacement {
  key: string;
  colSpan: 1 | 2;
}

// Wide enough to list its screens in two columns rather than one long run.
// Two-up is also what keeps a 4-screen tile the same height as its neighbours,
// which is why it matters for spacing and not just for looks.
const WIDE_AT = 3;

/**
 * Assign a column span to each tile, in the order given, so the grid fills
 * whole rows.
 *
 * Three rules, applied in order:
 *
 *   1. The FIRST tile is always 2 wide. It is the feature — the page's entry
 *      point — so it is never left narrow even when it has few screens.
 *      Callers pass the operations in registry order, so this is whichever
 *      operation leads: Email Workbench today.
 *   2. Every other tile is 2 wide if it has `WIDE_AT` screens or more, else 1.
 *   3. If the resulting cell count isn't a multiple of `BENTO_COLS`, widen
 *      narrow tiles from the END backwards until it is. Widening the tail is
 *      what closes the hole, and doing it from the end keeps the top of the
 *      page — the part with the reading order — as designed.
 *
 * At two tiles or fewer there is nothing to pack: both go 2 wide and fill one
 * row between them.
 *
 * Rule 3 can run out of narrow tiles to widen, since 2 is as wide as a tile
 * gets. The last row then keeps a trailing gap. That is the honest floor of a
 * fixed-column bento, and a short last row reads as the end of the content
 * rather than as a broken cell, so it is left alone.
 */
export function packBento(tiles: readonly BentoTile[]): BentoPlacement[] {
  if (tiles.length <= 2) {
    return tiles.map((t) => ({ key: t.key, colSpan: 2 }));
  }

  const placed: BentoPlacement[] = tiles.map((t, i) => ({
    key: t.key,
    colSpan: i === 0 || t.weight >= WIDE_AT ? 2 : 1,
  }));

  let cells = placed.reduce((n, p) => n + p.colSpan, 0);
  // i > 0 leaves the feature alone. It is already 2 wide, so this only ever
  // skips a redundant check — but it also says that the feature's width is a
  // decision and not something the packer gets to revisit.
  for (let i = placed.length - 1; i > 0 && cells % BENTO_COLS !== 0; i--) {
    if (placed[i].colSpan === 1) {
      placed[i].colSpan = 2;
      cells += 1;
    }
  }

  return placed;
}
