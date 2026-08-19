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
import { idleConfig } from "@config/idleConfig";
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
 * Replaces the hand-rolled `useIdleLogout`, which signed the user out with no
 * warning and had two defects worth naming:
 *
 *  - **Background tabs signed you out.** Activity listeners are per-window but
 *    `signOut()` ends the Asgardeo session globally, so a second tab left open
 *    while you worked in the first would hit its own deadline and log you out
 *    of both. `crossTab` + `syncTimers` makes every tab share one deadline, and
 *    activity in any tab resets it.
 *  - **It re-armed a `setTimeout` on every `mousemove`.** Now throttled.
 *
 * Modelled on csm-portal's `IdleTimeoutProvider`, but `onIdle` is wired here.
 * csm-portal carries a TODO noting that its dialog only prompts and its session
 * is never actually terminated — which would fail ONEWSO2-R1 for this app.
 */
export default function IdleTimeoutProvider({
  children,
}: IdleTimeoutProviderProps): JSX.Element {
  const { isSignedIn } = useAsgardeo();
  const secureSignOut = useSecureSignOut();
  const [promptOpen, setPromptOpen] = useState(false);
  // Explicit <number>: idleConfig is `as const`, so the initial value would
  // otherwise narrow the state type to the literal 5.
  const [remainingMinutes, setRemainingMinutes] = useState<number>(idleConfig.warningMinutes);

  // Guards against a double sign-out: `onIdle` can coincide with the user
  // clicking "Sign out" as the countdown expires.
  const signingOutRef = useRef(false);

  const signOutOnce = useCallback(() => {
    if (signingOutRef.current) return;
    signingOutRef.current = true;
    setPromptOpen(false);
    secureSignOut();
  }, [secureSignOut]);

  const { activate, getRemainingTime, isPrompted } = useIdleTimer({
    timeout: idleConfig.timeoutMs,
    promptBeforeIdle: idleConfig.promptBeforeMs,
    throttle: idleConfig.throttleMs,
    // One shared deadline across every tab in this browser profile, so an idle
    // background tab can no longer end an active session.
    crossTab: true,
    syncTimers: idleConfig.crossTabSyncMs,
    leaderElection: true,
    // Only run the timer for a signed-in user: no point counting down on the
    // sign-in redirect, and `disabled` stops the listeners entirely.
    disabled: !isSignedIn,
    onPrompt: () => {
      setRemainingMinutes(toMinutes(getRemainingTime()));
      setPromptOpen(true);
    },
    onIdle: () => {
      // The half csm-portal leaves unimplemented.
      if (isSignedIn) signOutOnce();
    },
    // Fires when activity resumes in ANY tab, including via a cross-tab
    // message — so answering the prompt in one tab dismisses it in the others.
    onActive: () => setPromptOpen(false),
  });

  // No effect needed to hide the prompt on sign-out: the dialog's own `open`
  // is gated on `isSignedIn` below, so a session ending elsewhere takes it off
  // screen without a second piece of state to keep in sync.

  // Keep the figure current while the dialog is open. Doubles as a safety net:
  // a tab suspended past its deadline won't have fired `onIdle` on time, so a
  // zero here ends the session on the next poll.
  useEffect(() => {
    if (!promptOpen) return;
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
        open={promptOpen && isSignedIn && isPrompted()}
        remainingMinutes={remainingMinutes}
        onContinue={handleContinue}
        onLogout={signOutOnce}
      />
      {children}
    </>
  );
}
