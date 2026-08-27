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


// Which rail item the current URL lights up.
//
// Extracted from SideRail so the rule can be tested against the real registry
// rather than through a mounted rail — and because it was wrong in a way that
// only shows on a detail route.
//
// ---- the bug this fixes -----------------------------------------------
//
// The descendant pass returned the FIRST item whose path prefixed the URL, in
// registry order. PAR is the first app whose home item sits at the app root
// (`/me/par`) with siblings beneath it (`/me/par/team`), so on
// `/me/par/team/someone@wso2.com` the prefix `/me/par` matched first and "My
// PAR" lit up instead of "My Team's PAR".
//
// The rule is the longest match, not the first: the most specific route wins.
// Registry order is an editorial choice about how the rail reads, and it must
// not decide correctness.

import { matchPath } from "react-router";
import type { PerspectiveSection } from "@constants/perspectives";

/**
 * The id of the section or child whose route matches `pathname`, or `""`.
 *
 * With `allowDescendants`, a route BELOW an item's path counts — which is how a
 * detail screen keeps its own section lit instead of clearing the rail. Callers
 * should try exact first: an exact match must always beat a descendant one, or
 * an item whose path prefixes another's steals it.
 */
export function matchSectionId(
  sections: readonly PerspectiveSection[],
  pathname: string,
  { allowDescendants = false }: { allowDescendants?: boolean } = {},
): string {
  let bestId = "";
  let bestLength = -1;

  const consider = (item: PerspectiveSection) => {
    if (!item.path) return;
    const matched = allowDescendants
      ? matchPath({ path: item.path, end: false }, pathname)
      : matchPath(item.path, pathname);
    if (!matched) return;
    // Longest wins. Two items cannot share a path, so there is no tie to break.
    if (item.path.length <= bestLength) return;
    bestLength = item.path.length;
    bestId = item.id;
  };

  for (const section of sections) {
    consider(section);
    for (const child of section.children ?? []) consider(child);
  }
  return bestId;
}
