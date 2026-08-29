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
  deploymentLandingKey,
  isLandingKey,
  landingOptions,
  landingPath,
  landingPathFor,
  landingPreference,
  setLandingPreference,
} from "@config/landingConfig";
import { PERSPECTIVES, reachablePerspectives } from "@constants/perspectives";

function setConfig(value: unknown): void {
  (window as { config?: Record<string, unknown> }).config = {
    ONE_WSO2_DEFAULT_PERSPECTIVE: value,
  };
}

beforeEach(() => {
  delete (window as { config?: unknown }).config;
  localStorage.clear();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("landing options", () => {
  it("offers only perspectives that are built and routable", () => {
    for (const o of landingOptions()) {
      const def = PERSPECTIVES.find((p) => p.key === o.key);
      expect(def?.access).toBe(true);
      expect(o.path.startsWith("/")).toBe(true);
    }
  });

  it("excludes the locked placeholders", () => {
    const keys = landingOptions().map((o) => o.key);
    // These are registry entries with access: false — reachable one day, not now.
    for (const locked of ["csm", "revops", "legal", "business", "customer"]) {
      expect(keys, `"${locked}" should not be landable`).not.toContain(locked);
    }
  });

  it("always includes Me, which is the fallback", () => {
    expect(landingOptions().map((o) => o.key)).toContain("me");
  });

  it("excludes perspectives gated by another backend", () => {
    // Routable, but not usable by everyone. Landing is the one place a user
    // arrives without choosing to, so being dropped on an authorization notice
    // at login would read as the app being broken.
    expect(landingOptions().map((o) => o.key)).not.toContain("marketing");
  });

  it("still counts those as reachable, for surfaces the user drives", () => {
    // The rail, launcher and favourites should keep offering them — there the
    // gate's own message is the right answer to a deliberate click.
    expect(reachablePerspectives().map((p) => p.key)).toContain("marketing");
  });
});

describe("landingPath", () => {
  it("defaults to Me when nothing is configured", () => {
    expect(landingPath()).toBe("/me");
  });

  it("honours a valid perspective key", () => {
    setConfig("people");
    expect(landingPath()).toBe("/people-ops");
  });

  it("falls back and warns on an unknown key", () => {
    setConfig("nowhere");
    expect(landingPath()).toBe("/me");
    expect(console.warn).toHaveBeenCalled();
  });

  it("refuses an externally gated perspective, in config or from a user", () => {
    setConfig("marketing");
    expect(landingPath()).toBe("/me");
    expect(console.warn).toHaveBeenCalled();

    setLandingPreference("marketing");
    expect(landingPreference()).toBeUndefined();
  });

  it("falls back on a locked perspective rather than stranding the user", () => {
    // "csm" exists in the registry but has no route yet, so landing there would
    // hit the catch-all and bounce.
    setConfig("csm");
    expect(landingPath()).toBe("/me");
    expect(console.warn).toHaveBeenCalled();
  });

  it("falls back on a non-string without throwing", () => {
    setConfig(42);
    expect(landingPath()).toBe("/me");
  });

  it("stays quiet when the key is absent rather than wrong", () => {
    // An unset optional setting is not a misconfiguration, so it must not warn.
    (window as { config?: Record<string, unknown> }).config = {};
    expect(landingPath()).toBe("/me");
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("never resolves to the index itself", () => {
    // "/" would make the index route redirect to itself forever.
    for (const o of landingOptions()) {
      expect(landingPathFor(o.key)).not.toBe("/");
    }
    expect(landingPathFor(undefined)).not.toBe("/");
  });
});

describe("isLandingKey", () => {
  it("accepts landable keys and rejects everything else", () => {
    expect(isLandingKey("me")).toBe(true);
    expect(isLandingKey("csm")).toBe(false);
    expect(isLandingKey("")).toBe(false);
    expect(isLandingKey(undefined)).toBe(false);
    expect(isLandingKey({ key: "me" })).toBe(false);
  });
});

describe("per-user preference", () => {
  it("is absent until the user chooses", () => {
    expect(landingPreference()).toBeUndefined();
  });

  it("overrides the deployment default", () => {
    setConfig("people");
    setLandingPreference("finance");
    expect(landingPath()).toBe("/finance");
  });

  it("clearing it returns the user to the deployment default", () => {
    setConfig("people");
    setLandingPreference("finance");
    setLandingPreference(undefined);
    expect(landingPreference()).toBeUndefined();
    expect(landingPath()).toBe("/people-ops");
  });

  it("keeps following the deployment when the deployment default changes", () => {
    // The reason "no preference" is stored as absence rather than as the
    // resolved key: a user who never chose should move when the default moves.
    setConfig("people");
    expect(landingPath()).toBe("/people-ops");
    setConfig("finance");
    expect(landingPath()).toBe("/finance");
  });

  it("pins a user who chose explicitly, even to the same perspective", () => {
    setConfig("people");
    setLandingPreference("people");
    setConfig("finance");
    expect(landingPath()).toBe("/people-ops");
  });

  it("ignores a stored value that is not landable", () => {
    localStorage.setItem("one-wso2.landing", "csm");
    expect(landingPreference()).toBeUndefined();
    expect(landingPath()).toBe("/me");
  });

  it("refuses to store an unlandable key", () => {
    setLandingPreference("csm");
    expect(landingPreference()).toBeUndefined();
  });

  it("reports the deployment key separately from the resolved path", () => {
    setConfig("people");
    setLandingPreference("finance");
    // The settings page shows the deployment default in its helper text, so it
    // has to stay readable even while a user override is in effect.
    expect(deploymentLandingKey()).toBe("people");
    expect(landingPath()).toBe("/finance");
  });
});
