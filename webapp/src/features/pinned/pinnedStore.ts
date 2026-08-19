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

import { isPinKind, type PinKind } from "@features/pinned/pinKinds";
import { SIGNING_OUT_EVENT } from "@constants/appEvents";

/**
 * A tracked destination.
 *
 * `pinned` is a FLAG on an entry list rather than a separate pins table, which
 * is csm-portal's shape and the reason it can serve both pins and recents from
 * one store. Only pins are surfaced in the UI today; recents can be layered on
 * without a migration.
 */
export interface PinnedEntry {
  kind: PinKind;
  /** Unique within a kind. For page/search kinds this is the href. */
  id: string;
  /**
   * Snapshot of the display label, always stored rather than derived at render.
   * Route labels could be looked up from the perspective registry, but an entity
   * title (a case subject, say) only exists in a backend response — storing it
   * unconditionally covers both and keeps the rail/header free of fetches.
   * Cost: a renamed entity keeps its old label until it is visited again.
   */
  label: string;
  href: string;
  /** ISO timestamp; ordering is most-recent-first. */
  visitedAt: string;
  /** Pinned entries form the working set and are never evicted by the cap. */
  pinned?: boolean;
}

const STORAGE_KEY_BASE = "one-wso2.pinned.v1";
const LAST_USER_KEY = `${STORAGE_KEY_BASE}.lastUserKey`;

/** Recency cap for UNPINNED entries. Pinned entries always survive. */
export const MAX_UNPINNED = 12;
/**
 * Ceiling on the working set. Chosen so the header strip stays scannable; a
 * refused pin is better than one that silently evicts an older pin the user
 * deliberately placed.
 */
export const MAX_PINNED = 8;

/** Fired after any write, so every hook instance in this tab re-reads. */
export const PINNED_CHANGED_EVENT = "one-wso2:pinned-changed";

/**
 * Which user's bucket reads and writes address.
 *
 * Seeded from localStorage so a same-user reload renders pins immediately
 * instead of flashing empty while the ID token decodes, then corrected once the
 * real subject resolves. Module-scoped: each tab seeds and corrects its own.
 */
let activeUserKey: string | null = readLastKnownUserKey();

function readLastKnownUserKey(): string | null {
  try {
    return localStorage.getItem(LAST_USER_KEY);
  } catch {
    return null;
  }
}

function storageKey(): string {
  return `${STORAGE_KEY_BASE}.${activeUserKey ?? "pending"}`;
}

/**
 * Point reads/writes at `userKey`, migrating anything written to the "pending"
 * bucket before identity resolved. Returns true if the active bucket changed.
 */
export function resolveActiveUser(userKey: string): boolean {
  if (activeUserKey === userKey) return false;
  const pending = readKey(`${STORAGE_KEY_BASE}.pending`);
  activeUserKey = userKey;
  try {
    localStorage.setItem(LAST_USER_KEY, userKey);
  } catch {
    /* ignore */
  }
  if (pending.length > 0) {
    const existing = readKey(storageKey());
    if (existing.length === 0) writeKey(storageKey(), pending);
    try {
      localStorage.removeItem(`${STORAGE_KEY_BASE}.pending`);
    } catch {
      /* ignore */
    }
  }
  return true;
}

function readKey(key: string): PinnedEntry[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Validate rather than trust: this is user-writable storage, and a shape
    // change between versions must degrade to "no pins", never to a crash.
    return parsed.filter((e): e is PinnedEntry => {
      if (typeof e !== "object" || e === null) return false;
      const c = e as Record<string, unknown>;
      return (
        isPinKind(c.kind) &&
        typeof c.id === "string" &&
        typeof c.label === "string" &&
        typeof c.href === "string" &&
        typeof c.visitedAt === "string"
      );
    });
  } catch {
    return [];
  }
}

function writeKey(key: string, entries: PinnedEntry[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(entries));
  } catch {
    // Private-browsing modes and quota failures both land here. Losing a pin is
    // acceptable; throwing out of a click handler is not.
  }
}

