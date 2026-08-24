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
// has a FIXED column count, so a set of tiles whose widths don't line up leaves
// a visible hole. The old layout couldn't have this bug — `auto-fit` reflows to
// whatever fits — but it paid for that with a ragged grid of equal-weight tiles
// and no entry point.
//
// The access gate makes holes a real case, not a hypothetical: an operation
// whose every screen is hidden isn't rendered at all, so the tile count varies
// per caller. Hence a pack step rather than hardcoded widths per operation.
//
// ---- the mistake this file used to make ----------------------------------
//
// The first version tested "do the rows fill?" by summing cells and checking the
// total against `BENTO_COLS`. That is not what CSS grid does. Auto-placement
// walks tiles in order and moves a 2-span tile to the NEXT row when only one
// column is free, leaving the column it skipped empty — so a total that divides
// perfectly can still render holes. Caught in review on PR #20: the tile set for
// a caller holding emailworkbench + events + crmupload summed to 8 cells, a clean
// multiple of 4, and left two gaps at four columns and two more at two columns.
//
// So the pack now walks placement the way the browser does, with a column
// cursor. The sum is a consequence, never the test.
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
// card interior anywhere.

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
// so this threshold governs spacing and not just looks.
const WIDE_AT = 3;

/**
 * How wide a tile wants to be, before anything about the grid is considered.
 *
 * The first tile is always 2: it is the feature, the page's entry point, and is
 * never left narrow even when it has few screens. Everything else earns the
 * second column by having `WIDE_AT` screens or more.
 *
 * Exported for its own test. `packBento` may widen a tile past this to close a
 * row, so the sizing rule and the row-closing rule have to be checked
 * separately — asserting the rule through `packBento` alone conflates the two.
 */
export function naturalColSpan(tile: BentoTile, index: number): 1 | 2 {
  return index === 0 || tile.weight >= WIDE_AT ? 2 : 1;
}

/**
 * Assign a column span to each tile, in the order given, so that CSS grid's
 * auto-placement leaves no hole between tiles.
 *
 * Starts from `naturalColSpan`, then walks the tiles with a column cursor
 * exactly as the browser will. When a 2-wide tile reaches a row with only one
 * column free, one of two things happens:
 *
 *   - the last NARROW tile already in that row is widened, which closes the row
 *     exactly and lets the wide tile start the next one at full width. Preferred,
 *     because it keeps a tile that earned its width;
 *   - failing that (every tile in the row is already wide), the arriving tile
 *     narrows to 1 and fills the gap itself.
 *
 * A final pass widens narrow tiles in the last row while it is short, so the
 * grid ends on a full row where the tiles allow it.
 *
 * At two tiles or fewer there is nothing to pack: both go 2 wide and fill one
 * row between them. A single tile is then half a row, which is correct — a lone
 * tile stretched across four columns is the full-width-strip mistake this layout
 * exists to avoid.
 *
 * What is NOT guaranteed is a full last row: if every tile in it is already
 * wide, it stays short. That is the honest floor of a fixed-column bento, and a
 * short last row reads as the end of the content rather than as a broken cell.
 * A hole with tiles after it does not, which is why interior gaps are the thing
 * this function actually promises to prevent.
 */
export function packBento(tiles: readonly BentoTile[]): BentoPlacement[] {
  if (tiles.length <= 2) {
    return tiles.map((t) => ({ key: t.key, colSpan: 2 }));
  }

  const span: (1 | 2)[] = tiles.map(naturalColSpan);

  // `col` is the cursor within the current row; `rowStart` is the index of the
  // first tile in it, which bounds the search for something to widen.
  let col = 0;
  let rowStart = 0;

  for (let i = 0; i < span.length; i++) {
    if (col + span[i] > BENTO_COLS) {
      let j = i - 1;
      while (j >= rowStart && span[j] !== 1) j -= 1;

      if (j >= rowStart) {
        // Widening j takes the row to exactly BENTO_COLS, so tile i begins the
        // next row. (j can never be the feature: the feature is 2 wide, and this
        // only ever widens a tile that is 1.)
        span[j] = 2;
        col = 0;
        rowStart = i;
      } else {
        span[i] = 1;
      }
    }

    col += span[i];
    if (col === BENTO_COLS) {
      col = 0;
      rowStart = i + 1;
    }
  }

  // Close the last row if it is short and it still holds something narrow.
  // Widening only tiles inside that row keeps the total at exactly BENTO_COLS
  // once the shortfall reaches zero, so this can't push a tile onto a new row.
  let shortfall = col === 0 ? 0 : BENTO_COLS - col;
  for (let i = span.length - 1; i >= rowStart && shortfall > 0; i -= 1) {
    if (span[i] === 1) {
      span[i] = 2;
      shortfall -= 1;
    }
  }

  return tiles.map((t, i) => ({ key: t.key, colSpan: span[i] }));
}
