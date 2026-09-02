/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

/**
 * Tour state, shared because three unrelated places need it: the offer card,
 * the profile menu's "Take the tour", and AppLayout, which has to open the
 * launcher and expand the rail while a step needs them.
 *
 * The provider owns no DOM. It reports what a step wants — `wantsLauncher` — and
 * lets AppLayout, which already owns the launcher anchor and the rail's
 * collapsed state, do it. Reaching into either from here would mean two owners
 * for one piece of state.
 */
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useAsgardeoSub } from "@hooks/useAsgardeoSub";
import { TOUR_STEPS, type TourStep } from "./tourSteps";
import { hasSeenTour, markTourSeen } from "./tourStore";
import { TourContext, type TourApi } from "./tourContext";

/**
 * A step is skippable when it names a target that is not on the page — a control
 * hidden at a narrow width, or a rail that has not rendered. Anchoring to a
 * missing element is how a tour ends up pointing at the corner of the screen.
 */
function stepIsReachable(step: TourStep | undefined): boolean {
  if (!step) return false;
  if (!step.selector) return true;
  return document.querySelector(step.selector) !== null;
}

/** The next index at or after `from` whose step can actually be shown. */
function nextReachable(from: number, direction: 1 | -1): number {
  for (let i = from; i >= 0 && i < TOUR_STEPS.length; i += direction) {
    if (stepIsReachable(TOUR_STEPS[i])) return i;
  }
  return -1;
}

export function TourProvider({ children }: { children: ReactNode }) {
  const { state } = useAsgardeoSub();
  const sub = state.status === "ready" ? state.sub : undefined;
  const [index, setIndex] = useState(-1);
  // Held in state rather than re-read each render so that answering the offer
  // takes effect immediately, without waiting for a storage round trip.
  const [seen, setSeen] = useState<boolean | undefined>(undefined);
  const resolvedSeen = seen ?? (sub ? hasSeenTour(sub) : true);

  const start = useCallback(() => setIndex(nextReachable(0, 1)), []);

  const stop = useCallback(() => {
    setIndex(-1);
    markTourSeen(sub);
    setSeen(true);
  }, [sub]);

  const next = useCallback(() => {
    setIndex((i) => nextReachable(i + 1, 1));
  }, []);

  const back = useCallback(() => {
    setIndex((i) => {
      const p = nextReachable(i - 1, -1);
      // Already at the first reachable step: stay put rather than closing.
      return p === -1 ? i : p;
    });
  }, []);

  const running = index >= 0 && index < TOUR_STEPS.length;
  const step = running ? TOUR_STEPS[index] : undefined;

  const api = useMemo<TourApi>(
    () => ({
      running,
      index,
      step,
      total: TOUR_STEPS.length,
      shouldOffer: Boolean(sub) && !resolvedSeen && index === -1,
      wantsLauncher: Boolean(step?.opensLauncher),
      start,
      next,
      back,
      finish: stop,
      decline: stop,
    }),
    [running, index, step, sub, resolvedSeen, start, next, back, stop],
  );

  return <TourContext.Provider value={api}>{children}</TourContext.Provider>;
}
