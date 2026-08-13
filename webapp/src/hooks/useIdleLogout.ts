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

import { useEffect, useRef } from "react";
import { useAsgardeo } from "@asgardeo/react";
import { useSecureSignOut } from "./useSecureSignOut";

// Sign the user out (clearing the cache) after `minutes` of no interaction.
// Previously the effective session window was only the Asgardeo token TTL
// with no idle enforcement (threat-model risk ONEWSO2-R1); the checklist
// wants an idle timeout under 30 minutes. Any of the activity events below
// resets the countdown.
const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
  "visibilitychange",
] as const;

export function useIdleLogout(minutes = 20): void {
  const { isSignedIn } = useAsgardeo();
  const secureSignOut = useSecureSignOut();
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!isSignedIn) return;
    const ms = minutes * 60_000;
    const reset = () => {
      if (timer.current !== undefined) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => secureSignOut(), ms);
    };
    for (const e of ACTIVITY_EVENTS) {
      window.addEventListener(e, reset, { passive: true });
    }
    reset();
    return () => {
      if (timer.current !== undefined) window.clearTimeout(timer.current);
      for (const e of ACTIVITY_EVENTS) window.removeEventListener(e, reset);
    };
  }, [isSignedIn, minutes, secureSignOut]);
}
