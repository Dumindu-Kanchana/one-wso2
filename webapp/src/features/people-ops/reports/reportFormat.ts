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

// Value formatting for the report preview table.
//
// People App does this with date-fns; One WSO2 doesn't carry that dependency
// (see features/finance/util/financeFormat for the same hand-rolled approach),
// so these are written against plain Date. Output strings are kept identical
// to People App's so a column reads the same in both apps.

/** Placeholder for any value the backend didn't supply. */
export const EMPTY_CELL = "—";

// Parse a strict YYYY-MM-DD (or the date half of an ISO datetime) as LOCAL
// midnight. `new Date("2026-01-15")` would parse as UTC midnight, which
// renders as the previous day for anyone west of Greenwich — a start date
// silently off by one. Constructing from parts avoids that entirely.
//
// Returns null for anything malformed or non-existent (2026-02-30), which
// every caller renders as EMPTY_CELL rather than "Invalid Date".
function parseYmd(input: string | null | undefined): Date | null {
  if (!input) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(input);
  if (!match) return null;
  const [, y, mo, d] = match;
  const date = new Date(Number(y), Number(mo) - 1, Number(d));
  // Round-trip check — rejects real-looking but non-existent dates, which
  // the Date constructor would otherwise roll forward into the next month.
  if (
    date.getFullYear() !== Number(y) ||
    date.getMonth() !== Number(mo) - 1 ||
    date.getDate() !== Number(d)
  ) {
    return null;
  }
  return date;
}

/** "15 Jan 2026" — matches People App's `d MMM yyyy` report format. */
export function formatReportDate(input: string | null | undefined): string {
  const date = parseYmd(input);
  if (!date) return EMPTY_CELL;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export interface ServiceLength {
  years: number;
  months: number;
}

// Whole months between `start` and `now`, counting a month only once its
// day-of-month has been reached — the same rule date-fns differenceInMonths
// applies, so service lengths agree with People App to the month.
function wholeMonthsBetween(start: Date, now: Date): number {
  let months =
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months -= 1;
  return months;
}

/**
 * Service length as of `now`. Returns null for a missing/malformed date or
 * one in the future — a future joiner has not started accruing service, and
 * reporting "0 months" would imply they had.
 */
export function calculateServiceLength(
  startDate: string | null | undefined,
  now: Date = new Date(),
): ServiceLength | null {
  const start = parseYmd(startDate);
  if (!start || start > now) return null;
  const totalMonths = wholeMonthsBetween(start, now);
  if (totalMonths < 0) return null;
  return { years: Math.floor(totalMonths / 12), months: totalMonths % 12 };
}

/** "3 years 2 months" / "1 year" / "Less than 1 month". */
export function formatServiceLength(length: ServiceLength | null): string {
  if (!length) return EMPTY_CELL;
  const { years, months } = length;
  if (years === 0 && months === 0) return "Less than 1 month";
  const y = `${years} ${years === 1 ? "year" : "years"}`;
  const m = `${months} ${months === 1 ? "month" : "months"}`;
  if (years > 0 && months > 0) return `${y} ${m}`;
  return years > 0 ? y : m;
}

/** Any value → a display string, with the shared placeholder for blanks. */
export function displayValue(value: unknown): string {
  if (value === null || value === undefined) return EMPTY_CELL;
  const text = String(value).trim();
  return text === "" ? EMPTY_CELL : text;
}
