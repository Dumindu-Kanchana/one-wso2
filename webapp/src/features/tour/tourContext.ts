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
 * The tour's shared state contract, and the hook that reads it.
 *
 * Split from the provider so each module exports one kind of thing: a file that
 * exports a component alongside a hook breaks fast refresh
 * (react-refresh/only-export-components) — the same split the app marks needed.
 */
import { createContext, useContext } from "react";
import type { TourStep } from "./tourSteps";

export interface TourApi {
  /** True while the tour is running. */
  running: boolean;
  /** Index into TOUR_STEPS, or -1 when not running. */
  index: number;
  step: TourStep | undefined;
  total: number;
  /** True when this user has never been offered the tour. */
  shouldOffer: boolean;
  /** The running step wants the app launcher open. */
  wantsLauncher: boolean;
  start: () => void;
  next: () => void;
  back: () => void;
  /** Ends the tour and records that the offer was answered. */
  finish: () => void;
  /** Answers the offer without running the tour. */
  decline: () => void;
}

export const TourContext = createContext<TourApi | undefined>(undefined);

/**
 * Throws when used outside the provider rather than handing back a no-op: a
 * silently dead "Take the tour" menu item is worse than a crash in development.
 */
export function useTour(): TourApi {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour must be used inside a TourProvider");
  return ctx;
}
