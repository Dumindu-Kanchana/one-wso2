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

// Idle-session timings.
//
// The idle sign-out exists for threat-model risk ONEWSO2-R1: without it the
// effective session window is just the Asgardeo token TTL. The deadline is
// deployment-configurable via `window.config.ONE_WSO2_IDLE_TIMEOUT_MINUTES`,
// but bounded here rather than trusted blindly — a deployment can tighten the
// window, not opt out of it.

/** Deadline when the deployment doesn't configure one. */
export const DEFAULT_TIMEOUT_MINUTES = 20;

/** How long before the deadline the "still there?" dialog appears. */
export const WARNING_MINUTES = 5;

/**
 * Floor. The dialog needs to be on screen for its full warning window, so the
 * deadline has to exceed it — a 5-minute timeout would prompt at t=0.
 */
export const MIN_TIMEOUT_MINUTES = WARNING_MINUTES + 1;

/**
 * Ceiling, from ONEWSO2-R1: the security checklist wants an idle timeout under
 * 30 minutes, so a deployment can't widen the window past that.
 */
export const MAX_TIMEOUT_MINUTES = 30;

/**
 * How often the activity listeners may fire, in ms. The previous hand-rolled
 * timer re-armed a `setTimeout` on every single `mousemove`; react-idle-timer
 * throttles instead.
 */
export const THROTTLE_MS = 500;

/** How often tabs reconcile their timers, in ms. */
export const CROSS_TAB_SYNC_MS = 2_000;

function resolveTimeoutMinutes(): number {
  const configured = window.config?.ONE_WSO2_IDLE_TIMEOUT_MINUTES;
  if (configured === undefined) return DEFAULT_TIMEOUT_MINUTES;

  if (typeof configured !== "number" || !Number.isFinite(configured)) {
    console.warn(
      `[idle] ONE_WSO2_IDLE_TIMEOUT_MINUTES must be a number, got ${typeof configured}. ` +
        `Falling back to ${DEFAULT_TIMEOUT_MINUTES} minutes.`,
    );
    return DEFAULT_TIMEOUT_MINUTES;
  }

  const clamped = Math.min(Math.max(configured, MIN_TIMEOUT_MINUTES), MAX_TIMEOUT_MINUTES);
  if (clamped !== configured) {
    console.warn(
      `[idle] ONE_WSO2_IDLE_TIMEOUT_MINUTES=${configured} is outside the allowed ` +
        `${MIN_TIMEOUT_MINUTES}–${MAX_TIMEOUT_MINUTES} minute range (ONEWSO2-R1). ` +
        `Using ${clamped}.`,
    );
  }
  return clamped;
}

const timeoutMinutes = resolveTimeoutMinutes();

export const idleConfig = {
  /** Total idle time before sign-out. */
  timeoutMs: timeoutMinutes * 60_000,
  /** Portion of that window spent showing the warning dialog. */
  promptBeforeMs: WARNING_MINUTES * 60_000,
  throttleMs: THROTTLE_MS,
  crossTabSyncMs: CROSS_TAB_SYNC_MS,
  /** For copy — "signed out after N minutes of inactivity". */
  timeoutMinutes,
  warningMinutes: WARNING_MINUTES,
} as const;
