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
 * Renders nothing. Applies the two things a tour step needs the shell to do,
 * because the shell owns both and the tour should not reach into either.
 *
 *  - The app-menu step needs the launcher open. The launcher's open state IS its
 *    anchor element, so this hands it the button the step points at.
 *  - Steps point at rail rows, whose labels are hidden while the rail is
 *    collapsed. The rail is expanded for the duration and put back afterwards.
 *
 * `useAppShell` exposes only `toggleSidebar`, with no setter, so restoring means
 * remembering that we toggled rather than writing back a value. The ref makes
 * that survive re-renders without becoming state nothing renders from.
 */
import { useEffect, useRef } from "react";
import { useTour } from "./tourContext";

interface TourDriverProps {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setWaffleAnchor: (el: HTMLElement | null) => void;
  /**
   * Set true while a step needs the launcher open, so the launcher's own
   * click-away handler can decline to close it. The tour card is rendered
   * outside the launcher's popper, so every click on Next counted as a click
   * away — which closed the panel the next step was about to point into.
   */
  holdLauncher?: { current: boolean };
}

export default function TourDriver({
  sidebarCollapsed,
  toggleSidebar,
  setWaffleAnchor,
  holdLauncher,
}: TourDriverProps) {
  const { running, index, wantsLauncher } = useTour();
  const weExpandedRail = useRef(false);

  // Deliberately keyed on `running` alone. Depending on `sidebarCollapsed` would
  // re-run the moment we changed it and toggle straight back.
  useEffect(() => {
    if (running) {
      if (sidebarCollapsed && !weExpandedRail.current) {
        weExpandedRail.current = true;
        toggleSidebar();
      }
      return;
    }
    if (weExpandedRail.current) {
      weExpandedRail.current = false;
      toggleSidebar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  // Keyed on `index`, not just `wantsLauncher`. Two consecutive steps both want
  // the launcher, so the flag does not change between them and an effect watching
  // only the flag never re-runs — which is how the panel stayed shut for the
  // second of the two after a click on Next had closed it.
  useEffect(() => {
    if (holdLauncher) holdLauncher.current = running && wantsLauncher;
    if (!running) return;
    if (wantsLauncher) {
      const btn = document.querySelector<HTMLElement>('[data-tour="app-menu"]');
      // No button, no launcher: the step still reads as plain text.
      if (btn) setWaffleAnchor(btn);
    } else {
      setWaffleAnchor(null);
    }
  }, [running, index, wantsLauncher, setWaffleAnchor, holdLauncher]);

  // Leaving the tour must not leave the launcher hanging open.
  useEffect(() => {
    if (!running) return;
    return () => {
      if (holdLauncher) holdLauncher.current = false;
      setWaffleAnchor(null);
    };
  }, [running, setWaffleAnchor, holdLauncher]);

  return null;
}
