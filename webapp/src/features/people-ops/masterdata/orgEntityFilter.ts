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

import type { OrgChartEntity } from "../api/peopleOpsTypes";

export type StatusFilter = "active" | "inactive" | "all";

/**
 * Resolves a head's email to their display name, for search.
 *
 * The table shows heads as people (avatar + name), so typing a name someone
 * can SEE has to match — searching "Sachin" while looking at a row labelled
 * "Sachin Ranasinghe" and getting nothing is the kind of small betrayal that
 * makes a search feel broken. Emails still match, because the underlying
 * value is still an email.
 */
export type HeadNameLookup = (email: string) => string | undefined;

/**
 * Client-side search + status filter for an org entity list.
 *
 * Client-side because these lists are tens of rows and arrive whole — the
 * endpoints have no search or pagination. Kept out of the component so the
 * matching rules are testable directly.
 *
 * Search covers the entity name, the head's email, and — when `headName` can
 * resolve one — the head's display name. Case-insensitive, and trimmed so a
 * stray space doesn't empty the table.
 */
export function filterOrgEntities(
  entities: OrgChartEntity[],
  search: string,
  status: StatusFilter,
  headName?: HeadNameLookup,
): OrgChartEntity[] {
  const query = search.trim().toLowerCase();

  return entities.filter((entity) => {
    if (status === "active" && !entity.isActive) return false;
    if (status === "inactive" && entity.isActive) return false;
    if (!query) return true;

    if (entity.name.toLowerCase().includes(query)) return true;

    const email = entity.headEmail ?? "";
    if (email.toLowerCase().includes(query)) return true;

    // Only when the roster has loaded and knows this address. Absent, search
    // simply falls back to matching emails rather than failing.
    const name = email ? headName?.(email) : undefined;
    return Boolean(name && name.toLowerCase().includes(query));
  });
}
