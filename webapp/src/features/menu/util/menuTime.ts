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

// Calendar arithmetic for the cafeteria's clock.
//
// The backend decides both time windows in IST, and anchors lunch feedback to
// the menu's own date rather than to the caller's. Every rule here therefore
// works in IST, never in the browser's timezone — that mismatch is what let the
// standalone app show a feedback form whose submission the server then refused.
//
// A fixed offset rather than Intl with a zone name: it is the same constant the
// backend applies, IST has no daylight saving, and it keeps every one of these
// functions pure arithmetic that a test can pin down exactly.
//
// `now` is always a parameter. Nothing in this file reads the clock.

/** IST is UTC+05:30. Mirrors the backend's own offset constant. */
export const CAFETERIA_UTC_OFFSET_MINUTES = 330;

const MINUTES_PER_DAY = 24 * 60;

/** A moment expressed on the cafeteria's clock. */
export interface CafeteriaMoment {
  /** Calendar date in IST, `YYYY-MM-DD`. */
  dateIso: string;
  /** Minutes since IST midnight, 0–1439. */
  minuteOfDay: number;
}

/** Where `now` falls on the cafeteria's clock. */
export function cafeteriaMoment(now: Date): CafeteriaMoment {
  // Shift the instant, then read UTC parts: this gives IST wall-clock values
  // without going through the host's timezone database at all.
  const shifted = new Date(now.getTime() + CAFETERIA_UTC_OFFSET_MINUTES * 60_000);
  const yyyy = shifted.getUTCFullYear();
  const mm = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(shifted.getUTCDate()).padStart(2, "0");
  return {
    dateIso: `${yyyy}-${mm}-${dd}`,
    minuteOfDay: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

/**
 * Reduce a menu date to `YYYY-MM-DD`, or null when it isn't one.
 *
 * The menu's date is a raw spreadsheet cell, so its shape is whatever a person
 * typed. Slash-separated dates are expected and accepted; anything else returns
 * null and the caller decides what to do rather than guessing at a date.
 */
export function normalizeSheetDate(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const datePart = trimmed.split("T")[0].replace(/\//g, "-");
  return /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? datePart : null;
}

/**
 * Parse `YYYY-MM-DD` as a local calendar date.
 *
 * `new Date("2026-08-01")` is parsed as UTC midnight, which in any negative
 * offset renders as 31 July. Splitting the parts avoids that.
 */
export function parseCalendarDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "Monday, August 24, 2026", or "" when there is no usable date. */
export function formatMenuDate(iso: string | null | undefined): string {
  const normalized = normalizeSheetDate(iso);
  if (!normalized) return "";
  const d = parseCalendarDate(normalized);
  if (!d) return "";
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** 975 -> "4:15 PM". Used for the window notices. */
export function formatMinuteOfDay(minuteOfDay: number): string {
  const wrapped = ((minuteOfDay % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours24 = Math.floor(wrapped / 60);
  const minutes = wrapped % 60;
  const suffix = hours24 < 12 ? "AM" : "PM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}
