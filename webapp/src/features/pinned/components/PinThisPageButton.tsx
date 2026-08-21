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

import { IconButton, Tooltip } from "@wso2/oxygen-ui";
import { PinIcon, PinOffIcon } from "@wso2/oxygen-ui-icons-react";
import type { JSX } from "react";
import { useAsgardeo } from "@asgardeo/react";
import { useLocation } from "react-router";
import { MAX_PINNED } from "@features/pinned/pinnedStore";
import { pinnableRoute } from "@features/pinned/pinnableRoute";
import { usePinnedEntries, useTogglePin } from "@features/pinned/usePinned";
import { useNotifications } from "@context/notifications/NotificationsContext";

/**
 * Pins the CURRENT route into the top-bar working set.
 *
 * Works on any route, not just registry-known ones — an unrecognised path gets a
 * humanized label rather than being unpinnable (see `pinnableRoute`).
 */
export default function PinThisPageButton(): JSX.Element | null {
  const { isSignedIn } = useAsgardeo();
  const location = useLocation();
  const pinned = usePinnedEntries();
  const toggle = useTogglePin();
  const { showWarning } = useNotifications();
  if (!isSignedIn) return null;

  const entry = pinnableRoute(location.pathname, location.search);
  const isPinned = pinned.some((e) => e.kind === entry.kind && e.id === entry.id);

  const onClick = () => {
    // No local state needed: the store fires its change event on a successful
    // write, which `usePinnedEntries` listens for, so the icon follows the list.
    if (toggle(entry) === "at-capacity") {
      // Say so rather than let the click look broken. The store refuses instead
      // of evicting, because every pin in the set was placed deliberately.
      showWarning(`You can pin up to ${MAX_PINNED} pages. Unpin one to make room.`);
    }
  };

  return (
    <Tooltip title={isPinned ? "Unpin this page" : "Pin this page to the top bar"}>
      <IconButton
        size="small"
        aria-label={isPinned ? "Unpin this page" : "Pin this page to the top bar"}
        aria-pressed={isPinned}
        onClick={onClick}
        // Pinned state carries the brand accent, kept AA-legible per scheme:
        // primary.dark on light, primary.main on dark. `palette.mode` is
        // unreliable under CssVars, hence applyStyles.
        sx={(t) => ({
          ...(isPinned
            ? {
                color: t.palette.primary.dark,
                ...t.applyStyles("dark", { color: t.palette.primary.main }),
              }
            : {}),
        })}
      >
        {isPinned ? <PinOffIcon size={18} /> : <PinIcon size={18} />}
      </IconButton>
    </Tooltip>
  );
}
