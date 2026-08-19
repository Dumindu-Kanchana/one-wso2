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

import { useCallback, useEffect, useState } from "react";
import { useAsgardeoSub } from "@hooks/useAsgardeoSub";
import {
  PINNED_CHANGED_EVENT,
  readEntries,
  resolveActiveUser,
  togglePin as togglePinInStore,
  type PinResult,
  type PinnedEntry,
} from "@features/pinned/pinnedStore";
import type { PinnableEntry } from "@features/pinned/pinnableRoute";

/**
 * Point the store at the signed-in user's bucket.
 *
 * Returns the resolved `sub`, or undefined while it is still being decoded. The
 * store seeds itself optimistically from a remembered key so pins render on the
 * first paint; this corrects it once the ID token actually resolves.
 */
function useActiveUser(): string | undefined {
  const { state } = useAsgardeoSub();
  const sub = state.status === "ready" ? state.sub : undefined;

  useEffect(() => {
    if (!sub) return;
    if (resolveActiveUser(sub)) {
      // The bucket moved, so every mounted reader needs to re-read rather than
      // keep showing whatever the optimistic key had.
      window.dispatchEvent(new CustomEvent(PINNED_CHANGED_EVENT));
    }
  }, [sub]);

  return sub;
}

/** Mount once, high in the tree, so identity resolves even with no reader open. */
export function useSyncPinnedIdentity(): void {
  useActiveUser();
}

/** Live view of the working set, most-recently-touched first. */
export function usePinnedEntries(): PinnedEntry[] {
  const sub = useActiveUser();
  const [entries, setEntries] = useState<PinnedEntry[]>(() =>
    readEntries().filter((e) => e.pinned),
  );

  useEffect(() => {
    // Re-read on identity settling as well as on change events: this instance
    // may have mounted against the optimistic bucket before `sub` arrived.
    if (sub) resolveActiveUser(sub);
    const sync = () => setEntries(readEntries().filter((e) => e.pinned));
    sync();
    window.addEventListener(PINNED_CHANGED_EVENT, sync);
    // `storage` fires in OTHER tabs, so pinning in one updates the rest.
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(PINNED_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [sub]);

  return entries;
}

/**
 * Toggle the pin for a route-derived entry.
 *
 * Forces the bucket to this instance's resolved identity first, so a click that
 * lands before some other component's identity effect has run still writes to
 * the right place.
 */
export function useTogglePin(): (entry: PinnableEntry) => PinResult {
  const sub = useActiveUser();
  return useCallback(
    (entry: PinnableEntry) => {
      if (sub) resolveActiveUser(sub);
      return togglePinInStore(entry);
    },
    [sub],
  );
}
