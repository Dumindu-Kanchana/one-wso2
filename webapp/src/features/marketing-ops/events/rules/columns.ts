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

// Which columns a tab shows. **The only definition** — the grid, the issue bar, the fill
// dialog and validation all come here.
//
// It said that before and it was not true. When computed columns arrived, a second
// version in schema.ts was written and tested while this one was left as it was, so the
// two disagreed about a tab with computed columns on it — and this is the one the grid
// uses. It appended COMPUTED_FIELDS to a list that already contained them, giving
// `opt_in_method`, `opt_in_timestamp` and `score` twice, 24 columns for a 20-column tab.
//
// Duplicate keys in a React list do not render twice and stop there; reconciliation
// matches children by key, so with three keys repeated it puts cells under the wrong
// headings. The event name (which is what `opt_in_method` derives to) appeared in Phone
// number, Lead state's "New" appeared in Industry, and the last few columns fell outside
// the grid entirely. It read as the grid being broken rather than as a duplicated key,
// which is why it is worth spelling out here.
//
// So: one function, one order, and a test that counts duplicates.

import { COMPUTED_FIELDS, defsOf, keyOf, type EventsConfig, type Field, type Tab } from './schema'

// ONE WSO2 DIVERGENCE from the Marketing Ops original (the rest of rules/ is a
// byte-identical port). The story above closed one source of duplicate keys — appending
// COMPUTED_FIELDS to a list that already held them — but not the other: `keyOf` runs the
// heading through `slug`, which collapses every run of non-alphanumerics, so two
// separately configured columns named "Job title" and "Job-Title" both key as
// `job_title`. That is the same wrong-cells-under-wrong-headings failure from a second
// direction, so it is closed here too.
//
// ColumnEditor now refuses to SAVE a colliding pair, which is the real fix; this keeps
// an already-stored pair from breaking the grid. Worth porting back to Marketing Ops.
const dedupe = (keys: Field[]): Field[] => [...new Set(keys)]

/** The columns of a tab, from the configuration alone.
 *
 *  Order: what an admin configured — computed columns included, where they mapped a
 *  heading — then any computed field no heading mapped to. `lead_state` is always in the
 *  second group: it is chosen once per submission, so there is no heading for it.
 */
export function baseColumns(config: EventsConfig, tab: Tab): Field[] {
  const configured = dedupe(defsOf(config, tab).map(keyOf))
  const placed = new Set(configured)
  return [...configured, ...COMPUTED_FIELDS.filter(f => !placed.has(f))]
}

/** The columns a tab shows, including anything the stored rows carry that no definition
 *  claims — a column from before Settings became the contract, or one that was renamed
 *  since. They sit between the configured columns and the computed tail.
 *
 *  Configured columns appear whether or not any row filled them in. Deriving columns
 *  from the data was a real bug: a missing email or an empty notes column produced no
 *  column at all, so the very issues that most need showing ("this is required") had
 *  nowhere to render — the counts said seven problems and the grid showed none.
 */
export function columnsFor(rows: { data: Record<string, string> }[], tab: Tab,
                           config: EventsConfig): Field[] {
  const configured = dedupe(defsOf(config, tab).map(keyOf))
  const placed = new Set(configured)
  const tail = COMPUTED_FIELDS.filter(f => !placed.has(f))

  const known = new Set([...configured, ...tail])
  const extra: Field[] = []
  for (const r of rows) {
    for (const key of Object.keys(r.data ?? {})) {
      if (!known.has(key) && !extra.includes(key)) extra.push(key)
    }
  }
  extra.sort()
  return [...configured, ...extra, ...tail]
}
