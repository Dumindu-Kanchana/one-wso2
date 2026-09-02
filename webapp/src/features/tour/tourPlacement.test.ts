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
 * The card's position, swept rather than sampled.
 *
 * Two earlier versions of this file asserted against coordinates I had invented
 * for the top bar, the launcher and the rail — and passed, twice, while the real
 * app placed cards on top of the controls they described. Hand-picked fixtures
 * only ever test the layout you imagined.
 *
 * So this sweeps thousands of target rects across the viewport instead, and
 * asserts the two properties that have to hold whatever the real layout is: the
 * card stays fully on screen, and it does not cover the highlight.
 */
import { describe, expect, it } from "vitest";
import { placeCard, type Rect } from "./tourPlacement";
import { TOUR_STEPS } from "./tourSteps";

const CARD = { w: 320, h: 190 };

function overlaps(a: Rect, b: Rect): boolean {
  return (
    a.left < b.left + b.width &&
    a.left + a.width > b.left &&
    a.top < b.top + b.height &&
    a.top + a.height > b.top
  );
}

function inside(a: Rect, vp: { width: number; height: number }): boolean {
  return (
    a.left >= 0 && a.top >= 0 && a.left + a.width <= vp.width && a.top + a.height <= vp.height
  );
}

const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 820 },
  { width: 1280, height: 720 },
  { width: 1024, height: 640 },
];

