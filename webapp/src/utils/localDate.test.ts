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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { localIsoDate, localIsoDateOffset, localIsoMonth } from "./localDate";

// The zone the suite actually resolved to. `src/test/setup.ts` pins
// America/Los_Angeles, but `TZ=... npm test` overrides it to reproduce
// something zone-specific — and the assertions below are literals for the
// pinned zone, so they are skipped rather than left to fail confusingly.
const ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;
const IN_PINNED_ZONE = ZONE === "America/Los_Angeles";

// An instant just after midnight UTC is the previous evening in a negative
// offset. That is the whole point of these helpers, and the only window in
// which the bug they prevent is visible at all.
describe.skipIf(!IN_PINNED_ZONE)("near midnight UTC", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-08-31T02:00:00.000Z")); // 30 Aug, 19:00 PDT
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reports the local day, not the UTC one", () => {
    expect(localIsoDate()).toBe("2026-08-30");
    expect(new Date().toISOString().slice(0, 10)).toBe("2026-08-31"); // the trap
  });

  it("reports the local month, not the UTC one", () => {
    vi.setSystemTime(new Date("2026-09-01T02:00:00.000Z")); // 31 Aug locally
    expect(localIsoMonth()).toBe("2026-08");
    expect(new Date().toISOString().slice(0, 7)).toBe("2026-09"); // the trap
  });

  it("offsets from the local day", () => {
    expect(localIsoDateOffset(1)).toBe("2026-08-31");
    expect(localIsoDateOffset(-7)).toBe("2026-08-23");
  });
});

// True in every zone, so this is what guards the helper on a UTC runner.
describe("the invariant, in whatever zone this runs", () => {
  it("agrees with the local date fields, always", () => {
    for (const d of [new Date(), new Date(2026, 0, 1, 0, 30), new Date(2026, 11, 31, 23, 30)]) {
      expect(localIsoDate(d)).toBe(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
          d.getDate(),
        ).padStart(2, "0")}`,
      );
    }
  });

  it("round-trips a local date through an offset and back", () => {
    const start = new Date(2026, 5, 15, 9);
    expect(localIsoDateOffset(0, start)).toBe("2026-06-15");
    expect(localIsoDateOffset(30, start)).toBe("2026-07-15");
    expect(localIsoDateOffset(-30, start)).toBe("2026-05-16");
  });
});

describe("stepping across boundaries", () => {
  const at = (y: number, m: number, d: number) => new Date(y, m, d, 12);

  it("crosses a month end", () => {
    expect(localIsoDateOffset(1, at(2026, 0, 31))).toBe("2026-02-01");
  });

  it("crosses a year end", () => {
    expect(localIsoDateOffset(1, at(2026, 11, 31))).toBe("2027-01-01");
    expect(localIsoDateOffset(-1, at(2026, 0, 1))).toBe("2025-12-31");
  });

  it("pads single digits", () => {
    expect(localIsoDate(at(2026, 0, 5))).toBe("2026-01-05");
    expect(localIsoMonth(at(2026, 0, 5))).toBe("2026-01");
  });

  // PDT ends 02:00 on 1 Nov 2026, so that local day is 25 hours long. From
  // midnight, adding 86,400,000 ms lands at 23:00 the SAME day; stepping the
  // date field lands on the 2nd, which is what a calendar day means. Asserted
  // against the naive arithmetic so the test would fail if the helper regressed
  // to it.
  it.skipIf(!IN_PINNED_ZONE)("steps a calendar day across a DST transition", () => {
    const midnightBeforeFallBack = new Date(2026, 10, 1, 0);
    expect(localIsoDateOffset(1, midnightBeforeFallBack)).toBe("2026-11-02");
    expect(
      localIsoDate(new Date(midnightBeforeFallBack.getTime() + 86_400_000)),
    ).toBe("2026-11-01"); // what the naive version would have given
  });

  it("does not mutate the date it was given", () => {
    const d = at(2026, 5, 15);
    localIsoDateOffset(-30, d);
    expect(localIsoDate(d)).toBe("2026-06-15");
  });
});
