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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FAILURES_BEFORE_PROMPT,
  cooldownFor,
  getSessionExpiredSnapshot,
  refreshIdToken,
  registerAuthAccessors,
  resetAuthBridgeFailureState,
  subscribeSessionExpiry,
} from "@api/authBridge";

const signInSilently = vi.fn();

/**
 * A renewed session. Asgardeo resolves the basic-user-info object; the only
 * thing this module cares about is that it is truthy.
 */
const RENEWED = { sub: "someone@wso2.com" };

function register() {
  registerAuthAccessors({
    getIdToken: () => Promise.resolve("id-token"),
    getAccessToken: () => Promise.resolve("access-token"),
    signInSilently,
  });
}

beforeEach(() => {
  resetAuthBridgeFailureState();
  signInSilently.mockReset();
  register();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("cooldownFor", () => {
  it("is zero before anything has failed", () => {
    expect(cooldownFor(0)).toBe(0);
    expect(cooldownFor(-1)).toBe(0);
  });

  it("doubles per consecutive failure", () => {
    expect(cooldownFor(1)).toBe(5_000);
    expect(cooldownFor(2)).toBe(10_000);
    expect(cooldownFor(3)).toBe(20_000);
  });

  it("caps rather than growing without bound", () => {
    expect(cooldownFor(10)).toBe(60_000);
    expect(cooldownFor(100)).toBe(60_000);
  });
});

// The bug this whole module exists to fix: signInSilently RESOLVES FALSE on
// failure rather than rejecting. An earlier version of this breaker counted a
// settled promise as success, so it could never trip. These are the tests that
// version passed while being wrong.
describe("a renewal that resolves falsy is a failure", () => {
  it("rejects rather than handing back the dead token", async () => {
    signInSilently.mockResolvedValue(false);
    await expect(refreshIdToken()).rejects.toThrow(/did not renew/i);
  });

  it("counts toward the breaker", async () => {
    vi.useFakeTimers();
    signInSilently.mockResolvedValue(false);
    for (let i = 0; i < FAILURES_BEFORE_PROMPT; i++) {
      await expect(refreshIdToken()).rejects.toThrow();
      vi.advanceTimersByTime(cooldownFor(i + 1) + 1);
    }
    expect(getSessionExpiredSnapshot()).toBe(true);
  });

  it("treats undefined the same way — a settled promise is not success", async () => {
    signInSilently.mockResolvedValue(undefined);
    await expect(refreshIdToken()).rejects.toThrow(/did not renew/i);
  });

  it("accepts a real session object", async () => {
    signInSilently.mockResolvedValue(RENEWED);
    await expect(refreshIdToken()).resolves.toBe("id-token");
    expect(getSessionExpiredSnapshot()).toBe(false);
  });
});

describe("backoff", () => {
  it("refuses to call the SDK again inside the cooldown window", async () => {
    vi.useFakeTimers();
    signInSilently.mockResolvedValue(false);

    await expect(refreshIdToken()).rejects.toThrow(/did not renew/i);
    expect(signInSilently).toHaveBeenCalledTimes(1);

    // Still inside the 5s window: rejected without touching the network.
    vi.advanceTimersByTime(1_000);
    await expect(refreshIdToken()).rejects.toThrow(/backing off/i);
    expect(signInSilently).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(5_000);
    await expect(refreshIdToken()).rejects.toThrow(/did not renew/i);
    expect(signInSilently).toHaveBeenCalledTimes(2);
  });

  it("clears once a renewal succeeds", async () => {
    vi.useFakeTimers();
    signInSilently.mockResolvedValueOnce(false);
    await expect(refreshIdToken()).rejects.toThrow();

    vi.advanceTimersByTime(5_001);
    signInSilently.mockResolvedValue(RENEWED);
    await expect(refreshIdToken()).resolves.toBe("id-token");

    // Backoff reset: the very next call goes straight through.
    signInSilently.mockResolvedValueOnce(false);
    await expect(refreshIdToken()).rejects.toThrow(/did not renew/i);
    expect(signInSilently).toHaveBeenCalledTimes(3);
  });
});

describe("giving up", () => {
  it("stops calling the SDK entirely after three consecutive failures", async () => {
    vi.useFakeTimers();
    signInSilently.mockResolvedValue(false);

    for (let i = 0; i < FAILURES_BEFORE_PROMPT; i++) {
      await expect(refreshIdToken()).rejects.toThrow();
      vi.advanceTimersByTime(cooldownFor(i + 1) + 1);
    }
    expect(signInSilently).toHaveBeenCalledTimes(FAILURES_BEFORE_PROMPT);

    // However long we wait, and however many callers ask.
    vi.advanceTimersByTime(10 * 60_000);
    await expect(refreshIdToken()).rejects.toThrow(/full sign-in/i);
    await expect(refreshIdToken()).rejects.toThrow(/full sign-in/i);
    expect(signInSilently).toHaveBeenCalledTimes(FAILURES_BEFORE_PROMPT);
  });

  it("notifies subscribers once, not per failed request", async () => {
    vi.useFakeTimers();
    const listener = vi.fn();
    const unsubscribe = subscribeSessionExpiry(listener);
    signInSilently.mockResolvedValue(false);

    for (let i = 0; i < FAILURES_BEFORE_PROMPT; i++) {
      await expect(refreshIdToken()).rejects.toThrow();
      vi.advanceTimersByTime(cooldownFor(i + 1) + 1);
    }
    await expect(refreshIdToken()).rejects.toThrow();

    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("does not trip on failures separated by a success", async () => {
    // Two failures, a success, two more failures. Consecutive means consecutive.
    vi.useFakeTimers();
    const sequence = [false, false, RENEWED, false, false];
    for (const [i, value] of sequence.entries()) {
      signInSilently.mockResolvedValueOnce(value);
      await refreshIdToken().catch(() => undefined);
      vi.advanceTimersByTime(cooldownFor(i + 1) + 1);
    }
    expect(getSessionExpiredSnapshot()).toBe(false);
  });
});

describe("concurrent callers", () => {
  it("still dedup onto one attempt", async () => {
    signInSilently.mockResolvedValue(RENEWED);
    await Promise.all([refreshIdToken(), refreshIdToken(), refreshIdToken()]);
    expect(signInSilently).toHaveBeenCalledTimes(1);
  });

  it("count one failure between them, not three", async () => {
    signInSilently.mockResolvedValue(false);
    await Promise.allSettled([refreshIdToken(), refreshIdToken(), refreshIdToken()]);
    expect(signInSilently).toHaveBeenCalledTimes(1);
    expect(getSessionExpiredSnapshot()).toBe(false);
  });
});
