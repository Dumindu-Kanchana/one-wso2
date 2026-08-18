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

// Style constants and design tokens for the Events screens, in their own module so
// EventsUi.tsx exports only components — a file that exports both loses React Fast
// Refresh for its components.

import { alpha, useTheme } from "@wso2/oxygen-ui";
import type { Status } from "../eventsTypes";

// ---- accent discipline ----------------------------------------------------------
//
// The working surface once had six accents at once and read like a highlighter set.
// Colour stops meaning anything when everything has some.
//
// Three semantic tones, one job each, plus the brand orange reserved for navigation and
// the primary action. Nothing else on the grid or its toolbar may introduce a colour.
export const tone = {
  /** Only a person can settle this. The one alert colour on the screen. */
  blocking: "error.main",
  /** A suggestion is waiting — informational, never alarming. */
  suggested: "text.secondary",
  /** The proposed value, and the act of accepting it. Green for an addition is the diff
   *  convention every developer and most marketers already read fluently. */
  accepted: "success.main",
  /** Different from the workbook that was uploaded. Nothing is WRONG with it — the
   *  question it answers is "did I touch this?", so it borrows the same quiet tone as a
   *  suggestion rather than a colour that means act on me.
   *
   *  It was orange once, and orange sits close enough to the error red that a settled
   *  cell looked like a failing one. Orange is also the focus colour here, so it was
   *  already spoken for. */
  changed: "text.secondary",
} as const;

// Lifecycle colour, kept as its own small language: these are chips in a table, one per
// row, where the colour is what lets you scan a queue. Deliberately NOT part of `tone`.
//
// Approved and Imported share green because they are the same news — the list is good.
// What separates them is FILL, not hue: Imported is terminal, the CSVs are in Pardot and
// nothing further will happen, so its chip is solid where every other chip is a tint.
// Reading "more filled in" as "further along" needs no legend.
export const STATUS_STYLE: Record<Status, { color: string; solid?: boolean }> = {
  Draft: { color: "text.secondary" },
  Submitted: { color: "warning.main" },
  ChangesRequested: { color: "error.main" },
  Approved: { color: "success.main" },
  Imported: { color: "success.main", solid: true },
};

/** How long a fixed row is held in a filtered view before it leaves: a beat to say
 *  "that one is done", then a fade. Shared so the timer that keeps the row mounted and
 *  the animation that fades it cannot drift apart. */
export const LEAVE_MS = 700;

/** Rotating copy while a screen loads. */
export const EVENTS_LOADING = {
  submissions: ["Loading your submissions…", "Almost there…"],
  queue: ["Loading the review queue…", "Almost there…"],
  list: ["Opening the list…", "Almost there…"],
  workbook: ["Reading your list…", "Checking every row…", "Almost there…"],
} as const;

// ---- buttons --------------------------------------------------------------------
//
// Three weights. The rule that makes a toolbar readable is that only ONE button per
// surface is filled: the thing you came to do. Everything else recedes to text.

/** The one action this screen exists for. */
export const primaryBtn = { textTransform: "none", fontSize: 13, fontWeight: 700 } as const;

/** Everything else in a toolbar. Text only until hovered. */
export const quietBtn = {
  textTransform: "none",
  fontSize: 13,
  fontWeight: 600,
  color: "text.secondary",
  "&:hover": { color: "primary.main" },
} as const;

// ---- form fields ----------------------------------------------------------------
//
// A fixed caption above the field rather than MUI's floating label. A form of floating
// labels reads as a stack of boxes whose captions animate; a form of small fixed
// captions reads as a form. It also lets the caption stay put while the field beneath it
// changes shape — a select, a date, a multiline box — which a floating label can't do
// without jumping.
export const fieldLabel = {
  fontSize: 11,
  fontWeight: 700,
  color: "text.secondary",
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
  mb: 0.5,
};

/** The input itself: filled against the page rather than the panel, so the box you type
 *  in is visibly the editable part. */
export const fieldInput = {
  "& .MuiOutlinedInput-root": { fontSize: 14, bgcolor: "background.default" },
  "& .MuiOutlinedInput-input": { fontSize: 14 },
} as const;

/** The line under a field — outside the input, so it doesn't shift the field's height
 *  when it appears. */
export const fieldHint = { fontSize: 11.5, color: "text.disabled", mt: 0.5 };

// ---- resolving a tone to a real colour -------------------------------------------
//
// The `tone` map above holds MUI palette PATHS ("error.main"), which is what `sx` wants.
// But some of these screens tint a tone — a filled unit at 9% behind its own text — and
// alpha arithmetic needs an actual colour, not a path.
//
// So this hook resolves them once per render from the live theme. That also means the
// tints are correct in dark mode, where Marketing Ops' hardcoded hex tints were not.
export interface ToneColors {
  blocking: string;
  suggested: string;
  accepted: string;
  changed: string;
  /** The brand accent — navigation and the primary action only. */
  accent: string;
}

export function useToneColors(): ToneColors {
  const theme = useTheme();
  return {
    blocking: theme.palette.error.main,
    suggested: theme.palette.text.secondary,
    accepted: theme.palette.success.main,
    changed: theme.palette.text.secondary,
    accent: theme.palette.primary.main,
  };
}

/** Tint a resolved colour. Used for the filled issue units and cell backgrounds — the
 *  same 8-bit-alpha-suffix trick Marketing Ops used, but MUI's `alpha` handles rgb()
 *  and named colours too, which a string suffix silently corrupts. */
export function tint(color: string, amount: number): string {
  return alpha(color, amount);
}
