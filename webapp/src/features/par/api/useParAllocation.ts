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


// The Top 5% / 20% quota allocated to the groups a lead draws from.
//
// Scoped by `leadEmail`: without it the endpoint returns every group in the
// cycle, which is the admin view. A lead sees only the pools their own teams
// belong to.

import { useQuery } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { authedGet } from "@api/http";
import { httpRetry } from "@api/errors";
import { digiopsHeaders } from "@api/digiopsHeaders";
import { useAccessToken } from "@hooks/useAccessToken";
import { useAsgardeoUser } from "@hooks/useAsgardeoUser";
import { foldIdentityError, useAsgardeoSub } from "@hooks/useAsgardeoSub";
import { parServiceUrls } from "@config/apiConfig";
import { isParBackendConfigured } from "./useParMe";
import type { ParSpecialRatingAllocation } from "./parTypes";

export function useMyQuotaAllocation(parCycleId: number | undefined, enabled = true) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const { email } = useAsgardeoUser();
  const userSub = subState.status === "ready" ? subState.sub : undefined;
  const ready = isSignedIn && isParBackendConfigured() && Boolean(userSub) && Boolean(email);

  const query = useQuery<ParSpecialRatingAllocation[]>({
    queryKey: ["par", "my-quota-allocation", userSub, parCycleId],
    enabled: enabled && ready && parCycleId !== undefined,
    queryFn: async () =>
      (await authedGet<ParSpecialRatingAllocation[]>(
        parServiceUrls.specialRatingQuota(parCycleId as number, email as string),
        await getAccessToken(),
        digiopsHeaders(),
      )) ?? [],
    // Quota is set by an admin before the cycle opens and rarely moves.
    staleTime: 5 * 60 * 1000,
    retry: httpRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}
