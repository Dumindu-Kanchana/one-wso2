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

import { useSyncExternalStore, type JSX } from "react";
import { getSessionExpiredSnapshot, subscribeSessionExpiry } from "@api/authBridge";
import { useSecureSignOut } from "@hooks/useSecureSignOut";
import SessionExpiredDialog from "./SessionExpiredDialog";

/**
 * Raises the session-expired dialog once @api/authBridge gives up on silent
 * renewal. Renders nothing otherwise.
 *
 * `useSyncExternalStore` rather than an effect mirroring the flag into state:
 * the bridge is plain module state shared by every caller, and an effect would
 * both trip the react-hooks lint rule and miss an update landing between render
 * and effect.
 *
 * The bridge only learns about failures that a real request provoked, so an
 * idle tab with no traffic will not raise this until the next request fails.
 * Probing the token's own expiry to cover that was considered and deliberately
 * left out: it decides a session is dead without any request having failed, and
 * a wrong guess signs out someone who was fine.
 */
export default function SessionExpiryWatcher(): JSX.Element {
  const expired = useSyncExternalStore(subscribeSessionExpiry, getSessionExpiredSnapshot);
  const secureSignOut = useSecureSignOut();

  // Reload, rather than calling the SDK's signIn().
  //
  // signIn() only redirects when the SDK agrees the session is gone; when it
  // still considers the user signed in it resolves immediately and navigates
  // nowhere. That is exactly the case this dialog is most likely to be wrong
  // about — a renewal can time out while the token is perfectly good — and it
  // left the button doing nothing at all, with no dismiss and no way out. A HAR
  // of it shows zero authorize requests and API calls returning 201 throughout,
  // until the user reloaded by hand.
  //
  // A reload is what that hand-reload did, and it recovers either way: the flag
  // is module state, so it clears; if the session really is gone, AuthGuard
  // takes over on the way back up and performs the redirect itself, stashing the
  // return path as it always does. The URL is unchanged, so the user lands back
  // on the page they were on without needing a stash here at all.
  const handleSignIn = () => {
    window.location.reload();
  };

  return (
    <SessionExpiredDialog open={expired} onSignIn={handleSignIn} onSignOut={secureSignOut} />
  );
}
