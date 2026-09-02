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
import { APP_MARK_TONES, appMarkTones } from "./appMarkTones";
import { PERSPECTIVE_HUES } from "@config/perspectiveHues";

/** WCAG relative luminance. */
function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const channels = [0, 2, 4].map((i) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const NON_TEXT_FLOOR = 3;

/**
 * The two grounds a mark is actually painted on. The launcher tile is transparent
 * for a marked perspective, so the mark sits on the surface behind it: white in
 * light, and the dark surface in dark.
 */
const LIGHT_TILE = "#FFFFFF";
const DARK_TILE = "#151A22";

describe("app mark tones", () => {
  it("keeps the identifying tones above the non-text floor on both grounds", () => {
    for (const [key, tones] of Object.entries(APP_MARK_TONES)) {
      for (const role of ["lead", "detail"] as const) {
        for (const [scheme, ground] of [
          ["light", LIGHT_TILE],
          ["dark", DARK_TILE],
        ] as const) {
          const ratio = contrast(tones[role], ground);
          expect(
            ratio,
            `${key}.${role} on ${scheme}: ${tones[role]} on ${ground} is ${ratio.toFixed(2)}:1`,
          ).toBeGreaterThanOrEqual(NON_TEXT_FLOOR);
        }
      }
    }
  });

  /**
   * The documented exception, asserted so it stays deliberate. `field` is below the
   * floor on white and cannot be lifted without collapsing the two-tone — see the
   * note in appMarkTones.ts. Pinning it means someone "fixing" the contrast has to
   * change this test and read why first.
   */
  it("leaves the field tone light on purpose, and says so", () => {
    for (const [key, tones] of Object.entries(APP_MARK_TONES)) {
      expect(
        contrast(tones.field, LIGHT_TILE),
        `${key}.field is meant to sit below the floor on white`,
      ).toBeLessThan(NON_TEXT_FLOOR);
      // It still has to be clearly visible on dark, where nothing forces it light.
      expect(contrast(tones.field, DARK_TILE)).toBeGreaterThanOrEqual(NON_TEXT_FLOOR);
    }
  });

  it("keeps the three tones far enough apart to read as three", () => {
    for (const [key, t] of Object.entries(APP_MARK_TONES)) {
      expect(contrast(t.field, t.lead), `${key}: field vs lead`).toBeGreaterThan(1.3);
      expect(contrast(t.lead, t.detail), `${key}: lead vs detail`).toBeGreaterThan(1.3);
    }
  });

  /**
   * `lead` is the perspective's identity hue, not a near-miss of it. If someone
   * retunes a hue in perspectiveHues.ts, this fails rather than letting the
   * launcher drift two shades away from the colour the rest of the app uses.
   */
  it("draws the lead tone from the perspective's own hue", () => {
    for (const [key, tones] of Object.entries(APP_MARK_TONES)) {
      expect(PERSPECTIVE_HUES[key], `no hue for "${key}"`).toBeDefined();
      expect(tones.lead.toUpperCase()).toBe(PERSPECTIVE_HUES[key].hue.toUpperCase());
    }
  });

  it("rejects inherited keys rather than resolving them", () => {
    expect(appMarkTones("toString")).toBeUndefined();
    expect(appMarkTones("constructor")).toBeUndefined();
  });
});
