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
  refreshAccessToken,
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

// The backoff is unreachable while FAILURES_BEFORE_PROMPT is 1 — the first
// failure trips the breaker, and `sessionExpired` is checked before the
// cooldown. Its arithmetic is still tested above, because it is what bounds the
// damage if the threshold is ever raised again.
describe("after the first failure", () => {
  it("does not call the SDK a second time, whoever asks", async () => {
    vi.useFakeTimers();
    signInSilently.mockResolvedValue(false);

    await expect(refreshIdToken()).rejects.toThrow(/did not renew/i);
    expect(signInSilently).toHaveBeenCalledTimes(1);

    // Not "backing off" — given up. However long we wait.
    vi.advanceTimersByTime(10 * 60_000);
    await expect(refreshIdToken()).rejects.toThrow(/full sign-in/i);
    await expect(refreshAccessToken()).rejects.toThrow(/full sign-in/i);
    expect(signInSilently).toHaveBeenCalledTimes(1);
  });

  it("leaves a session alone that never failed", async () => {
    signInSilently.mockResolvedValue(RENEWED);
    await expect(refreshIdToken()).resolves.toBe("id-token");
    await expect(refreshIdToken()).resolves.toBe("id-token");
    expect(getSessionExpiredSnapshot()).toBe(false);
  });
});

describe("giving up", () => {
  it("trips on the very first failed renewal", async () => {
    signInSilently.mockResolvedValue(false);
    await expect(refreshIdToken()).rejects.toThrow(/did not renew/i);
    expect(getSessionExpiredSnapshot()).toBe(true);
    expect(signInSilently).toHaveBeenCalledTimes(FAILURES_BEFORE_PROMPT);
  });

  it("notifies subscribers once, not per failed request", async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSessionExpiry(listener);
    signInSilently.mockResolvedValue(false);

    await expect(refreshIdToken()).rejects.toThrow();
    await expect(refreshIdToken()).rejects.toThrow();
    await expect(refreshIdToken()).rejects.toThrow();

    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("is one-way — a later success cannot un-expire the page", async () => {
    signInSilently.mockResolvedValue(false);
    await expect(refreshIdToken()).rejects.toThrow();
    signInSilently.mockResolvedValue(RENEWED);
    await expect(refreshIdToken()).rejects.toThrow(/full sign-in/i);
    expect(getSessionExpiredSnapshot()).toBe(true);
  });
});

// The whole point of the line: this subsystem's failures cannot be reproduced
// locally, so the record has to survive into stage.
describe("what it leaves behind for whoever has to diagnose it", () => {
  it("says it gave up, once, when the breaker trips", async () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    signInSilently.mockResolvedValue(false);

    for (let i = 0; i < FAILURES_BEFORE_PROMPT; i++) {
      await expect(refreshIdToken()).rejects.toThrow();
      vi.advanceTimersByTime(cooldownFor(i + 1) + 1);
    }
    const lines = warn.mock.calls.map((c) => c.join(" "));
    expect(lines.filter((l) => l.includes("Gave up on silent re-auth"))).toHaveLength(1);
    expect(lines.join(" ")).toContain(String(FAILURES_BEFORE_PROMPT));

    // Further failures must not repeat it — one line per session, not per request.
    await expect(refreshIdToken()).rejects.toThrow();
    expect(warn.mock.calls.map((c) => c.join(" ")).filter((l) => l.includes("Gave up"))).toHaveLength(1);
    warn.mockRestore();
  });

  it("stays quiet while renewal is still working", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    signInSilently.mockResolvedValue(RENEWED);
    await refreshIdToken();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

// (b): once the dialog is up it owns the message. A page going to its error
// state as well would put an ErrorNotice — with a Retry that cannot help —
// behind the modal, one per feature, for a single dead session.
describe("what the pages see once the session is declared dead", () => {
  it("reports the session as expired to anything that asks", async () => {
    signInSilently.mockResolvedValue(false);
    expect(getSessionExpiredSnapshot()).toBe(false);
    await expect(refreshIdToken()).rejects.toThrow();
    expect(getSessionExpiredSnapshot()).toBe(true);
  });
});

describe("concurrent callers", () => {
  it("still dedup onto one attempt", async () => {
    signInSilently.mockResolvedValue(RENEWED);
    await Promise.all([refreshIdToken(), refreshIdToken(), refreshIdToken()]);
    expect(signInSilently).toHaveBeenCalledTimes(1);
  });

  it("share one failure between them rather than each minting an authorize", async () => {
    signInSilently.mockResolvedValue(false);
    await Promise.allSettled([refreshIdToken(), refreshIdToken(), refreshIdToken()]);
    expect(signInSilently).toHaveBeenCalledTimes(1);
  });
});
