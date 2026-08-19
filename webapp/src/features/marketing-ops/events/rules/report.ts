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

// What is still standing between this list and the marketing team.
//
// Submit is deliberately never disabled. A greyed-out button explains nothing — you are
// left hunting across five tabs for whatever it disapproves of. Pressing it and being
// told exactly what remains is the same information, delivered when it is asked for.

import { labelOf, type EventsConfig, type Tab } from './schema'
import type { Model } from './model'

export interface ReportLine {
  tab: Tab
  field: string
  label: string
  /** Rows affected, 1-based, as the grid numbers them. */
  rows: number[]
  message: string
  /** True when a suggestion is waiting — one click rather than manual work. */
  fixable: boolean
}

export interface Report {
  lines: ReportLine[]
  blocking: number
  fixable: number
  get ok(): boolean
}

/** Group everything unresolved by tab and field, most affected first. */
export function buildReport(model: Model, config: EventsConfig): Report {
  const grouped = new Map<string, ReportLine>()

  for (const [tab, rows] of Object.entries(model.tabs)) {
    if (!rows) continue
    rows.forEach((row, index) => {
      for (const issue of row.issues) {
        const key = `${tab}|${issue.field}|${issue.suggestion ? "fix" : "you"}`
        const line: ReportLine = grouped.get(key) ?? {
          tab, field: issue.field,
          label: labelOf(config, tab, issue.field),
          rows: [], message: issue.message, fixable: !!issue.suggestion,
        }
        line.rows.push(index + 1)
        grouped.set(key, line)
      }
    })
  }

  const lines = [...grouped.values()].sort((a, b) =>
    Number(a.fixable) - Number(b.fixable) || b.rows.length - a.rows.length)

  const blocking = lines.filter(l => !l.fixable).reduce((n, l) => n + l.rows.length, 0)
  const fixable = lines.filter(l => l.fixable).reduce((n, l) => n + l.rows.length, 0)

  return { lines, blocking, fixable, get ok() { return this.lines.length === 0 } }
}
