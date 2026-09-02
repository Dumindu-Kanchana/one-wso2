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

export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const G = 16;

function overlapArea(a: Rect, b: Rect): number {
  const w = Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left);
  const h = Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top);
  return w > 0 && h > 0 ? w * h : 0;
}

/**
 * Where the tour card goes: next to what it is describing.
 *
 * Adjacency is safe now that the tour blocks interaction with the app. Nothing
 * underneath can be clicked while a step is showing, so the card only has to
 * avoid *covering* the highlight — it no longer has to stay clear of anything
 * the reader might want to reach. That is what makes putting it close viable,
 * where earlier it had to hedge toward the middle.
 *
 * Below first, then above, then the side away from the target, then the other
 * side; centre and the corners remain as last resorts for a target with no room
 * around it. Each candidate is derived from `avoid`, which is the target unioned
 * with any panel the step opened, so "below" means below the whole panel rather
 * than below the button that opens it.
 *
 * A candidate is taken only if it is both on screen and clear of `avoid`. The
 * adjacent candidates can only be one or the other, but `centre` and the corners
 * are fixed to the viewport and know nothing about the target, so they can fit
 * and still cover it — which is how an overlapping centre came to be preferred
 * over a clear corner.
 */
export function placeCard(
  avoid: Rect,
  card: { w: number; h: number },
  viewport: { width: number; height: number },
  prefer?: "side",
): Rect {
  const { width: vw, height: vh } = viewport;
  const size = { width: card.w, height: card.h };
  const centre: Rect = {
    left: Math.round((vw - card.w) / 2),
    top: Math.round((vh - card.h) / 2),
    ...size,
  };

  // Nothing highlighted: nothing to sit beside.
  if (avoid.width < 1 || avoid.height < 1) return centre;

  const clampX = (x: number) => Math.max(G, Math.min(x, vw - card.w - G));
  const clampY = (y: number) => Math.max(G, Math.min(y, vh - card.h - G));
  const alignX = clampX(avoid.left + avoid.width / 2 - card.w / 2);
  const alignY = clampY(avoid.top + avoid.height / 2 - card.h / 2);
  const targetIsRight = avoid.left + avoid.width / 2 > vw / 2;

  const below = { left: alignX, top: avoid.top + avoid.height + G, ...size };
  const above = { left: alignX, top: avoid.top - card.h - G, ...size };
  const rightOf = { left: avoid.left + avoid.width + G, top: alignY, ...size };
  const leftOf = { left: avoid.left - card.w - G, top: alignY, ...size };

  const sideFirst = prefer === "side";
  const spots: Rect[] = [
    ...(sideFirst
      ? [targetIsRight ? leftOf : rightOf, targetIsRight ? rightOf : leftOf, below, above]
      : [below, above, targetIsRight ? leftOf : rightOf, targetIsRight ? rightOf : leftOf]),
    centre,
    { left: vw - card.w - G, top: vh - card.h - G, ...size },
    { left: G, top: vh - card.h - G, ...size },
    { left: vw - card.w - G, top: G, ...size },
    { left: G, top: G, ...size },
  ];

  const onScreen = (c: Rect) =>
    c.left >= G && c.top >= G && c.left + card.w <= vw - G && c.top + card.h <= vh - G;

  // Both conditions, and the overlap half is genuinely load-bearing.
  //
  // I twice claimed an overlap test here was unreachable, on the grounds that
  // every candidate is derived from `avoid`. That stopped being true when
  // `centre` and the corners were added: those are fixed to the viewport and
  // know nothing about the target, so they can sit right on top of it. With
  // viewport 1024x640, card 320x190 and a target at 334,180 340x300, every
  // adjacent candidate falls off-screen, `centre` fits and covers the target —
  // and a corner that is both on-screen and clear gets skipped.
  const chosen = spots.find((c) => onScreen(c) && overlapArea(c, avoid) === 0);
  if (chosen) return chosen;

  // Nothing both fits and is clear. Prefer staying on screen over being clear,
  // then take the least-covered of those.
  const visible = spots.filter(onScreen);
  const pool = visible.length > 0 ? visible : spots;
  return pool.reduce((best, c) =>
    overlapArea(c, avoid) < overlapArea(best, avoid) ? c : best,
  );
}
