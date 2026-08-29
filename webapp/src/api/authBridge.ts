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

// Bridges Asgardeo's session-renewal primitive into plain (non-React) code
// that only ever sees a token *string* per call and has no way to reach
// useAsgardeo() itself. A mount-only component (AuthBridgeMount, wired in
// AppWithConfig.tsx) registers the live getIdToken/getAccessToken/
// signInSilently once the SDK is ready.
//
// Two callers, two different tokens, one shared re-auth:
//   - @api/http's 401 → retry path calls refreshAccessToken() — every
//     backend call in this app authorizes with the access_token.
//   - @hooks/useAsgardeoSub's getDecodedIdToken() → retry path calls
//     refreshIdToken() — groups/email/sub are id_token-only claims,
//     unrelated to which token authorizes backend calls.
// Neither getIdToken() nor getAccessToken() checks expiry itself — both are
// plain storage reads — so once a token's lifetime passes, callers keep
// attaching the same dead value until something re-authenticates.
// signInSilently() is Asgardeo's cookie-based silent re-auth (the same
// mechanism people-app, leave-app, menu-app and visitor-app all lean on via
// their own AuthContext.tsx, just exposed under a different name in this
// SDK) — refreshing renews the whole session, so both token getters read
// fresh values off the same renewal.

type GetToken = () => Promise<string>;
type SignInSilently = () => Promise<unknown>;

// ---------------------------------------------------------------------------
// Failure memory
// ---------------------------------------------------------------------------
//
// Deduping concurrent callers is not enough on its own. `inFlightRefresh`
// clears the moment an attempt settles, so *sequential* 401s each start a
// brand-new silent re-auth — and once every backend is 401ing off the same
// dead token, they arrive continuously. A HAR taken while silent re-auth was
// broken recorded 19 authorize attempts in 3m04s, all carrying the same
// `state` (the flow never advanced), 17 authorization codes minted at
// Asgardeo, and zero token exchanges. Every attempt got a code and abandoned
// it.
//
// So the bridge remembers failures: back off between attempts, and after three
// consecutive ones stop trying altogether and let the UI ask the user to sign
// in. Silent renewal is the only thing that can fail here — a full-page sign-in
// still works, which is why a manual browser refresh always cleared this.

const BASE_COOLDOWN_MS = 5_000;
const MAX_COOLDOWN_MS = 60_000;

/**
 * Consecutive failures after which the session is declared unrenewable and the
 * user is asked to sign in. Three rather than one so a single transient blip
 * — a dropped connection, a slow gateway — costs a retry rather than a modal.
 */
export const FAILURES_BEFORE_PROMPT = 3;

/**
 * Whether an Asgardeo `signInSilently()` result means the session was renewed.
 *
 * It does NOT reject when silent renewal fails. Its iframe implementation is
 *
 *     setTimeout(() => resolve(false), 1e4)
 *
 * so a renewal that never comes back — a blocked iframe, a dead SSO session —
 * **resolves with `false` after ten seconds**. Treating any settled promise as
 * success (which is the obvious reading, and was this module's first mistake)
 * records those failures as successes: the failure counter resets every time,
 * the backoff never engages, and the breaker can never trip.
 *
 * Anything falsy is a failure. A real renewal resolves with the session's
 * basic-user-info object.
 */
function succeeded(result: unknown): boolean {
  return Boolean(result);
}

/**
 * How long to wait before the next attempt, given consecutive failures so far.
 *
 * Pure and exported for its own test: doubling arithmetic that silently caps
 * wrong is exactly the sort of thing that only shows up in a HAR six weeks
 * later.
 */
export function cooldownFor(consecutiveFailures: number): number {
  if (consecutiveFailures <= 0) return 0;
  return Math.min(BASE_COOLDOWN_MS * 2 ** (consecutiveFailures - 1), MAX_COOLDOWN_MS);
}

let consecutiveFailures = 0;
let cooldownUntil = 0;
let sessionExpired = false;
const sessionExpiryListeners = new Set<() => void>();

/**
 * Whether silent renewal has given up and the user has to sign in again.
 *
 * One-way for the lifetime of the page. Once it is set, `refreshSession`
 * refuses to start another attempt, so nothing can ever report the success
 * that would clear it — and that is deliberate rather than an oversight. The
 * recovery is a full-page sign-in, which reloads the app and resets this
 * module along with everything else. Letting it clear itself would also mean a
 * modal that vanishes mid-sentence while someone is reading it.
 *
 * Exposed as a subscribe/snapshot pair so React can read it through
 * `useSyncExternalStore` — a plain module boolean would never re-render, and
 * an effect mirroring it into state trips the react-hooks lint rule and can
 * miss an update that lands between render and effect.
 */
export function subscribeSessionExpiry(listener: () => void): () => void {
  sessionExpiryListeners.add(listener);
  return () => {
    sessionExpiryListeners.delete(listener);
  };
}

export function getSessionExpiredSnapshot(): boolean {
  return sessionExpired;
}

