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

import { beforeEach, describe, expect, it } from "vitest";
import {
  isFavouritable,
  readFavourites,
  toggleFavourite,
} from "@features/favourites/favouritesStore";
import { reachablePerspectives } from "@constants/perspectives";

const USER = "user-a";
const key = (sub: string) => `one-wso2.favourites.v1.${sub}`;

beforeEach(() => localStorage.clear());

describe("favourites", () => {
  it("starts with Me, which is where everyone's own things are", () => {
    // The waffle has no "For you" group any more, so without this there would be
    // no tile for Me at all on a first visit.
    expect(readFavourites(USER)).toEqual(["me"]);
  });

  it("appends after the default, so the row order stays stable as it grows", () => {
    expect(toggleFavourite(USER, "finance")).toEqual(["me", "finance"]);
    expect(toggleFavourite(USER, "people")).toEqual(["me", "finance", "people"]);
    expect(toggleFavourite(USER, "finance")).toEqual(["me", "people"]);
  });

  // Nothing stored and stored-but-empty have to mean different things, or the
  // tile a user just dismissed comes back on the next read.
  it("lets a user remove Me, and keeps it removed", () => {
    expect(toggleFavourite(USER, "me")).toEqual([]);
    expect(readFavourites(USER)).toEqual([]);
    expect(localStorage.getItem(key(USER))).toBe("[]");
  });

  it("persists across reads", () => {
    toggleFavourite(USER, "finance");
    expect(readFavourites(USER)).toEqual(["me", "finance"]);
  });

  it("keeps users apart", () => {
    toggleFavourite(USER, "finance");
    expect(readFavourites("user-b")).toEqual(["me"]);
    expect(readFavourites(USER)).toEqual(["me", "finance"]);
  });

  it("does nothing without a signed-in subject", () => {
    // No subject means nowhere to store a choice, so there is no default to
    // offer either — the waffle has no one to show it to.
    expect(toggleFavourite(undefined, "finance")).toEqual([]);
    expect(readFavourites(undefined)).toEqual([]);
  });

  it("refuses perspectives that cannot be opened", () => {
    // Locked placeholders have no route; a favourite pointing at one would be a
    // shortcut to a dead end.
    expect(isFavouritable("csm")).toBe(false);
    expect(toggleFavourite(USER, "csm")).toEqual(["me"]);
  });

  it("drops unknown keys on read rather than rendering a broken tile", () => {
    localStorage.setItem(key(USER), JSON.stringify(["finance", "retired", "csm"]));
    expect(readFavourites(USER)).toEqual(["finance"]);
  });

  it("de-duplicates a hand-edited list", () => {
    localStorage.setItem(key(USER), JSON.stringify(["me", "me", "finance"]));
    expect(readFavourites(USER)).toEqual(["me", "finance"]);
  });

  it("falls back to the default on corrupt storage, not to nothing", () => {
    // Unreadable storage says nothing about what the user chose, so treat it
    // like a first visit rather than like a deliberately emptied list.
    localStorage.setItem(key(USER), "not json");
    expect(readFavourites(USER)).toEqual(["me"]);
    localStorage.setItem(key(USER), JSON.stringify({ finance: true }));
    expect(readFavourites(USER)).toEqual(["me"]);
  });

  it("does not share the pinned store's budget", () => {
    // The whole reason this is a separate store: favouriting apps must not eat
    // the eight-slot allowance for pinning pages. Derived from the registry
    // rather than hardcoded — the count is not what the test is about.
    const keys = reachablePerspectives().map((p) => p.key);
    for (const k of keys) {
      if (!readFavourites(USER).includes(k)) toggleFavourite(USER, k);
    }
    expect(readFavourites(USER)).toHaveLength(keys.length);
    expect(localStorage.getItem("one-wso2.pinned.v1.user-a")).toBeNull();
  });
});
