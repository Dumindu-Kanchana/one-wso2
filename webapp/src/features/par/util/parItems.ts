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

// Which PAR screens each role opens.
//
// Deliberately free of imports: useParGate pulls in @asgardeo/react, which
// drags @asgardeo/browser into any module that touches it — and that package
// fails to resolve under the test environment. Keeping the decision here means
// it can be tested directly, as data, instead of through a mocked hook. Same
// reason util/parDeadlines.ts holds the deadline rules.

/** Screens whose visibility this gate decides. */
export const PAR_ITEM_IDS = new Set<string>([
  "par-my",
  "par-history",
  "par-team",
  "par-admin",
  "par-settings",
]);

const ADMIN_ITEM_IDS = new Set<string>(["par-admin", "par-settings"]);
const TEAM_LEAD_ITEM_IDS = new Set<string>(["par-team"]);

export interface ParRoles {
  isAdmin: boolean;
  isTeamLead: boolean;
}

/**
 * Whether one PAR rail item is visible to someone holding these roles.
 *
 * Pure and exported so the decision can be tested as data rather than through
 * a hook with an Asgardeo mock around it — the same reason the deadline rules
 * live in util/parDeadlines.ts.
 */
export function parItemVisible(itemId: string, roles: ParRoles): boolean {
  if (ADMIN_ITEM_IDS.has(itemId)) return roles.isAdmin;
  if (TEAM_LEAD_ITEM_IDS.has(itemId)) return roles.isTeamLead;
  // Every signed-in employee has their own PAR and their own history.
  if (PAR_ITEM_IDS.has(itemId)) return true;
  // A PAR item added to the registry but never listed above falls to here and
  // stays hidden. Failing closed is the point: the alternative leaks a new
  // admin screen to everyone until someone notices.
  return false;
}
