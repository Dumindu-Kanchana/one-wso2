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

import { useCallback, useEffect, useRef, useState, type JSX, type ReactNode } from "react";
import { useIdleTimer } from "react-idle-timer";
import { useAsgardeo } from "@asgardeo/react";
import SessionWarningDialog from "@components/session-warning/SessionWarningDialog";
import { idleConfig, WARNING_MINUTES } from "@config/idleConfig";
import { useSecureSignOut } from "@hooks/useSecureSignOut";

/**
 * How often the remaining-minutes figure is recomputed while the prompt is up.
 * The dialog only shows whole minutes, so a per-second tick would re-render 30x
 * for nothing; 30s is well inside one minute of granularity.
 */
const REMAINING_POLL_MS = 30_000;

/** Whole minutes left, rounded up so the final partial minute reads as 1, not 0. */
function toMinutes(ms: number): number {
  return Math.max(0, Math.ceil(ms / 60_000));
}

interface IdleTimeoutProviderProps {
  children: ReactNode;
}

/**
 * Idle-session handling: warn first, then sign out.
 *
 * Two properties are deliberate, and both were bugs in the hand-rolled timer
 * this replaced:
 *
 *  - **One deadline shared across tabs.** Activity listeners are per-window but
 *    `signOut()` ends the Asgardeo session globally, so per-tab timers meant a
 *    background tab could log you out of the tab you were working in.
 *    `crossTab` + `syncTimers` gives every tab one deadline that any tab's
 *    activity resets.
 *  - **Throttled activity handling**, rather than re-arming a timer on every
 *    single `mousemove`.
 *
 * The timer and the dialog always run: WARNING_MINUTES before the deadline the
 * dialog appears and waits. `ONE_WSO2_IDLE_AUTO_SIGN_OUT` decides only what
 * happens when it is ignored — nothing, the default, or sign-out at the
 * deadline. See idleConfig.ts for why that default is off.
 */
export default function IdleTimeoutProvider({
  children,
}: IdleTimeoutProviderProps): JSX.Element {
  const { isSignedIn } = useAsgardeo();
  const secureSignOut = useSecureSignOut();
  const [promptOpen, setPromptOpen] = useState(false);
  // Explicit <number>: WARNING_MINUTES is a literal, so the initial value would
  // otherwise narrow the state type to 5.
  const [remainingMinutes, setRemainingMinutes] = useState<number>(WARNING_MINUTES);

  // Guards against a double sign-out: `onIdle` can coincide with the user
  // clicking "Sign out" as the countdown expires.
  const signingOutRef = useRef(false);

  const signOutOnce = useCallback(() => {
    if (signingOutRef.current) return;
    signingOutRef.current = true;
    setPromptOpen(false);
    secureSignOut();
  }, [secureSignOut]);

  const { activate, getRemainingTime } = useIdleTimer({
    timeout: idleConfig.timeoutMs,
    promptBeforeIdle: idleConfig.promptBeforeMs,
    throttle: idleConfig.throttleMs,
    // One shared deadline across every tab in this browser profile, so an idle
    // background tab can no longer end an active session.
    crossTab: true,
    syncTimers: idleConfig.crossTabSyncMs,
    leaderElection: true,
    // Runs for any signed-in user regardless of the sign-out flag, since the
    // dialog is raised either way. `disabled` stops the activity listeners
    // entirely rather than just ignoring their results.
    disabled: !isSignedIn,
    onPrompt: () => {
      setRemainingMinutes(toMinutes(getRemainingTime()));
      setPromptOpen(true);
    },
    onIdle: () => {
      // The flag's only consequence. Without it the dialog simply stays up.
      if (isSignedIn && idleConfig.autoSignOut) signOutOnce();
    },
    // Deliberately NO onActive handler. It would fire on the first mousemove —
    // including one over the dialog's own backdrop — and dismiss the prompt
    // before it could be read. Continue and Logout are the only ways out.
  });

  // No effect needed to hide the prompt on sign-out: the dialog's own `open`
  // is gated on `isSignedIn` below, so a session ending elsewhere takes it off
  // screen without a second piece of state to keep in sync.

  // Keep the figure current while the dialog is open. Doubles as a safety net:
  // a tab suspended past its deadline won't have fired `onIdle` on time, so a
  // zero here ends the session on the next poll.
  //
  // Only meaningful when there is a deadline to count down to — with sign-out
  // off there is no number on screen and nothing to enforce.
  useEffect(() => {
    if (!promptOpen || !idleConfig.autoSignOut) return;
    const id = window.setInterval(() => {
      const left = getRemainingTime();
      setRemainingMinutes(toMinutes(left));
      if (left <= 0) signOutOnce();
    }, REMAINING_POLL_MS);
    return () => window.clearInterval(id);
  }, [promptOpen, getRemainingTime, signOutOnce]);

  const handleContinue = () => {
    setPromptOpen(false);
    // Resets the shared deadline and broadcasts it to the other tabs.
    activate();
  };

  return (
    <>
      <SessionWarningDialog
        // Deliberately not gated on `isPrompted()`: with sign-out off, the
        // prompt window closes once the deadline passes, which would hide a
        // dialog that is meant to wait indefinitely.
        open={promptOpen && isSignedIn}
        // Omitted when nothing happens at the deadline, so the dialog drops its
        // countdown rather than promising a sign-out that never comes.
        remainingMinutes={idleConfig.autoSignOut ? remainingMinutes : undefined}
        onContinue={handleContinue}
        onLogout={signOutOnce}
      />
      {children}
    </>
  );
}
