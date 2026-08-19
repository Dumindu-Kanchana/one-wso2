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

// The row shape and dirty-check shared by ParameterListManager and the Marketing
// Admin panels that host it. Kept in its own module rather than exported from
// the component file so React Fast Refresh keeps working — a file that exports
// both a component and a helper loses hot-reload for the component.

// One editable value in a parameter list. `cols` is 1 or 2 entries depending on
// the list (asset-name values are single-column; UTM values are label + code).
// `id` is server-assigned and absent on rows the admin just added.
export interface PListRow {
  id?: string;
  cols: string[];
  enabled: boolean;
}

// Stable string form of a list, used for dirty-checking in the editor and for
// the unsaved-changes dots in the panels' nav.
//
// Compares trimmed values, enabled state, and ORDER — order is meaningful here
// because it's the order values appear in the generators' dropdowns, and the
// save endpoint replaces the whole ordered list.
//
// Deliberately ignores `id`: it's server-assigned, so a newly-added row has none
// and including it would report every list containing a new row as permanently
// dirty even straight after a save.
export const serializeRows = (rows: PListRow[] | undefined): string =>
  JSON.stringify((rows ?? []).map((r) => [r.cols.map((c) => c.trim()), r.enabled]));
