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

// digiops-hr apps (promotion-app, par-app, and other siblings) share a
// JwtInterceptor that reads `x-user-timezone-offset` before validating
// the JWT. Missing → the backend rejects the call with a generic
// "Http header does not exist" 400. Same value the promotion webapp
// computes (hours from UTC, sign-flipped from JS's minutes-from-UTC).
// Sri Lanka (UTC+5:30) → "5.5"; UTC → "0"; New York in EDT → "-4".
export function digiopsHeaders(): Record<string, string> {
  const offsetHours = -(new Date().getTimezoneOffset() / 60);
  return { "x-user-timezone-offset": String(offsetHours) };
}
