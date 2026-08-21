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

import { useAsgardeo } from "@asgardeo/react";
import { useEffect, useRef } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";
import { Box, CircularProgress } from "@wso2/oxygen-ui";
import { devBypassAuth } from "@config/authConfig";

const POST_LOGIN_KEY = "one_wso2_post_login_redirect";

/**
 * The `state` value Asgardeo echoes back to the post-logout redirect URI to
 * signal a completed sign-out. The SDK owns the constant internally
 * (`OIDCRequestConstants.Params.SIGN_OUT_SUCCESS`) but doesn't export it.
 */
const SIGN_OUT_SUCCESS = "sign_out_success";

/** True when the URL is Asgardeo's post-logout landing rather than a real route. */
function isSignOutLanding(search: string): boolean {
  return new URLSearchParams(search).get("state") === SIGN_OUT_SUCCESS;
}

/**
 * Whether a location is worth restoring after sign-in.
 *
 * Rejects IdP round-trip URLs. Storing one used to strand the app: after an
 * idle sign-out we'd save `/?state=sign_out_success` (the old check was only
 * `target !== "/"`, which that passes), replay it after login, and then never
 * leave it. `<Navigate to="/me">` on the index route fires once from an effect,
 * loses the race to this guard's own effect — child effects run first — and
 * won't retry, because its dependency is derived from the *pathname*, which
 * `/?state=…` leaves unchanged at `/`.
 */
function isRestorableTarget(pathname: string, search: string): boolean {
  if (pathname === "/") return false; // the index route already resolves this
  const params = new URLSearchParams(search);
  // Sign-in callback and error params belong to the SDK, not to us.
  if (params.has("code") || params.has("session_state") || params.has("error")) return false;
  return params.get("state") !== SIGN_OUT_SUCCESS;
}

// Wrap every authenticated route. If the user isn't signed in, stash the
// intended path so we can restore it after the Asgardeo redirect completes,
// then call signIn().
export default function AuthGuard() {
  const { isSignedIn, isLoading, signIn } = useAsgardeo();
  const location = useLocation();
  const navigate = useNavigate();
  // Prevents a second signIn() from firing under StrictMode's double-render
  // or on any incidental re-run of this effect before the browser has left
  // the page. Reset only when the SDK reports the user as signed in.
  const startedSignInRef = useRef(false);

  const currentHref = location.pathname + location.search + location.hash;

  // Read (don't consume) any stashed redirect so render can gate on it below.
  const pendingRedirect =
    isSignedIn && !isLoading ? sessionStorage.getItem(POST_LOGIN_KEY) : null;
  const hasPendingRedirect = pendingRedirect !== null && pendingRedirect !== currentHref;

  useEffect(() => {
    if (devBypassAuth) return; // dev-only: never redirect

    // Scrub Asgardeo's post-logout marker before anything else reasons about
    // the URL. Routed rather than `history.replaceState` so React Router's own
    // location stays in sync. Only ever matches the sign-OUT landing, so it
    // can't interfere with the sign-in callback the SDK still needs to read.
    if (isSignOutLanding(location.search)) {
      navigate(location.pathname, { replace: true });
      return;
    }

    if (isLoading) return;

    if (!isSignedIn) {
      if (startedSignInRef.current) return;
      startedSignInRef.current = true;
      if (isRestorableTarget(location.pathname, location.search)) {
        sessionStorage.setItem(POST_LOGIN_KEY, currentHref);
      }
      signIn();
      return;
    }

    // Signed in: consume any stashed redirect and let React Router own the
    // history stack so useNavigate()/Back behave predictably.
    startedSignInRef.current = false;
    const restored = sessionStorage.getItem(POST_LOGIN_KEY);
    if (!restored) return;
    sessionStorage.removeItem(POST_LOGIN_KEY);
    if (restored !== currentHref) {
      navigate(restored, { replace: true });
    }
  }, [isLoading, isSignedIn, location, currentHref, signIn, navigate]);

  if (devBypassAuth) return <Outlet />;

  // Hold the children back while a stashed redirect is still pending. Without
  // this the child route tree mounts first, its own redirects fire from child
  // effects, and this guard's effect then overrides them — the race described
  // on isRestorableTarget above.
  if (isLoading || !isSignedIn || hasPendingRedirect) {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return <Outlet />;
}
