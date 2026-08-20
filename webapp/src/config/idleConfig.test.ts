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
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TIMEOUT_MINUTES, WARNING_MINUTES } from "@config/idleConfig";

// idleConfig resolves at module load, so each case needs a fresh import against
// its own window.config.
async function loadWith(config: Record<string, unknown> | undefined) {
  vi.resetModules();
  (window as unknown as { config?: Record<string, unknown> }).config = config;
  return (await import("@config/idleConfig")).idleConfig;
}

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  warn.mockRestore();
  delete (window as unknown as { config?: unknown }).config;
});

describe("timings, which do not depend on the flag", () => {
  it("puts the dialog at 25 minutes and the deadline at 30", async () => {
    expect(TIMEOUT_MINUTES).toBe(30);
    expect(WARNING_MINUTES).toBe(5);
    for (const config of [undefined, { ONE_WSO2_IDLE_AUTO_SIGN_OUT: true }]) {
      const cfg = await loadWith(config);
      expect(cfg.timeoutMs).toBe(30 * 60_000);
      expect(cfg.promptBeforeMs).toBe(5 * 60_000);
      // The dialog appears here either way — only the consequence differs.
      expect(cfg.timeoutMs - cfg.promptBeforeMs).toBe(25 * 60_000);
    }
  });
});

describe("ONE_WSO2_IDLE_AUTO_SIGN_OUT", () => {
  it("defaults to off, so the dialog waits rather than signing out", async () => {
    expect((await loadWith(undefined)).autoSignOut).toBe(false);
    expect((await loadWith({})).autoSignOut).toBe(false);
  });

  it("enables sign-out at the deadline when set", async () => {
    const cfg = await loadWith({ ONE_WSO2_IDLE_AUTO_SIGN_OUT: true });
    expect(cfg.autoSignOut).toBe(true);
  });

  it("treats a non-boolean as off rather than truthy, and warns", async () => {
    // "false" is truthy under a loose check — the exact footgun this guards,
    // since config.js is hand-edited per deployment.
    const cfg = await loadWith({ ONE_WSO2_IDLE_AUTO_SIGN_OUT: "false" });
    expect(cfg.autoSignOut).toBe(false);
    expect(warn).toHaveBeenCalled();
  });

  it("does not enable it for a truthy non-boolean either", async () => {
    expect((await loadWith({ ONE_WSO2_IDLE_AUTO_SIGN_OUT: 1 })).autoSignOut).toBe(false);
  });
});
