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

// Vitest global setup, referenced from vite.config.ts.
//
// `jest-dom/vitest` registers the DOM matchers (toBeInTheDocument and friends).
// Everything else a suite needs is mocked per-file — notably `window.config`,
// which `@config/apiConfig` and `@config/authConfig` read at module load and
// which does not exist under jsdom.
// Run the suite in a timezone that is hostile to the commonest date bug in
// this codebase: reading a calendar date out of `toISOString()` (UTC) while the
// code under test builds it from local fields, or the reverse. The two agree
// for most of the day and disagree near midnight, so on a UTC runner such a bug
// passes CI and fails only for whoever is in the wrong place at the wrong hour.
//
// America/Los_Angeles is a negative offset that also observes DST, so both the
// offset and the transition are exercised. Individual suites that care about a
// specific instant freeze the clock as well — the offset alone is not enough,
// because the mismatch only exists between 00:00 UTC and local midnight.
//
// Override with `TZ=... npm test` to reproduce something zone-specific.
if (!process.env.TZ) process.env.TZ = "America/Los_Angeles";

import "@testing-library/jest-dom/vitest";

// Guarantee a working `localStorage`, whatever Node the suite runs on.
//
// Node 25 ships its own `localStorage` global — an empty object with no methods
// unless web storage is fully enabled — and it shadows the one jsdom installs.
// The result is `localStorage.setItem is not a function`, which looks like a bug
// in the code under test rather than an environment mismatch. The repo pins Node
// 22 (.nvmrc), where jsdom's own implementation is used and this shim is inert,
// but CI or a developer on a newer runtime shouldn't see 16 confusing failures.
//
// Deliberately a real implementation rather than a `vi.fn()` mock: these suites
// assert on round-tripped values and cross-key isolation, so they need storage
// that actually stores.
if (typeof localStorage === "undefined" || typeof localStorage.setItem !== "function") {
  const store = new Map<string, string>();
  const shim: Storage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key) => (store.has(key) ? (store.get(key) as string) : null),
    key: (index) => [...store.keys()][index] ?? null,
    removeItem: (key) => void store.delete(key),
    setItem: (key, value) => void store.set(String(key), String(value)),
  };
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: shim,
  });
}
