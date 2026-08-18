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

// Asking the server about values our own rules could not resolve.
//
// The only place in the fix path that touches the network, and it runs once after a
// load — not per click. Everything downstream (accept, reject, edit) is local.
//
// What travels is worth being precise about: a field name, the odd value, the allowed
// list, and for a state the country. **No names, no email addresses, no phone numbers.**
// The attendee data stays in the browser.
//
// Folding the answers back in is `applySuggestions` in model.ts, because a suggestion
// has to be REMEMBERED: validation rebuilds every issue from scratch on each change, so
// an answer only held on the issue object would be discarded the moment anything else
// was edited.

import type { Model } from './model'
import type { Issue } from './validate'

/** Findings the server could plausibly answer: the value exists and there is a fixed
 *  set to choose from. A missing email or a hot lead with no notes is not a formatting
 *  problem and must never be sent. */
function isAnswerable(issue: Issue): boolean {
  return !issue.suggestion && !!issue.options?.length && issue.bucket === 'fixable'
}

export interface SuggestItem {
  key: string
  field: string
  value: string
  allowed: string[]
  context: string
}

export interface SuggestionAnswer {
  key: string
  value?: string | null
  confidence?: number
  source?: string
}

/** Every unresolved cell, as a question. The key says where the answer belongs. */
export function buildRequest(model: Model): SuggestItem[] {
  const items: SuggestItem[] = []
  for (const [tab, rows] of Object.entries(model.tabs)) {
    for (const row of rows) {
      for (const issue of row.issues) {
        if (!isAnswerable(issue)) continue
        items.push({
          key: `${tab}|${row.id}|${issue.field}`,
          field: issue.field,
          value: issue.value,
          allowed: issue.options ?? [],
          context: issue.context ?? '',
        })
      }
    }
  }
  return items
}
