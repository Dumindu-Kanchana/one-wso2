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
import { render } from "@testing-library/react";
import { appMark } from "./appMarkRegistry";
import { APP_MARK_TONES } from "./appMarkTones";
import { PERSPECTIVES } from "@constants/perspectives";

function draw(key: string) {
  const Mark = appMark(key);
  if (!Mark) throw new Error(`no mark for "${key}"`);
  const { container } = render(<Mark size={48} />);
  return container.querySelector("svg")!;
}

describe("app marks", () => {
  /**
   * The launcher shows every perspective, so a missing mark is a tile that looks
   * unlike its five neighbours. This fails when a perspective is added without one.
   */
  it("covers every perspective in the registry", () => {
    for (const p of PERSPECTIVES) {
      expect(appMark(p.key), `no mark for "${p.key}"`).toBeDefined();
    }
  });

  it("draws something on every mark, at the size asked for", () => {
    for (const key of Object.keys(APP_MARK_TONES)) {
      const svg = draw(key);
      expect(svg.getAttribute("width"), key).toBe("48");
      expect(svg.getAttribute("viewBox"), key).toBe("0 0 48 48");
      // Every mark is built from at least two shapes — that is what makes it
      // two-tone rather than a silhouette.
      expect(svg.querySelectorAll("path, rect, circle").length, key).toBeGreaterThan(1);
    }
  });

  /**
   * A mark that painted itself in one colour would still render and still pass a
   * snapshot. This asserts the thing the direction was chosen for.
   */
  it("paints each mark in at least two of its own tones", () => {
    for (const [key, tones] of Object.entries(APP_MARK_TONES)) {
      const fills = new Set(
        [...draw(key).querySelectorAll("[fill]")].map((n) => n.getAttribute("fill")!),
      );
      const own = [...fills].filter((f) =>
        [tones.field, tones.lead, tones.detail].includes(f),
      );
      expect(own.length, `${key} uses ${[...fills].join(", ")}`).toBeGreaterThanOrEqual(2);
    }
  });

  it("hides marks from assistive tech, since the tile is already labelled", () => {
    for (const key of Object.keys(APP_MARK_TONES)) {
      expect(draw(key).getAttribute("aria-hidden"), key).toBe("true");
    }
  });

  it("has no mark for an unknown perspective, so the launcher can fall back", () => {
    expect(appMark("nope")).toBeUndefined();
    expect(appMark("toString")).toBeUndefined();
  });
});
