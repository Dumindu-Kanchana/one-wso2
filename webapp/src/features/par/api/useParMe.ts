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
// Who the caller is, as far as PAR is concerned.
//
// PAR splits its roles across two sources, which is the whole reason this
// feature needs its own gate rather than people-app's capabilities:
//
//   ADMIN, EMPLOYEE  → Asgardeo groups on the ID token
//   LEAD, TEAM_LEAD  → PAR's own employee record
//
// This hook covers the second half. The first is read from the token in
// useParGate.

import { useQuery } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { authedGet } from "@api/http";
import { httpRetry } from "@api/errors";
import { foldIdentityError } from "@hooks/useAsgardeoSub";
import { digiopsHeaders } from "@api/digiopsHeaders";
import { useAccessToken } from "@hooks/useAccessToken";
import { useAsgardeoSub } from "@hooks/useAsgardeoSub";
import { parBackendUrl, parServiceUrls } from "@config/apiConfig";
import type { ParEmployeeInfo } from "./parTypes";

export function isParBackendConfigured(): boolean {
  return Boolean(parBackendUrl);
}

/**
 * PAR's employee record for the signed-in user.
 *
 * `enabled` so the whole PAR perspective can avoid polling this backend from
 * screens that have nothing to do with it.
 */
export function useParMe(workEmail: string | undefined, enabled = true) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state, retry: retryIdentity } = useAsgardeoSub();
  const userSub = state.status === "ready" ? state.sub : undefined;

  const query = useQuery<ParEmployeeInfo>({
    queryKey: ["par", "me", userSub],
    enabled:
      enabled && isSignedIn && isParBackendConfigured() && Boolean(userSub) && Boolean(workEmail),
    queryFn: async () =>
      authedGet<ParEmployeeInfo>(
        parServiceUrls.employee(workEmail as string),
        await getAccessToken(),
        // Every digiops backend rejects a call without this header, with a
        // generic 400 that says nothing about the cause.
        digiopsHeaders(),
      ),
    staleTime: 5 * 60 * 1000,
    retry: httpRetry,
  });

  // Without this, an unresolvable identity leaves the query disabled forever:
  // `enabled` never flips true, so it never runs and never reports an error,
  // and the gate above it spins on "Checking your PAR access…" indefinitely.
  return foldIdentityError(query, state, retryIdentity);
}