function giveUpOnSilentRenewal(): void {
  if (sessionExpired) return; // notify once, not per failed request
  sessionExpired = true;
  for (const listener of sessionExpiryListeners) listener();
}

function recordRefreshSuccess(): void {
  // Only the backoff state resets here. `sessionExpired` deliberately does not:
  // see the note on subscribeSessionExpiry for why it is one-way.
  consecutiveFailures = 0;
  cooldownUntil = 0;
}

function recordRefreshFailure(): void {
  consecutiveFailures += 1;
  cooldownUntil = Date.now() + cooldownFor(consecutiveFailures);
  if (consecutiveFailures >= FAILURES_BEFORE_PROMPT) giveUpOnSilentRenewal();
}

/** Test seam. Module state outlives a test file otherwise. */
export function resetAuthBridgeFailureState(): void {
  consecutiveFailures = 0;
  cooldownUntil = 0;
  sessionExpired = false;
}


let getIdTokenAccessor: GetToken | null = null;
let getAccessTokenAccessor: GetToken | null = null;
let signInSilentlyAccessor: SignInSilently | null = null;

// Resolves once registerAuthAccessors() has run at least once.
// AuthBridgeMount registers accessors from a useEffect, while a sibling
// subtree's request can kick off during the very same initial mount —
// React gives no ordering guarantee between the two, so a request's very
// first 401 could otherwise race ahead of registration. Awaiting this
// below (instead of failing outright when an accessor is still null) turns
// that race into a short wait: AuthBridgeMount always lives inside
// <AsgardeoProvider> in AppWithConfig.tsx, so this promise is guaranteed to
// resolve — just not necessarily before the first request lands.
let markReady: () => void;
const ready = new Promise<void>((resolve) => {
  markReady = resolve;
});

export function registerAuthAccessors(accessors: {
  getIdToken: GetToken;
  getAccessToken: GetToken;
  signInSilently: SignInSilently;
}): void {
  getIdTokenAccessor = accessors.getIdToken;
  getAccessTokenAccessor = accessors.getAccessToken;
  signInSilentlyAccessor = accessors.signInSilently;
  markReady();
}

// Dedup concurrent re-auth attempts — e.g. five cards all firing a request
// off the same stale token within milliseconds of each other, or a 401
// retry and an identity-decode retry landing at the same moment — into a
// single silent re-auth, shared regardless of which token the caller
// ultimately needs. Mirrors the _isRefreshing/_refreshPromise guard in
// people-app's APIService (utils/apiService.ts). Cleared as soon as the
// attempt settles (success or failure), so a later, independent failure
// starts a fresh attempt rather than replaying a stale result.
//
// inFlightRefresh is assigned synchronously (before the `await ready`
// inside the chain below) so two concurrent callers arriving before
// registration has happened still dedup onto the same promise, instead of
// each awaiting `ready` separately and racing to start their own refresh.
let inFlightRefresh: Promise<void> | null = null;

function refreshSession(): Promise<void> {
  if (inFlightRefresh) return inFlightRefresh;

  // Given up on: every further attempt would mint another authorization code
  // at Asgardeo and abandon it. The dialog is now the only way out, and it is a
  // full-page sign-in rather than an iframe.
  if (sessionExpired) {
    return Promise.reject(new Error("Session expired — a full sign-in is required."));
  }

  // Backing off. Callers already treat a failed refresh as "surface the
  // original 401", so this rejection changes nothing downstream except that it
  // costs no network.
  if (Date.now() < cooldownUntil) {
    return Promise.reject(
      new Error(`Silent re-auth is backing off after ${consecutiveFailures} failed attempts.`),
    );
  }

  inFlightRefresh = ready
    .then(() => {
      if (!signInSilentlyAccessor) throw new Error("Auth accessors not registered yet");
      return signInSilentlyAccessor();
    })
    .then((result) => {
      if (!succeeded(result)) {
        // Turned into a rejection so every caller's existing "refresh failed →
        // surface the original 401" path applies unchanged. Silently returning
        // would have callers attach the same dead token again.
        throw new Error("Silent re-auth did not renew the session.");
      }
      recordRefreshSuccess();
    })
    .catch((error: unknown) => {
      recordRefreshFailure();
      throw error;
    })
    .finally(() => {
      inFlightRefresh = null;
    });
  return inFlightRefresh;
}

export async function refreshAccessToken(): Promise<string> {
  await refreshSession();
  if (!getAccessTokenAccessor) throw new Error("Auth accessors not registered yet");
  const token = await getAccessTokenAccessor();
  if (!token) throw new Error("No access_token available from Asgardeo");
  return token;
}

export async function refreshIdToken(): Promise<string> {
  await refreshSession();
  if (!getIdTokenAccessor) throw new Error("Auth accessors not registered yet");
  const token = await getIdTokenAccessor();
  if (!token) throw new Error("No id_token available from Asgardeo");
  return token;
}
