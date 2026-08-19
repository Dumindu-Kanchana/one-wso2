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

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MAX_PINNED,
  MAX_UNPINNED,
  PINNED_CHANGED_EVENT,
  __resetForTests,
  clearUnpinned,
  isPinned,
  pinnedCount,
  readEntries,
  recordVisit,
  resolveActiveUser,
  togglePin,
} from "@features/pinned/pinnedStore";
import { SIGNING_OUT_EVENT } from "@constants/appEvents";

const page = (id: string, label = id) =>
  ({ kind: "page", id, label, href: id }) as const;

beforeEach(() => {
  localStorage.clear();
  __resetForTests();
});

describe("recordVisit", () => {
  it("de-dupes on kind+id and bumps the entry to the front", () => {
    recordVisit(page("/a"));
    recordVisit(page("/b"));
    recordVisit(page("/a"));
    expect(readEntries().map((e) => e.id)).toEqual(["/a", "/b"]);
  });

  it("keeps the same id under a different kind as a distinct entry", () => {
    recordVisit({ kind: "page", id: "/x", label: "X", href: "/x" });
    recordVisit({ kind: "search", id: "/x", label: "X filtered", href: "/x?q=1" });
    expect(readEntries()).toHaveLength(2);
  });

  it("does not lose a pin when the entry is revisited", () => {
    togglePin(page("/a"));
    recordVisit(page("/a", "A renamed"));
    expect(isPinned("page", "/a")).toBe(true);
    expect(readEntries()[0].label).toBe("A renamed");
  });

  it("evicts unpinned entries past the cap but keeps every pin", () => {
    togglePin(page("/pinned"));
    for (let i = 0; i < MAX_UNPINNED + 5; i++) recordVisit(page(`/p${i}`));
    const entries = readEntries();
    expect(entries.filter((e) => !e.pinned)).toHaveLength(MAX_UNPINNED);
    expect(isPinned("page", "/pinned")).toBe(true);
  });
});

describe("togglePin", () => {
  it("pins an untracked route in one call", () => {
    expect(togglePin(page("/new"))).toBe("pinned");
    expect(isPinned("page", "/new")).toBe(true);
  });

  it("unpins on a second call without dropping the entry", () => {
    togglePin(page("/a"));
    expect(togglePin(page("/a"))).toBe("unpinned");
    expect(isPinned("page", "/a")).toBe(false);
    expect(readEntries()).toHaveLength(1);
  });

  it("refuses past the ceiling rather than evicting an existing pin", () => {
    for (let i = 0; i < MAX_PINNED; i++) expect(togglePin(page(`/p${i}`))).toBe("pinned");
    expect(togglePin(page("/one-too-many"))).toBe("at-capacity");
    expect(pinnedCount()).toBe(MAX_PINNED);
    expect(isPinned("page", "/one-too-many")).toBe(false);
  });

  it("still allows unpinning while at capacity", () => {
    for (let i = 0; i < MAX_PINNED; i++) togglePin(page(`/p${i}`));
    expect(togglePin(page("/p0"))).toBe("unpinned");
    expect(pinnedCount()).toBe(MAX_PINNED - 1);
  });

  it("notifies listeners so other hook instances re-read", () => {
    const seen = vi.fn();
    window.addEventListener(PINNED_CHANGED_EVENT, seen);
    togglePin(page("/a"));
    expect(seen).toHaveBeenCalled();
    window.removeEventListener(PINNED_CHANGED_EVENT, seen);
  });
});

describe("clearUnpinned", () => {
  it("wipes history and keeps the working set", () => {
    togglePin(page("/kept"));
    recordVisit(page("/history"));
    clearUnpinned();
    expect(readEntries().map((e) => e.id)).toEqual(["/kept"]);
  });
});

describe("per-user scoping", () => {
  it("keeps one user's pins out of another's bucket", () => {
    resolveActiveUser("user-a");
    togglePin(page("/a-only"));
    resolveActiveUser("user-b");
    expect(readEntries()).toEqual([]);
    resolveActiveUser("user-a");
    expect(isPinned("page", "/a-only")).toBe(true);
  });

  it("migrates writes made before identity resolved", () => {
    // No resolveActiveUser yet — this lands in the "pending" bucket.
    togglePin(page("/early"));
    resolveActiveUser("user-a");
    expect(isPinned("page", "/early")).toBe(true);
  });

  it("does not clobber an existing bucket when migrating pending writes", () => {
    resolveActiveUser("user-a");
    togglePin(page("/existing"));
    __resetForTests();
    togglePin(page("/pending"));
    resolveActiveUser("user-a");
    expect(readEntries().map((e) => e.id)).toEqual(["/existing"]);
  });
});

describe("corrupt storage", () => {
  it("degrades to empty rather than throwing", () => {
    resolveActiveUser("user-a");
    localStorage.setItem("one-wso2.pinned.v1.user-a", "not json");
    expect(readEntries()).toEqual([]);
  });

  it("drops entries with an unknown kind or a missing field", () => {
    resolveActiveUser("user-a");
    localStorage.setItem(
      "one-wso2.pinned.v1.user-a",
      JSON.stringify([
        { kind: "page", id: "/ok", label: "Ok", href: "/ok", visitedAt: "2026-01-01" },
        { kind: "not-a-kind", id: "/x", label: "X", href: "/x", visitedAt: "2026-01-01" },
        { kind: "page", id: "/no-label", href: "/y", visitedAt: "2026-01-01" },
      ]),
    );
    expect(readEntries().map((e) => e.id)).toEqual(["/ok"]);
  });
});

describe("sign-out", () => {
  it("wipes the active bucket on a deliberate sign-out", () => {
    resolveActiveUser("user-a");
    togglePin(page("/a"));
    window.dispatchEvent(new CustomEvent(SIGNING_OUT_EVENT));
    // Bucket gone, and the pointer cleared so the next person resolves afresh.
    expect(localStorage.getItem("one-wso2.pinned.v1.user-a")).toBeNull();
    expect(localStorage.getItem("one-wso2.pinned.v1.lastUserKey")).toBeNull();
  });
});
