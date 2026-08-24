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
import { BTN_VARIANTS } from "./advancedEditorCore";
import { COVER_TONE, coverInitials } from "./templateCover";

describe("coverInitials", () => {
  it("takes the first letter of the first two words", () => {
    expect(coverInitials("Webinar invite")).toBe("WI");
    expect(coverInitials("Quarterly newsletter for partners")).toBe("QN");
  });

  it("takes two letters from a single-word name", () => {
    // A lone letter floating in the middle of a 170px tile reads as an accident.
    expect(coverInitials("Newsletter")).toBe("NE");
  });

  it("skips words that don't start with a letter", () => {
    // The year, the quarter and the em dash are how marketing names things, and
    // "2Q" or "—I" would be a worse label than the words either side of them.
    expect(coverInitials("2026 — Q3 invite")).toBe("QI");
    expect(coverInitials("#1 Product launch")).toBe("PL");
  });

  it("handles punctuation between words", () => {
    expect(coverInitials("Choreo/Ballerina roadshow")).toBe("CB");
    expect(coverInitials("Thank-you follow-up")).toBe("TY");
  });

  it("returns empty rather than a placeholder character", () => {
    // The caller draws an icon for this. A cover reading "?" would look like the
    // error state this whole change exists to remove.
    expect(coverInitials("2026")).toBe("");
    expect(coverInitials("— · —")).toBe("");
    expect(coverInitials("")).toBe("");
  });

  it("uppercases whatever it finds", () => {
    expect(coverInitials("product launch")).toBe("PL");
  });

  it("handles non-Latin names", () => {
    expect(coverInitials("සිංහල පණිවිඩය")).toBe("සප");
  });
});

describe("COVER_TONE", () => {
  // The whole point of the colour change: a cover is drawn in the email chassis'
  // own navy, not in anything picked for the app shell. The constant is written
  // out in templateCover.ts, so this is what stops the two drifting apart.
  it("matches the navy variant a WSO2 email button comes in", () => {
    const navy = BTN_VARIANTS.find((v) => v.key === "navy");
    expect(navy, "BTN_VARIANTS no longer has a navy variant").toBeDefined();
    expect(COVER_TONE).toEqual({ bg: navy!.tdBg, fg: navy!.aColor });
  });

  it("is not the call-to-action orange", () => {
    // Orange is one button in a body of text. A wall of it at tile size is a
    // different thing, and was rejected on sight.
    const orange = BTN_VARIANTS.find((v) => v.key === "orange");
    expect(COVER_TONE.bg).not.toBe(orange?.tdBg);
  });
});
