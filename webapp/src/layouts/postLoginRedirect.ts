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


// Where the user was before an interrupted sign-in, and the rule for whether a
// location is worth restoring afterwards.
//
// Split out of AuthGuard because two places now perform the same Asgardeo round
// trip for different reasons — AuthGuard for a user who isn't signed in, and
// SessionExpiryWatcher for a session that could not be renewed silently — and
// both have to stash by identical rules or the restore lands somewhere else.
// Keeping them here also means importing the rule doesn't drag in the runtime
// auth config that AuthGuard reads at module load.

/** sessionStorage key holding the href to return to after signing in. */
export const POST_LOGIN_KEY = "one_wso2_post_login_redirect";

// sessionStorage is not always there to be used. It throws on access under a
// storage-blocking policy or a sandboxed iframe, and setItem throws again on
// quota. Returning to the page you were on is a convenience; signing in is not,
// and neither is rendering the app. So every access is guarded, and a failure
// costs the return trip rather than the session.
//
// Guarded here rather than at each call site because there are three of them
// across two files, and the read in AuthGuard runs during render — a throw
// there takes down the whole app before it mounts.

/** Remember where to come back to. Silently does nothing if it cannot. */
export function rememberPostLoginTarget(href: string): void {
  try {
    sessionStorage.setItem(POST_LOGIN_KEY, href);
  } catch {
    // No return trip. The sign-in itself still has to happen.
  }
}

/** The remembered target, or null — including when storage cannot be read. */
export function readPostLoginTarget(): string | null {
  try {
    return sessionStorage.getItem(POST_LOGIN_KEY);
  } catch {
    return null;
  }
}

/** Forget it, so a later sign-in does not replay a stale target. */
export function forgetPostLoginTarget(): void {
  try {
    sessionStorage.removeItem(POST_LOGIN_KEY);
  } catch {
    // Nothing was stored if the write failed too.
  }
}

/**
 * The `state` value Asgardeo echoes back to the post-logout redirect URI to
 * signal a completed sign-out. The SDK owns the constant internally
 * (`OIDCRequestConstants.Params.SIGN_OUT_SUCCESS`) but doesn't export it.
 */
export const SIGN_OUT_SUCCESS = "sign_out_success";

/** True when the URL is Asgardeo's post-logout landing rather than a real route. */
export function isSignOutLanding(search: string): boolean {
  return new URLSearchParams(search).get("state") === SIGN_OUT_SUCCESS;
}

/**
 * Whether a location is worth restoring after sign-in.
 *
 * Rejects IdP round-trip URLs. Storing one used to strand the app: after an
 * idle sign-out we'd save `/?state=sign_out_success` (the old check was only
 * `target !== "/"`, which that passes), replay it after login, and then never
 * leave it. `<Navigate to="/me">` on the index route fires once from an effect,
 * loses the race to AuthGuard's own effect — child effects run first — and
 * won't retry, because its dependency is derived from the *pathname*, which
 * `/?state=…` leaves unchanged at `/`.
 */
export function isRestorableTarget(pathname: string, search: string): boolean {
  if (pathname === "/") return false; // the index route already resolves this
  const params = new URLSearchParams(search);
  // Sign-in callback and error params belong to the SDK, not to us.
  if (params.has("code") || params.has("session_state") || params.has("error")) return false;
  return params.get("state") !== SIGN_OUT_SUCCESS;
}
