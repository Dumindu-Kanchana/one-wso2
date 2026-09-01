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

// A calendar date is not an instant. "Today" is whatever day it is where the
// person is standing, and `toISOString()` cannot answer that — it reports the
// UTC day, which differs from the local one between midnight UTC and local
// midnight. Every day, for hours at a time, west of Greenwich.
//
// That window is why this bug survives review and CI: the two agree most of the
// day, so a `toISOString().slice(0, 10)` looks correct and fails only for
// whoever is in the wrong place at the wrong hour.
//
// Use these whenever a `YYYY-MM-DD` is meant as a calendar date — a date input's
// value or bounds, a query parameter the backend reads as a day, a filename
// stamp. Use `toISOString()` only for instants, where UTC is the point.

/** `YYYY-MM-DD` for a date, read from local fields. Defaults to today. */
export function localIsoDate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** `YYYY-MM` for a date, read from local fields. Defaults to this month. */
export function localIsoMonth(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * The calendar date `days` from now, read from local fields. Negative goes
 * back. Steps with `setDate`, so it clamps across month and year ends and
 * survives DST transitions — `Date.now() ± n * 86_400_000` does neither.
 */
export function localIsoDateOffset(days: number, from: Date = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return localIsoDate(d);
}
