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


import { useEffect, useState } from "react";

// The clock the deadline predicates are asked against.
//
// One hook owns it, so no component reads `new Date()` on its own — the same
// arrangement the cafeteria screen uses, and for the same reason: two
// components sampling the clock separately can disagree about which side of a
// boundary they are on, and render a locked panel next to an editable one.
//
// PAR's deadlines are dates, not times, and are inclusive of the whole day. So
// the only moment the answer changes is local midnight, and that is the only
// time this re-renders. Sampling once at mount would leave a tab open overnight
// still offering to edit a PAR whose deadline passed hours ago.

function msUntilNextMidnight(now: Date): number {
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  // At least a second, so a clock landing exactly on midnight cannot spin.
  return Math.max(next.getTime() - now.getTime(), 1_000);
}

export function useParNow(): Date {
  const [now, setNow] = useState(() => new Date());

  // Derived during render so the effect depends on a number rather than on a
  // Date rebuilt every render. Advancing `now` recomputes it, which re-arms the
  // timer for the following midnight.
  const delayMs = msUntilNextMidnight(now);

  useEffect(() => {
    const timer = window.setTimeout(() => setNow(new Date()), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs]);

  useEffect(() => {
    // A backgrounded tab has its timers throttled or suspended, so midnight can
    // pass unnoticed. Resync whenever the tab comes back into view.
    const onVisible = () => {
      if (document.visibilityState === "visible") setNow(new Date());
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  return now;
}
