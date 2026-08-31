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

// The sabbatical rules, as pure functions of their inputs.
//
// Transcribed from ApplyTab.tsx rather than reasoned about: the two config
// values are DAYS (1095 and 42 by default) but every message speaks in years and
// weeks, and the eligibility gap is computed with a `- 1` that is easy to lose.

/** ApplyTab.tsx:103 — `parseFloat((days / 365).toFixed(1))`, so 1095 → 3. */
export function eligibilityYears(eligibilityDurationDays: number): number {
  return parseFloat((eligibilityDurationDays / 365).toFixed(1));
}

/** ApplyTab.tsx:104-106 — a plain divide, no rounding, so 42 → 6. */
export function maxDurationWeeks(maxApplicationDurationDays: number): number {
  return maxApplicationDurationDays / 7;
}

/**
 * Whole days from `anchor` to `start`, minus one — ApplyTab.tsx:168.
 *
 * The `- 1` is the source's and is reproduced deliberately. It makes the check a
 * day stricter than a plain difference would be; §9 of the spec records that as
 * a question against the live tenant rather than something to correct here.
 *
 * Both ends are normalised to midnight first, so a time-of-day difference cannot
 * shift the result by a day.
 */
export function eligibilityGapDays(anchor: Date, start: Date): number {
  const a = new Date(anchor);
  const s = new Date(start);
  a.setHours(0, 0, 0, 0);
  s.setHours(0, 0, 0, 0);
  return Math.round((s.getTime() - a.getTime()) / 86_400_000) - 1;
}

/** ApplyTab.tsx:168-169 — eligible once the gap reaches the configured days. */
export function isEligible(
  anchor: Date,
  start: Date,
  eligibilityDurationDays: number,
): boolean {
  return eligibilityGapDays(anchor, start) >= eligibilityDurationDays;
}

/** ApplyTab.tsx:194 — inclusive of both ends, so a single day is 1. */
export function requestedDurationDays(start: Date, end: Date): number {
  const s = new Date(start);
  const e = new Date(end);
  s.setHours(0, 0, 0, 0);
  e.setHours(0, 0, 0, 0);
  return Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1;
}

/** ApplyTab.tsx:194-195 — strictly greater than the limit is too long. */
export function exceedsMaxDuration(
  start: Date,
  end: Date,
  maxApplicationDurationDays: number,
): boolean {
  return requestedDurationDays(start, end) > maxApplicationDurationDays;
}
