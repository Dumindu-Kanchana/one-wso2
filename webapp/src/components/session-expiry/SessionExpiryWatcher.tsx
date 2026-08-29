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
import { useAsgardeo } from "@asgardeo/react";
import { useLocation } from "react-router";
import { getSessionExpiredSnapshot, subscribeSessionExpiry } from "@api/authBridge";
import { useSecureSignOut } from "@hooks/useSecureSignOut";
import { POST_LOGIN_KEY, isRestorableTarget } from "@layouts/postLoginRedirect";
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
  const { signIn } = useAsgardeo();
  const secureSignOut = useSecureSignOut();
  const location = useLocation();

  const handleSignIn = () => {
    // Same stash AuthGuard performs for an interrupted sign-in, so the round
    // trip returns the user to the page they were on rather than the landing
    // page. Its own effect consumes this once the SDK reports signed in.
    const href = location.pathname + location.search + location.hash;
    if (isRestorableTarget(location.pathname, location.search)) {
      sessionStorage.setItem(POST_LOGIN_KEY, href);
    }
    signIn();
  };

  return (
    <SessionExpiredDialog open={expired} onSignIn={handleSignIn} onSignOut={secureSignOut} />
  );
}
