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

import { reachablePerspectives } from "@constants/perspectives";

/**
 * Which perspective the app opens on.
 *
 * `ONE_WSO2_DEFAULT_PERSPECTIVE` names a perspective key ("me", "people-ops",
 * ...) and the index route resolves it to that perspective's path. Anything
 * unusable falls back to Me, which is the one perspective every signed-in user
 * can always open.
 *
 * A DEPLOYMENT-WIDE setting, so pick a perspective the whole tenant can use.
 * Note that `access: true` in the registry only means "this perspective is
 * built" — it is not a per-user permission check. Marketing Ops in particular
 * gates its own contents against a separate backend's groups, so landing every
 * user there would show most of them an unauthorized state on login. Me,
 * People Ops, Finance and Workspace all render usefully for any signed-in user.
 */
const FALLBACK_KEY = "me";

/** Every perspective that could legitimately be configured as the landing page. */
export function landingOptions(): { key: string; label: string; path: string }[] {
  return reachablePerspectives().map((p) => ({
    key: p.key,
    label: p.label,
    path: p.path as string,
  }));
}

/**
 * True when `key` names a perspective that can be landed on. A type predicate so
 * callers narrow away `null` from localStorage and `unknown` from window.config.
 */
export function isLandingKey(value: unknown): value is string {
  if (typeof value !== "string") return false;
  return landingOptions().some((o) => o.key === value);
}

/**
 * Resolve a perspective key to the path to land on, falling back to Me.
 *
 * Separate from `landingPath()` so a user-level preference can reuse the same
 * validation without going through `window.config`.
 */
export function landingPathFor(key: string | undefined): string {
  const match = landingOptions().find((o) => o.key === key);
  if (match) return match.path;
  const fallback = landingOptions().find((o) => o.key === FALLBACK_KEY);
  // If even Me were unlandable the registry would be broken, but returning "/"
  // here would make the index route redirect to itself forever.
  return fallback?.path ?? "/me";
}

/**
 * The deployment's configured landing key, or the fallback.
 *
 * Read per call rather than resolved at module load: `window.config` is fetched
 * before the app mounts, and a module-level constant would bake in whatever was
 * there at import time.
 */
export function deploymentLandingKey(): string {
  const configured = window.config?.ONE_WSO2_DEFAULT_PERSPECTIVE;
  if (configured !== undefined && !isLandingKey(configured)) {
    // Worth saying out loud: a typo here silently changes where everyone lands,
    // and the fallback would otherwise look like the setting being ignored.
    console.warn(
      `[landing] ONE_WSO2_DEFAULT_PERSPECTIVE="${String(configured)}" is not a ` +
        `perspective that can be landed on. Falling back to "${FALLBACK_KEY}". ` +
        `Valid keys: ${landingOptions()
          .map((o) => o.key)
          .join(", ")}.`,
    );
  }
  return isLandingKey(configured) ? configured : FALLBACK_KEY;
}

/** Namespaced like the app's other browser-stored keys. */
const STORAGE_KEY = "one-wso2.landing";

/**
 * The user's own landing choice, or undefined when they have not made one.
 *
 * Undefined is meaningful and distinct from "me": it means follow the
 * deployment default, so changing that default still moves this user. Storing
 * the resolved key instead would silently pin them to today's default forever.
 *
 * Validated on read — localStorage is user-editable, and a perspective can stop
 * being landable between releases.
 */
export function landingPreference(): string | undefined {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return isLandingKey(saved) ? saved : undefined;
  } catch {
    return undefined;
  }
}

/** Save a landing choice, or clear it with `undefined` to follow the deployment. */
export function setLandingPreference(key: string | undefined): void {
  try {
    if (key === undefined) localStorage.removeItem(STORAGE_KEY);
    else if (isLandingKey(key)) localStorage.setItem(STORAGE_KEY, key);
  } catch {
    // Private browsing and quota failures land here. The choice is lost, which
    // is better than throwing out of a settings form.
  }
}

/**
 * Where the app opens: the user's choice if they made one, otherwise the
 * deployment default, otherwise Me.
 */
export function landingPath(): string {
  return landingPathFor(landingPreference() ?? deploymentLandingKey());
}
