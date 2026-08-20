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

// Idle-session handling.
//
// The timer and the "still there?" dialog ALWAYS run: after 25 minutes of
// inactivity the dialog appears and waits to be answered. One config key,
// `ONE_WSO2_IDLE_AUTO_SIGN_OUT`, decides what happens if it is ignored:
//
//   off (default) — nothing. The dialog sits there until answered and the
//                   session survives, matching csm-portal.
//   on            — the session ends at the 30-minute mark.
//
// Note what "off" costs: it does not satisfy threat-model risk ONEWSO2-R1, which
// wants an idle timeout under 30 minutes. A dialog is not a timeout — it can be
// left unanswered indefinitely, with the page still on screen behind it.
// Deployments that need R1 must set the flag.

/** Total idle window. Reaching it signs the user out, if that is enabled. */
export const TIMEOUT_MINUTES = 30;

/**
 * How long before the deadline the dialog appears — so at 25 minutes idle.
 * Applies whether or not sign-out is enabled; the dialog is the same either way,
 * only its wording and its consequence differ.
 */
export const WARNING_MINUTES = 5;

/**
 * How often the activity listeners may fire, in ms. The hand-rolled timer this
 * replaced re-armed a `setTimeout` on every single `mousemove`; react-idle-timer
 * throttles instead.
 */
export const THROTTLE_MS = 500;

/** How often tabs reconcile their timers, in ms. */
export const CROSS_TAB_SYNC_MS = 2_000;

function resolveAutoSignOut(): boolean {
  const configured = window.config?.ONE_WSO2_IDLE_AUTO_SIGN_OUT;
  if (configured === undefined) return false;
  if (typeof configured !== "boolean") {
    // A loose check would read the string "false" as truthy and silently enable
    // sign-out for someone trying to disable it. config.js is hand-edited per
    // deployment, so this is a realistic mistake rather than a theoretical one.
    console.warn(
      `[idle] ONE_WSO2_IDLE_AUTO_SIGN_OUT must be a boolean, got ${typeof configured}. ` +
        `Treating it as false (dialog only, no sign-out).`,
    );
    return false;
  }
  return configured;
}

export const idleConfig = {
  /**
   * Whether ignoring the dialog ends the session. NOT a master switch — the
   * timer and dialog run regardless.
   */
  autoSignOut: resolveAutoSignOut(),
  /** Total idle window. */
  timeoutMs: TIMEOUT_MINUTES * 60_000,
  /** Portion of that window spent showing the dialog. */
  promptBeforeMs: WARNING_MINUTES * 60_000,
  throttleMs: THROTTLE_MS,
  crossTabSyncMs: CROSS_TAB_SYNC_MS,
} as const;
