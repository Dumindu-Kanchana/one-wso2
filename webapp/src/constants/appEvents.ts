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

// App-wide DOM event names, kept in their own dependency-free module.
//
// Deliberately NOT declared alongside the hook that dispatches them: a listener
// only needs the name, and importing it from `@hooks/useSecureSignOut` would
// pull in `@asgardeo/react` -> `@asgardeo/browser` -> a `buffer/` directory
// import that fails to resolve under Vitest. Anything module-level that reacts
// to these events would otherwise need the whole auth stack polyfilled just to
// learn a string.

/**
 * Dispatched immediately before `signOut()`, so module-level listeners can drop
 * per-user client state without being wired into the React tree.
 *
 * Fired ONLY by a deliberate sign-out — the user menu's action and the idle
 * timeout — never by a silent re-auth or token refresh. Listeners can therefore
 * treat it as "this person is leaving", not "the token moved".
 */
export const SIGNING_OUT_EVENT = "app:signing-out";
