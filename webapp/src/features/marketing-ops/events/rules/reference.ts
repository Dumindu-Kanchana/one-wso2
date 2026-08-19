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

// Countries and states, fetched once and held for the session.
//
// MOP owns these lists — they are never read from an uploaded workbook, whose copies
// drift and whose state tab only ever held US values despite state being mandatory for
// the US, Canada and India too. They live in the database so a correction needs no
// deployment, which is why they are fetched rather than bundled.

export interface Reference {
  countries: string[]
  states: Record<string, string[]>
  stateRequired: string[]
  /** False when no model is configured. Everything still works, with fewer
   *  suggestions — the screen says so rather than looking broken. */
  assisted: boolean
}

export const EMPTY_REFERENCE: Reference = {
  countries: [], states: {}, stateRequired: [], assisted: false,
}

/** Shape the API returns (snake_case) into the shape the rules use. */
export function toReference(raw: {
  countries?: string[]
  states?: Record<string, string[]>
  state_required?: string[]
  assisted?: boolean
}): Reference {
  return {
    countries: raw.countries ?? [],
    states: raw.states ?? {},
    stateRequired: raw.state_required ?? [],
    assisted: !!raw.assisted,
  }
}
