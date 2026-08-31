/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { matchPath } from "react-router";
import type { PerspectiveSection } from "@constants/perspectives";

// Which rail row reads as selected, and which groups are open, resolved from
// the URL rather than from click state — so a deep link, a browser Back or the
// waffle all light the same row.

/**
 * True when the URL *is* this path or sits beneath it.
 *
 * A rail row stands for a screen, and a screen may own routes under itself: a
 * team member's detail page under My Team, a tab under a Leave group. Matching
 * only the exact path leaves the row dark on all of them.
 *
 * `matchPath` rather than `startsWith` so the comparison is by path segment —
 * `/me/leave/general` must not claim `/me/leave/generalization`.
 */
export function onPathOrBelow(path: string, pathname: string): boolean {
  return Boolean(matchPath({ path, end: false }, pathname));
}

/**
 * Groups to render expanded: any holding a child whose screen the URL is on.
 *
 * This has to be as tolerant as `activeItemId` below. It was exact-only, which
 * was invisible while every rail path was also a whole route — then Leave's
 * screens moved under `/me/leave/{kind}/{action}`, no child path matched a URL
 * exactly any more, and the group stopped opening. The selected row was still
 * being computed correctly; it was just folded away inside a closed accordion.
 */
export function activeGroupIds(
  sections: readonly PerspectiveSection[],
  pathname: string,
): Set<string> {
  const ids = new Set<string>();
  for (const s of sections) {
    if (s.children?.some((c) => c.path && onPathOrBelow(c.path, pathname))) {
      ids.add(s.id);
    }
  }
  return ids;
}

/**
 * The id of the row to mark selected, or "" for none.
 *
 * Two passes on purpose. An exact match must win outright, or a section whose
 * path prefixes another's would steal it; only when nothing matches exactly do
 * descendants count.
 */
export function activeItemId({
  sections,
  pathname,
  overviewPath,
  overviewId,
}: {
  sections: readonly PerspectiveSection[];
  pathname: string;
  overviewPath?: string;
  overviewId: string;
}): string {
  for (const s of sections) {
    if (s.path && matchPath(s.path, pathname)) return s.id;
    for (const c of s.children ?? []) {
      if (c.path && matchPath(c.path, pathname)) return c.id;
    }
  }
  if (overviewPath && matchPath(overviewPath, pathname)) return overviewId;

  for (const s of sections) {
    for (const c of s.children ?? []) {
      if (c.path && onPathOrBelow(c.path, pathname)) return c.id;
    }
    if (s.path && onPathOrBelow(s.path, pathname)) return s.id;
  }
  return "";
}
