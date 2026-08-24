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

// The generated cover a template tile shows when nobody uploaded a thumbnail.
//
// Pure functions, kept out of the component so the two things that decide what a
// cover looks like — its letters and its colour — can be tested without a DOM.
//
// Why a cover at all: an empty tile used to be a grey mail icon on white, which
// is also what a tile looks like while its thumbnail is still downloading. Six of
// them in a grid read as six broken images. A cover carrying the template's own
// initials, in the colour the emails themselves are built from, reads as
// something somebody designed.
//
// Every cover is the same navy. What tells one tile from the next is its letters,
// not its colour — this is a set of email templates, not a set of unrelated
// things needing colour-coding.
//
// The navy fills the tile, but under a diagonal hatch — because a WSO2 email HAS
// a navy header, and a plain navy fill looked like a screenshot of one.
// GeneratedCover carries that reasoning.

/**
 * The colour a cover is drawn in: the navy of the WSO2 email chassis, with the
 * white the chassis itself puts on that fill.
 *
 * These are the `navy` entry of BTN_VARIANTS in ./advancedEditorCore — the
 * enumerated set a WSO2 email button comes in, and so the palette
 * "General Email With Header" is actually built from. Written out rather than
 * derived so there is no runtime fallback to reason about; templateCover.test.ts
 * asserts the two stay equal, which turns drift into a failing test rather than a
 * silently wrong colour.
 *
 * The orange variant is deliberately NOT used. It is a call-to-action colour in
 * an email — one button in a body of text — and a wall of it at tile size is a
 * different thing entirely.
 *
 * Fixed values, not theme tokens: they do not follow light/dark. That matches the
 * white surface a real thumbnail sits on — the tile shows an artefact, not app
 * chrome, and an email is the same colour whatever theme you read the gallery in.
 *
 * `hatch` is not from the chassis: it is the texture that keeps a navy fill from
 * reading as a screenshot of a navy email header. White at 5.5% over #17223a, low
 * enough to be a treatment rather than stripes.
 */
export const COVER_TONE = {
  bg: "#17223a",
  fg: "#ffffff",
  hatch: "rgba(255, 255, 255, 0.055)",
} as const;

/**
 * Up to two letters standing in for the template name.
 *
 * First letters of the first two words; a single-word name gives its first two
 * letters instead, so "Newsletter" reads as "Ne" rather than a lone "N" floating
 * in the middle of the tile.
 *
 * Non-letters are skipped when picking words — a name like "2026 — Q3 invite"
 * should give "QI", not "2Q". If nothing usable is left the caller gets an empty
 * string and should fall back to an icon; a cover with a "?" on it looks like an
 * error, which is the impression this whole change exists to remove.
 *
 * `\p{M}` belongs in the word class alongside letters and digits: combining
 * marks are not separators. Without it the Sinhala anusvara in "සිංහල" splits
 * one word into two and the initials come from the wrong halves — the same
 * would happen to Devanagari, Thai and Arabic names.
 */
export function coverInitials(name: string): string {
  const words = name.split(/[^\p{L}\p{N}\p{M}]+/u).filter((w) => /^\p{L}/u.test(w));

  if (words.length === 0) return "";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
