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

import { reachablePerspectives } from "@constants/perspectives";

/**
 * Favourite apps, for the launcher.
 *
 * Deliberately NOT part of the pinned store, despite the surface similarity.
 * They are different things with different lifetimes:
 *
 *  - A pin is a transient working set of PAGES, capped at eight, surfaced in the
 *    header strip while you are busy with them.
 *  - A favourite is a stable preference about an APP, surfaced in the launcher.
 *
 * Sharing one capped store between the two would mean favouriting a handful of
 * apps quietly eats the budget for pinning the page you are working on. Kept
 * apart, each stays simple. The two do share the identity source
 * (`useAsgardeoSub`), so nothing is duplicated but the storage key.
 *
 * No cap: the ceiling is the number of reachable perspectives, which is small,
 * and favouriting all of them is a coherent thing to want.
 */
const STORAGE_KEY_BASE = "one-wso2.favourites.v1";

/** Per-user, because a browser profile is shared more often than an account is. */
function storageKey(sub: string): string {
  return `${STORAGE_KEY_BASE}.${sub}`;
}

/** Perspective keys that may be favourited. */
function favouritableKeys(): Set<string> {
  return new Set(reachablePerspectives().map((p) => p.key));
}

/** True when this perspective is one a user could favourite. */
export function isFavouritable(key: string): boolean {
  return favouritableKeys().has(key);
}

/**
 * A user's favourites, in the order they were added.
 *
 * Filtered against the registry on read: this is user-editable storage, and a
 * perspective can stop being reachable between releases. An unknown key is
 * dropped rather than rendered as a broken tile.
 */
export function readFavourites(sub: string | undefined): string[] {
  if (!sub) return [];
  try {
    const raw = localStorage.getItem(storageKey(sub));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const allowed = favouritableKeys();
    const seen = new Set<string>();
    return parsed.filter(
      (k): k is string =>
        typeof k === "string" && allowed.has(k) && !seen.has(k) && (seen.add(k), true),
    );
  } catch {
    return [];
  }
}

function write(sub: string, keys: string[]): void {
  try {
    localStorage.setItem(storageKey(sub), JSON.stringify(keys));
  } catch {
    // Private browsing and quota failures land here. Losing a favourite is
    // acceptable; throwing out of a click handler is not.
  }
}

/**
 * Add or remove a favourite, returning the new list.
 *
 * Appends rather than prepends, so the launcher's Favourites row keeps a stable
 * order — a set that reshuffles every time you add to it is harder to use than
 * one that grows predictably.
 */
export function toggleFavourite(sub: string | undefined, key: string): string[] {
  if (!sub || !isFavouritable(key)) return readFavourites(sub);
  const current = readFavourites(sub);
  const next = current.includes(key)
    ? current.filter((k) => k !== key)
    : [...current, key];
  write(sub, next);
  return next;
}
