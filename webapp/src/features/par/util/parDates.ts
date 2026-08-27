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


// Formatting the plain `YYYY-MM-DD` dates a cycle carries.
//
// Parsed part-by-part rather than with `new Date("YYYY-MM-DD")`, which is read
// as UTC midnight and renders as the previous day in any negative offset.
//
// The validation is the round-trip: `Date` rolls overflow forward instead of
// rejecting it, so "2026-02-31" silently becomes 3 March. Comparing the parts
// back is the only thing that catches it. This repo now formats a YYYY-MM-DD in
// three features with three copies of that check — worth extracting into one
// shared helper, which is its own change rather than part of a port.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "30 Jun 2026", or "—" when the value is missing or not a real date. */
export function formatParDate(raw: string | null | undefined): string {
  if (typeof raw !== "string") return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw.trim());
  if (!m) return "—";
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const name = MONTHS[month - 1];
  if (!name) return "—";
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return "—";
  return `${day} ${name} ${year}`;
}

/** "1 Jan 2026 – 30 Jun 2026", for a cycle's own span. */
export function formatParPeriod(
  start: string | null | undefined,
  end: string | null | undefined,
): string {
  const from = formatParDate(start);
  const to = formatParDate(end);
  // A half-known period says what it knows rather than showing "— – —", which
  // reads as a rendering fault rather than missing data.
  if (from === "—" && to === "—") return "—";
  if (from === "—") return `to ${to}`;
  if (to === "—") return `from ${from}`;
  return `${from} – ${to}`;
}
