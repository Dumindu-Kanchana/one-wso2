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

// The one place in this feature that reads a clock.
//
// Every window rule is a pure function of a `now` that flows down as a prop, so
// this hook exists only to decide *when* to hand down a new one. It re-renders
// exactly at the next window boundary rather than polling: the standalone app
// re-checked every five minutes and so could be that far out of date at 16:00,
// showing a closed ordering form to someone who could already order.

import { useEffect, useState } from "react";
import { cafeteriaMoment } from "./menuTime";
import { nextBoundaryMs, type TimeWindow } from "./menuWindows";

export function useCafeteriaClock(windows: readonly TimeWindow[]): {
  now: Date;
  cafeteriaDate: string;
} {
  const [now, setNow] = useState(() => new Date());

  // Derived during render, so the effect depends on a number rather than on an
  // array the caller rebuilds every render. Advancing `now` recomputes it, which
  // re-arms the timer for the following boundary — no self-scheduling loop, and
  // nothing to keep in a ref.
  //
  // No padding added here. `nextBoundaryMs` already clamps its result to at
  // least a second, and that clamp — not a margin — is what stops a wake-up
  // landing a hair early from re-arming a near-zero timer repeatedly. Adding a
  // second on top only delayed every boundary flip by a second.
  const delayMs = nextBoundaryMs(now, windows);

  useEffect(() => {
    const timer = window.setTimeout(() => setNow(new Date()), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs]);

  useEffect(() => {
    // A backgrounded tab has its timers throttled or suspended, so a boundary
    // can pass unnoticed. Resync whenever the tab comes back into view.
    const onVisible = () => {
      if (document.visibilityState === "visible") setNow(new Date());
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  return { now, cafeteriaDate: cafeteriaMoment(now).dateIso };
}
