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

import { beforeEach, describe, expect, it, vi } from "vitest";
import { forgetTourSeen, hasSeenTour, markTourSeen } from "./tourStore";

beforeEach(() => localStorage.clear());

describe("tour seen flag", () => {
  it("treats a user who has never been asked as unseen", () => {
    expect(hasSeenTour("user-a")).toBe(false);
  });

  it("remembers the answer per user, not per browser", () => {
    markTourSeen("user-a");
    expect(hasSeenTour("user-a")).toBe(true);
    // A colleague on the same browser profile still gets offered it.
    expect(hasSeenTour("user-b")).toBe(false);
  });

  /**
   * The offer is only worth making to someone whose answer we can record. With
   * no identity we would re-ask on every render and never be able to store the
   * reply, so unknown reads as seen.
   */
  it("stays quiet when identity has not resolved", () => {
    expect(hasSeenTour(undefined)).toBe(true);
    markTourSeen(undefined);
    expect(localStorage.length).toBe(0);
  });

  it("can put a user back into the first-visit state", () => {
    markTourSeen("user-a");
    forgetTourSeen("user-a");
    expect(hasSeenTour("user-a")).toBe(false);
  });

  /**
   * Blocked storage means we cannot record an answer either. Offering a tour on
   * every single page view is worse than never offering it, so it reads as seen.
   */
  it("stays quiet when storage throws", () => {
    const spy = vi.spyOn(localStorage, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(hasSeenTour("user-a")).toBe(true);
    spy.mockRestore();
  });

  it("does not throw when writing is blocked", () => {
    const spy = vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(() => markTourSeen("user-a")).not.toThrow();
    spy.mockRestore();
  });

  it("keys the flag under the app's own namespace", () => {
    markTourSeen("user-a");
    expect(localStorage.length).toBe(1);
    expect(localStorage.key(0)).toBe("one-wso2.tour.v1.user-a");
  });
});
