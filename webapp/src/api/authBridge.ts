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

let getIdTokenAccessor: GetToken | null = null;
let getAccessTokenAccessor: GetToken | null = null;
let signInSilentlyAccessor: SignInSilently | null = null;

export function registerAuthAccessors(accessors: {
  getIdToken: GetToken;
  getAccessToken: GetToken;
  signInSilently: SignInSilently;
}): void {
  getIdTokenAccessor = accessors.getIdToken;
  getAccessTokenAccessor = accessors.getAccessToken;
  signInSilentlyAccessor = accessors.signInSilently;
}

// Dedup concurrent re-auth attempts — e.g. five cards all firing a request
// off the same stale token within milliseconds of each other, or a 401
// retry and an identity-decode retry landing at the same moment — into a
// single silent re-auth, shared regardless of which token the caller
// ultimately needs. Mirrors the _isRefreshing/_refreshPromise guard in
// people-app's APIService (utils/apiService.ts). Cleared as soon as the
// attempt settles (success or failure), so a later, independent failure
// starts a fresh attempt rather than replaying a stale result.
let inFlightRefresh: Promise<void> | null = null;

function refreshSession(): Promise<void> {
  if (inFlightRefresh) return inFlightRefresh;
  if (!signInSilentlyAccessor) {
    return Promise.reject(new Error("Auth accessors not registered yet"));
  }
  const signInSilently = signInSilentlyAccessor;
  inFlightRefresh = signInSilently()
    .then(() => undefined)
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