describe("tour card placement", () => {
  it("stays on screen for every target, at every viewport", () => {
    for (const vp of VIEWPORTS) {
      for (let top = 0; top < vp.height; top += 60) {
        for (let left = 0; left < vp.width; left += 80) {
          for (const [w, h] of [
            [32, 32],
            [240, 40],
            [340, 300],
            [224, 700],
          ]) {
            const target: Rect = { top, left, width: w, height: h };
            const card = placeCard(target, CARD, vp);
            expect(
              inside(card, vp),
              `card escaped ${vp.width}x${vp.height} for target ${left},${top} ${w}x${h}`,
            ).toBe(true);
          }
        }
      }
    }
  });

  /**
   * The property that was broken in the app. A target has to be very large
   * before every corner is compromised, so this sweeps only targets that leave
   * one free — anything a real control could plausibly be.
   */
  it("never covers a target that leaves a corner free", () => {
    for (const vp of VIEWPORTS) {
      for (let top = 0; top < vp.height; top += 60) {
        for (let left = 0; left < vp.width; left += 80) {
          for (const [w, h] of [
            [32, 32],
            [240, 40],
            [340, 300],
            [224, 700],
          ]) {
            const target: Rect = { top, left, width: w, height: h };
            const card = placeCard(target, CARD, vp);
            // Only assert where a clear corner exists; otherwise the contract is
            // least-covered, not uncovered.
            const anyClear = [
              { left: vp.width - CARD.w - 16, top: vp.height - CARD.h - 16 },
              { left: vp.width - CARD.w - 16, top: 16 },
              { left: 16, top: vp.height - CARD.h - 16 },
              { left: 16, top: 16 },
            ].some(
              (c) => !overlaps({ ...c, width: CARD.w, height: CARD.h }, target),
            );
            if (!anyClear) continue;
            expect(
              overlaps(card, target),
              `card covered target ${left},${top} ${w}x${h} at ${vp.width}x${vp.height}`,
            ).toBe(false);
          }
        }
      }
    }
  });

  /**
   * The real steps, at the positions their controls occupy. Each card should sit
   * ADJACENT to its target now that the tour blocks interaction — close enough
   * to read as belonging to it, and never on top of it.
   */
  it.each([
    ["pin button", { top: 10, left: 1250, width: 32, height: 32 }],
    ["theme controls", { top: 10, left: 1160, width: 72, height: 32 }],
    ["left rail", { top: 56, left: 0, width: 224, height: 700 }],
    ["Settings row", { top: 700, left: 8, width: 200, height: 36 }],
  ] as [string, Rect][])("sits next to the %s without covering it", (_name, target) => {
    const vp = { width: 1440, height: 820 };
    const card = placeCard(target, CARD, vp);
    expect(overlaps(card, target), "card covered its own target").toBe(false);
    expect(inside(card, vp)).toBe(true);

    // Touching, or nearly: the nearest edges should be about a gutter apart, not
    // half a screen. This is what "closer" means, and what a drift back toward
    // the middle would break.
    const gapX = Math.max(0, Math.max(card.left - (target.left + target.width), target.left - (card.left + card.width)));
    const gapY = Math.max(0, Math.max(card.top - (target.top + target.height), target.top - (card.top + card.height)));
    expect(Math.min(gapX, gapY), "card drifted away from its target").toBeLessThanOrEqual(24);
  });

  /**
   * The launcher steps ask for the side. The panel fills the top-right corner,
   * so a card beneath it dangles into the middle of the page instead of reading
   * as belonging to it — beside it at the same height is what works.
   */
  it("puts the card to the LEFT of the open launcher panel", () => {
    const vp = { width: 1440, height: 820 };
    const panel: Rect = { top: 10, left: 1080, width: 340, height: 300 };
    const card = placeCard(panel, CARD, vp, "side");
    expect(card.left + card.width, "card is not left of the panel").toBeLessThanOrEqual(
      panel.left,
    );
    expect(overlaps(card, panel)).toBe(false);
    expect(inside(card, vp)).toBe(true);
    // Beside it, not adrift: vertically overlapping the panel's own band.
    expect(card.top).toBeLessThan(panel.top + panel.height);
    expect(card.top + card.height).toBeGreaterThan(panel.top);
  });

  /** Without the preference the same panel would get a card underneath it. */
  it("still puts the card below that panel when the side is not asked for", () => {
    const vp = { width: 1440, height: 820 };
    const panel: Rect = { top: 10, left: 1080, width: 340, height: 300 };
    const card = placeCard(panel, CARD, vp);
    expect(card.top).toBeGreaterThanOrEqual(panel.top + panel.height);
  });

  /**
   * The preference has to be declared on the steps, not just supported by the
   * function. Dropping it from the step data went undetected until this.
   */
  it("asks for the side on exactly the steps that open the launcher", () => {
    const launcherSteps = TOUR_STEPS.filter((s) => s.opensLauncher);
    expect(launcherSteps.length).toBeGreaterThan(0);
    for (const step of launcherSteps) {
      expect(step.prefer, `${step.title} opens the launcher but not beside it`).toBe("side");
    }
    // And nothing else asks for it, so the other steps keep the default.
    for (const step of TOUR_STEPS.filter((s) => !s.opensLauncher)) {
      expect(step.prefer, `${step.title} should use the default placement`).toBeUndefined();
    }
  });

  /**
   * The reviewer's counterexample, kept verbatim.
   *
   * Every adjacent candidate falls off-screen here, so selection reaches
   * `centre` — which is fixed to the viewport and knows nothing about the
   * target. It fits, and it covers the target by 60,800px², while two corners
   * are both on-screen and clear. Choosing on "fits" alone took the overlapping
   * one.
   */
  it("prefers a clear corner over a centre that would cover the target", () => {
    const vp = { width: 1024, height: 640 };
    const target: Rect = { top: 180, left: 334, width: 340, height: 300 };
    const card = placeCard(target, CARD, vp);
    expect(overlaps(card, target), "took an overlapping spot").toBe(false);
    expect(inside(card, vp)).toBe(true);
    // Specifically not the centre, which is what the old rule returned.
    const centreLeft = Math.round((vp.width - CARD.w) / 2);
    const centreTop = Math.round((vp.height - CARD.h) / 2);
    expect(card.left === centreLeft && card.top === centreTop).toBe(false);
  });

  /** Nothing highlighted means nothing to lean away from. */
  it("centres a step that has no target", () => {
    const vp = { width: 1440, height: 820 };
    const card = placeCard({ top: 0, left: 0, width: 0, height: 0 }, CARD, vp);
    expect(card.left).toBe(Math.round((vp.width - CARD.w) / 2));
    expect(card.top).toBe(Math.round((vp.height - CARD.h) / 2));
  });

  it("moves out of the middle when the highlight is there", () => {
    const vp = { width: 1440, height: 820 };
    const centre: Rect = { top: 280, left: 520, width: 400, height: 260 };
    const card = placeCard(centre, CARD, vp);
    expect(overlaps(card, centre)).toBe(false);
    expect(inside(card, vp)).toBe(true);
  });

  it("moves off a corner it would otherwise cover", () => {
    const vp = { width: 1440, height: 820 };
    // Something sitting in the bottom-right: the card must go elsewhere.
    const target: Rect = { top: 600, left: 1100, width: 320, height: 200 };
    const card = placeCard(target, CARD, vp);
    expect(overlaps(card, target)).toBe(false);
    expect(inside(card, vp)).toBe(true);
  });

  it("degrades to the least-covered corner rather than going off screen", () => {
    const vp = { width: 1024, height: 640 };
    const huge: Rect = { top: 0, left: 0, width: 1024, height: 640 };
    const card = placeCard(huge, CARD, vp);
    expect(inside(card, vp)).toBe(true);
  });
});
