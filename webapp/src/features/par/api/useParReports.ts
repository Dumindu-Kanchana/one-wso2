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


// The lead's whole reporting line for a cycle, direct and indirect together.
//
// One request returns both: `reportingType` on each row says which. The screens
// split them because a lead's own reports and the people under those reports
// are different responsibilities, but there is no reason to ask twice.

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
import type { ParReportEntry } from "./parTypes";

export function useMyReports(parCycleId: number | undefined, enabled = true) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const { email } = useAsgardeoUser();
  const userSub = subState.status === "ready" ? subState.sub : undefined;
  const ready =
    isSignedIn && isParBackendConfigured() && Boolean(userSub) && Boolean(email);

  const query = useQuery<ParReportEntry[]>({
    queryKey: ["par", "my-reports", userSub, parCycleId],
    enabled: enabled && ready && parCycleId !== undefined,
    queryFn: async () =>
      (await authedGet<ParReportEntry[]>(
        parServiceUrls.reports(parCycleId as number, email as string),
        await getAccessToken(),
        digiopsHeaders(),
      )) ?? [],
    staleTime: 60 * 1000,
    retry: httpRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}
