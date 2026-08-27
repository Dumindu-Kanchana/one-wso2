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


// What the admin screen shows, given which cycles exist.
//
// The standalone app decides this with three interleaved booleans and a polling
// effect, spread across a component. As one function over the three status
// queries it can be tested, which matters because the branches are not
// mutually exclusive in the data — more than one list can be non-empty — and the
// order they are checked in is the behaviour.
//
// Order reproduced from views/adminPortal/panels/OngoingPanel.tsx:
//
//   isParCycleOngoing            -> the org summary
//   PENDING_QUOTA && !ongoing    -> assign quota
//   (pending)                    -> the creation job is still running
//   otherwise                    -> offer to create one

import type { ParCycle } from "../api/parTypes";

export type ParAdminView =
  /** A cycle is open: show the org-wide summary. */
  | "summary"
  /** Created, quota not yet allocated. Nothing else can happen until it is. */
  | "assignQuota"
  /** The creation job is still running. */
  | "creating"
  /** No cycle in flight. Offer to create one. */
  | "create";

export interface ParAdminCycles {
  open: readonly ParCycle[] | undefined;
  quotaPending: readonly ParCycle[] | undefined;
  pending: readonly ParCycle[] | undefined;
}

/** The one view the screen should render. */
export function parAdminView(cycles: ParAdminCycles): ParAdminView {
  const open = first(cycles.open);
  if (open) return "summary";
  if (first(cycles.quotaPending)) return "assignQuota";
  if (first(cycles.pending)) return "creating";
  return "create";
}

/**
 * The cycle the view is about, if any.
 *
 * The create view has none, which is why this is separate from the view rather
 * than carried with it.
 */
export function parAdminCycle(cycles: ParAdminCycles): ParCycle | undefined {
  return first(cycles.open) ?? first(cycles.quotaPending) ?? first(cycles.pending);
}

/**
 * Whether the PENDING list should still be polled.
 *
 * Only while something is in it. A creation job that FAILS moves the cycle to a
 * status nothing queries, so the list empties and polling stops — see §9.3. That
 * is the standalone app's behaviour and it is reproduced rather than corrected:
 * the screen then offers to create a cycle whose slot is still occupied, and the
 * attempt is refused with a conflict.
 */
export function shouldPollPending(cycles: ParAdminCycles): boolean {
  return Boolean(first(cycles.pending));
}

function first(list: readonly ParCycle[] | undefined): ParCycle | undefined {
  return Array.isArray(list) && list.length > 0 ? list[0] : undefined;
}
