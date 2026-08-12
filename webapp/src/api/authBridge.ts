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

// Bridges Asgardeo's session-renewal primitive into @api/http, which is
// plain (non-React) code that only ever sees a token *string* per call and
// has no way to reach useAsgardeo() itself. A mount-only component
// (AuthBridgeMount, wired in AppWithConfig.tsx) registers the live
// getIdToken/signInSilently once the SDK is ready; every authedGet/Post/
// Patch/Delete 401 handler in http.ts calls refreshIdToken() below instead
// of duplicating this wiring per call site.
//
// getIdToken() never checks expiry itself — it's a plain storage read — so
// once the ~15min id_token lifetime passes, every call attaches the same
// dead token until something re-authenticates. signInSilently() is
// Asgardeo's cookie-based silent re-auth (the same mechanism people-app,
// leave-app, menu-app and visitor-app all lean on via their own
// AuthContext.tsx, just exposed under a different name in this SDK).

type GetIdToken = () => Promise<string>;
type SignInSilently = () => Promise<unknown>;

let getIdTokenAccessor: GetIdToken | null = null;
let signInSilentlyAccessor: SignInSilently | null = null;

export function registerAuthAccessors(accessors: {
  getIdToken: GetIdToken;
  signInSilently: SignInSilently;
}): void {
  getIdTokenAccessor = accessors.getIdToken;
  signInSilentlyAccessor = accessors.signInSilently;
}

// Dedup concurrent 401s — e.g. five cards all firing a request off the same
// stale token within milliseconds of each other — into a single silent
// re-auth attempt. Mirrors the _isRefreshing/_refreshPromise guard in
// people-app's APIService (utils/apiService.ts). Cleared as soon as the
// attempt settles (success or failure), so a later, independent 401 starts
// a fresh attempt rather than replaying a stale result.
let inFlightRefresh: Promise<string> | null = null;

export function refreshIdToken(): Promise<string> {
  if (inFlightRefresh) return inFlightRefresh;
  if (!getIdTokenAccessor || !signInSilentlyAccessor) {
    return Promise.reject(new Error("Auth accessors not registered yet"));
  }
  const getIdToken = getIdTokenAccessor;
  const signInSilently = signInSilentlyAccessor;
  inFlightRefresh = signInSilently()
    .then(() => getIdToken())
    .finally(() => {
      inFlightRefresh = null;
    });
  return inFlightRefresh;
}