export function readEntries(): PinnedEntry[] {
  return readKey(storageKey());
}

function commit(entries: PinnedEntry[]): void {
  writeKey(storageKey(), entries);
  try {
    window.dispatchEvent(new CustomEvent(PINNED_CHANGED_EVENT));
  } catch {
    /* ignore */
  }
}

/** Enforce the unpinned cap while keeping every pin, preserving order. */
export function capUnpinned(entries: PinnedEntry[]): PinnedEntry[] {
  const kept: PinnedEntry[] = [];
  let unpinned = 0;
  for (const e of entries) {
    if (e.pinned) {
      kept.push(e);
    } else if (unpinned < MAX_UNPINNED) {
      kept.push(e);
      unpinned += 1;
    }
  }
  return kept;
}

export function pinnedCount(entries: PinnedEntry[] = readEntries()): number {
  return entries.filter((e) => e.pinned).length;
}

const sameEntry = (a: { kind: PinKind; id: string }, b: PinnedEntry) =>
  b.kind === a.kind && b.id === a.id;

/** Record a visit. De-dupes on kind+id, bumps to front, preserves pinned state. */
export function recordVisit(entry: Omit<PinnedEntry, "visitedAt" | "pinned">): void {
  const current = readEntries();
  const existing = current.find((e) => sameEntry(entry, e));
  const rest = current.filter((e) => !sameEntry(entry, e));
  commit(
    capUnpinned([
      { ...entry, visitedAt: new Date().toISOString(), pinned: existing?.pinned },
      ...rest,
    ]),
  );
}

export type PinResult = "pinned" | "unpinned" | "at-capacity";

/**
 * Toggle the pin on an entry, recording it first if it isn't tracked yet.
 *
 * Returns `"at-capacity"` without changing anything when the working set is
 * full, so the caller can say so rather than the pin silently not appearing.
 */
export function togglePin(entry: Omit<PinnedEntry, "visitedAt" | "pinned">): PinResult {
  const current = readEntries();
  const existing = current.find((e) => sameEntry(entry, e));

  if (existing?.pinned) {
    commit(
      capUnpinned(
        current.map((e) => (sameEntry(entry, e) ? { ...e, pinned: false } : e)),
      ),
    );
    return "unpinned";
  }

  if (pinnedCount(current) >= MAX_PINNED) return "at-capacity";

  const now = new Date().toISOString();
  const rest = current.filter((e) => !sameEntry(entry, e));
  commit(
    capUnpinned([
      { ...entry, visitedAt: existing?.visitedAt ?? now, pinned: true },
      ...rest,
    ]),
  );
  return "pinned";
}

export function isPinned(kind: PinKind, id: string, entries = readEntries()): boolean {
  return entries.some((e) => e.kind === kind && e.id === id && e.pinned);
}

/** Clear history but keep the working set — pins are deliberate, history isn't. */
export function clearUnpinned(): void {
  commit(readEntries().filter((e) => e.pinned));
}

// Wipe the active bucket on a deliberate sign-out. Registered at module load
// rather than in a component so it fires wherever sign-out is triggered from.
// SIGNING_OUT_EVENT is dispatched only by the user-menu action and the idle
// timeout — never by a silent re-auth — so this can't clear pins out from under
// someone who is still signed in.
if (typeof window !== "undefined") {
  window.addEventListener(SIGNING_OUT_EVENT, () => {
    try {
      localStorage.removeItem(storageKey());
      // Don't leave a pointer at the user who just left; the next person on this
      // browser should resolve their own bucket from scratch.
      localStorage.removeItem(LAST_USER_KEY);
    } catch {
      /* ignore */
    }
    activeUserKey = null;
    try {
      window.dispatchEvent(new CustomEvent(PINNED_CHANGED_EVENT));
    } catch {
      /* ignore */
    }
  });
}

/** Test-only: reset module state between cases. */
export function __resetForTests(): void {
  activeUserKey = null;
}
