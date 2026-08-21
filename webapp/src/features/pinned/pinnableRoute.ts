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

import { PERSPECTIVES, type PerspectiveSection } from "@constants/perspectives";
import type { PinnedEntry } from "@features/pinned/pinnedStore";
import type { PinKind } from "@features/pinned/pinKinds";

export type PinnableEntry = Omit<PinnedEntry, "visitedAt" | "pinned">;

/**
 * Turn the current route into a pinnable entry.
 *
 * Unlike csm-portal's equivalent, which derives titles from path segments
 * (`humanizeSegment("security-center") -> "Security center"`), One WSO2 already
 * has a registry that maps every route to a real label: @constants/perspectives
 * carries `label`, `icon`, and `path` for each perspective, section, and app
 * item. So the label is looked up, not munged — a pinned route reads exactly as
 * it does in the rail.
 *
 * Labels are qualified by their immediate container when they have one, because
 * pins are global — the strip shows entries from every perspective at once, and
 * "History" alone is ambiguous across the three finance apps. So an app item
 * reads "OPD Claims · Claim History", while a top-level section that needs no
 * disambiguation stays "My Team".
 */
/**
 * Drop a trailing slash so "/me/opd/history/" resolves like "/me/opd/history".
 * React Router matches both, so both reach here; without this the registry
 * lookup misses, the label falls back to a guess, and the same page pins a
 * second time alongside its canonical entry. SideRail gets this for free from
 * `matchPath` — this file compares strings, so it has to normalise first.
 * "/" itself has no trailing slash to drop.
 */
function normalizePath(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") || "/" : pathname;
}

export function pinnableRoute(pathname: string, search = ""): PinnableEntry {
  const path = normalizePath(pathname);
  const match = findRoute(path);
  // A query string means filter/view state, so distinct views pin separately.
  // Nothing in One WSO2 puts filters in the URL yet; csm-portal does, and this
  // is the seam that will already be correct when it lands.
  const kind: PinKind = search && search !== "?" ? "search" : "page";
  const href = path + (kind === "search" ? search : "");

  return {
    kind,
    // Full href as the id, so /me/opd/history and a filtered variant of it are
    // separate pins rather than one overwriting the other.
    id: href,
    label: match ?? fallbackLabel(path),
    href,
  };
}

/** Walk the registry for an exact route match, returning a qualified label. */
function findRoute(pathname: string): string | undefined {
  for (const perspective of PERSPECTIVES) {
    if (perspective.path === pathname) return perspective.label;

    for (const section of perspective.sections ?? []) {
      // Already qualified by `findInSection` when the hit came from a child.
      // One rule, applied consistently: a label is qualified by its immediate
      // container if it has one, and stands alone if it doesn't. So a top-level
      // section is "My Team", never "Me · My Team", while a child inside an app
      // is "OPD Claims · Claim History" — qualified where ambiguity is real.
      const hit = findInSection(section, pathname);
      if (hit) return hit;
    }
  }
  return undefined;
}

function findInSection(
  section: PerspectiveSection,
  pathname: string,
): string | undefined {
  if (section.path === pathname) return section.label;
  for (const child of section.children ?? []) {
    if (child.path === pathname) return qualify(section.label, child.label);
  }
  return undefined;
}

const qualify = (context: string, label: string) => `${context} · ${label}`;

/**
 * Last resort for a route the registry doesn't know — a page added without a
 * rail entry, say. Title-cases the deepest segment so the pin is still
 * recognisable rather than blank.
 */
function fallbackLabel(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  const last = segments[segments.length - 1] ?? "";
  const words = last.replace(/[-_]+/g, " ").trim();
  if (!words) return "Page";
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** True when the registry recognises this route — i.e. the label isn't guessed. */
export function isKnownRoute(pathname: string): boolean {
  return findRoute(normalizePath(pathname)) !== undefined;
}
