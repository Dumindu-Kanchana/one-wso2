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


// Reading the reporting-line rows the `reports` endpoint returns.
//
// Two of its fields are booleans carried as free text, and the source compared
// them inconsistently: the "leads only" filter lowercased before comparing,
// while the lead badge two hundred lines away tested `=== "True"` exactly. So
// with a backend answering "true" the filter worked and the badge never
// appeared — and nothing about that looks broken on screen.
//
// Parsed once here, case-insensitively, so there is one answer to the question.

import type { ParReportEntry } from "../api/parTypes";

/** A boolean carried as text, in whatever case the backend chose. */
export function parseTextBoolean(raw: string | boolean | null | undefined): boolean {
  if (typeof raw === "boolean") return raw;
  if (typeof raw !== "string") return false;
  return raw.trim().toLowerCase() === "true";
}

/** Whether this person is themselves a lead. */
export function isReportALead(entry: ParReportEntry): boolean {
  return parseTextBoolean(entry.isEmployeeALead);
}

/**
 * Whether this row is an INDIRECT report — someone under a lead further down
 * the line, or attached by an additional-manager relationship.
 *
 * Case-insensitive for the same reason as above. An unrecognised or missing
 * `reportingType` counts as direct: showing somebody in the wrong list is
 * better than dropping them from both, which is what a strict check does.
 */
export function isIndirectReport(entry: ParReportEntry): boolean {
  return (entry.reportingType ?? "").trim().toLowerCase() === "indirect";
}

/** The people a lead reaches indirectly. */
export function indirectReports(entries: readonly ParReportEntry[]): ParReportEntry[] {
  return entries.filter(isIndirectReport);
}

/**
 * Free-text search over a row, matching name and email.
 *
 * Case- and padding-insensitive, and an empty query matches everything rather
 * than nothing — a cleared search box should restore the list.
 */
export function matchesReportSearch(entry: ParReportEntry, query: string): boolean {
  const term = query.trim().toLowerCase();
  if (term === "") return true;
  return (
    (entry.parEmployeeName ?? "").toLowerCase().includes(term) ||
    entry.parEmployeeEmail.toLowerCase().includes(term)
  );
}

/** Filter a list by search text and, optionally, to leads only. */
export function filterReports(
  entries: readonly ParReportEntry[],
  options: { query?: string; leadsOnly?: boolean },
): ParReportEntry[] {
  const { query = "", leadsOnly = false } = options;
  return entries.filter(
    (e) => matchesReportSearch(e, query) && (!leadsOnly || isReportALead(e)),
  );
}
