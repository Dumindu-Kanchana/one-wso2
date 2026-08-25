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

import { describe, expect, it } from "vitest";
import { cafeteriaMoment } from "./menuTime";
import {
  DINNER_WINDOW,
  FEEDBACK_WINDOW_FALLBACK,
  describeWindow,
  isDinnerOrderingOpen,
  isFeedbackOpen,
  nextBoundaryMs,
  windowFromMetaInfo,
  windowPhase,
} from "./menuWindows";

/** An instant expressed as IST wall-clock, built via the UTC equivalent. */
function ist(dateIso: string, hour: number, minute: number): Date {
  const [y, m, d] = dateIso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hour, minute) - 330 * 60_000);
}

describe("windowPhase", () => {
  const w = { startMinute: 720, endMinute: 975 }; // 12:00–16:15

  it("reports before, open and after around the edges", () => {
    expect(windowPhase({ dateIso: "2026-08-24", minuteOfDay: 719 }, w)).toBe("before");
    expect(windowPhase({ dateIso: "2026-08-24", minuteOfDay: 720 }, w)).toBe("open");
    expect(windowPhase({ dateIso: "2026-08-24", minuteOfDay: 800 }, w)).toBe("open");
    expect(windowPhase({ dateIso: "2026-08-24", minuteOfDay: 976 }, w)).toBe("after");
  });

  it("treats the end minute as inclusive, matching the backend", () => {
    expect(windowPhase({ dateIso: "2026-08-24", minuteOfDay: 975 }, w)).toBe("open");
  });
});

describe("isFeedbackOpen", () => {
  const w = FEEDBACK_WINDOW_FALLBACK;

  it("opens across the window on the menu's own date", () => {
    expect(isFeedbackOpen(ist("2026-08-24", 12, 0), "2026-08-24", w)).toBe(true);
    expect(isFeedbackOpen(ist("2026-08-24", 16, 15), "2026-08-24", w)).toBe(true);
  });

  it("closes outside the window", () => {
    expect(isFeedbackOpen(ist("2026-08-24", 11, 59), "2026-08-24", w)).toBe(false);
    expect(isFeedbackOpen(ist("2026-08-24", 16, 16), "2026-08-24", w)).toBe(false);
  });

  // The divergence this whole design exists to remove. A browser in UTC-5 shows
  // 23:00 on the 24th while the cafeteria is already at 09:30 on the 25th; the
  // standalone app compared against browser-local time and browser-local
  // "today", showed the form, and let the server refuse the submission.
  it("judges by the cafeteria's clock, not the browser's", () => {
    const lateOnThe24thInUtcMinus5 = new Date("2026-08-25T04:00:00Z"); // 09:30 IST on the 25th
    expect(cafeteriaMoment(lateOnThe24thInUtcMinus5).dateIso).toBe("2026-08-25");
    expect(isFeedbackOpen(lateOnThe24thInUtcMinus5, "2026-08-24", w)).toBe(false);
  });

  it("closes when the menu on display is not today's", () => {
    expect(isFeedbackOpen(ist("2026-08-25", 13, 0), "2026-08-24", w)).toBe(false);
  });

  it("accepts a slash-separated menu date as the same day", () => {
    expect(isFeedbackOpen(ist("2026-08-24", 13, 0), "2026/08/24", w)).toBe(true);
  });

  // Refusing outright would hide a working feature whenever someone typed the
  // spreadsheet date oddly; at worst the server declines and now says why.
  it("falls back to the time check alone when the menu date is unusable", () => {
    expect(isFeedbackOpen(ist("2026-08-24", 13, 0), "not a date", w)).toBe(true);
    expect(isFeedbackOpen(ist("2026-08-24", 20, 0), "not a date", w)).toBe(false);
    expect(isFeedbackOpen(ist("2026-08-24", 13, 0), null, w)).toBe(true);
  });
});

describe("isDinnerOrderingOpen", () => {
  it("runs 16:00 to 19:00 inclusive on the cafeteria clock", () => {
    expect(isDinnerOrderingOpen(ist("2026-08-24", 15, 59))).toBe(false);
    expect(isDinnerOrderingOpen(ist("2026-08-24", 16, 0))).toBe(true);
    expect(isDinnerOrderingOpen(ist("2026-08-24", 19, 0))).toBe(true);
    expect(isDinnerOrderingOpen(ist("2026-08-24", 19, 1))).toBe(false);
  });
});

describe("windowFromMetaInfo", () => {
  it("uses the server's configuration", () => {
    expect(
      windowFromMetaInfo({
        lunchFeedbackStartTime: { hour: 11, minute: 30 },
        lunchFeedbackEndTime: { hour: 15, minute: 0 },
      }),
    ).toEqual({ startMinute: 690, endMinute: 900 });
  });

  it("falls back rather than trusting an unusable configuration", () => {
    const fb = FEEDBACK_WINDOW_FALLBACK;
    expect(windowFromMetaInfo(undefined)).toEqual(fb);
    expect(
      windowFromMetaInfo({
        lunchFeedbackStartTime: { hour: 25, minute: 0 },
        lunchFeedbackEndTime: { hour: 16, minute: 15 },
      }),
    ).toEqual(fb);
    // start >= end would be a permanently shut window.
    expect(
      windowFromMetaInfo({
        lunchFeedbackStartTime: { hour: 17, minute: 0 },
        lunchFeedbackEndTime: { hour: 16, minute: 15 },
      }),
    ).toEqual(fb);
    expect(
      windowFromMetaInfo({
        lunchFeedbackStartTime: { hour: 12 } as { hour: number; minute: number },
        lunchFeedbackEndTime: { hour: 16, minute: 15 },
      }),
    ).toEqual(fb);
  });
});

describe("nextBoundaryMs", () => {
  const windows = [FEEDBACK_WINDOW_FALLBACK, DINNER_WINDOW];

  it("counts to the next boundary, not past it", () => {
    // 11:00 -> feedback opens at 12:00, an hour away.
    expect(nextBoundaryMs(ist("2026-08-24", 11, 0), windows)).toBe(60 * 60_000);
    // 16:10 -> the feedback window closes after 16:15, so 6 minutes to 16:16.
    expect(nextBoundaryMs(ist("2026-08-24", 16, 10), windows)).toBe(6 * 60_000);
  });

  it("standing on a boundary returns the next one, never zero", () => {
    expect(nextBoundaryMs(ist("2026-08-24", 16, 0), windows)).toBeGreaterThan(0);
    expect(nextBoundaryMs(ist("2026-08-24", 12, 0), windows)).toBeGreaterThan(0);
  });

  it("falls through to the day rollover once every window has passed", () => {
    // 19:30 -> nothing left today, so it waits for IST midnight.
    expect(nextBoundaryMs(ist("2026-08-24", 19, 30), windows)).toBe(4.5 * 60 * 60_000);
  });

  // A re-arming timer that ever got 0 would spin the event loop.
  it("is strictly positive at every minute of the day", () => {
    for (let minute = 0; minute < 1440; minute++) {
      const at = ist("2026-08-24", Math.floor(minute / 60), minute % 60);
      expect(nextBoundaryMs(at, windows)).toBeGreaterThan(0);
    }
  });
});

describe("describeWindow", () => {
  it("reads as a human time range", () => {
    expect(describeWindow(FEEDBACK_WINDOW_FALLBACK)).toBe("12:00 PM – 4:15 PM");
    expect(describeWindow(DINNER_WINDOW)).toBe("4:00 PM – 7:00 PM");
  });
});
