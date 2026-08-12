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

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { authedGet, HttpError, defaultQueryRetry } from "@api/http";
import { peopleBackendUrl, peopleServiceUrls } from "@config/apiConfig";
import { useAsgardeoSub } from "@hooks/useAsgardeoSub";
import type { Employee, EmployeePersonalInfo, UserInfo } from "./types";

// Re-export HttpError for existing feature-scoped consumers that still
// import it from here. Prefer importing from @api/http directly.
export { HttpError };

export interface MeProfile {
  userInfo: UserInfo;
  employee: Employee;
  personalInfo: EmployeePersonalInfo;
}

// Two-step fetch that mirrors people-app's own me flow:
//   1. GET /user-info                 → employeeId (from the JWT identity)
//   2. GET /employees/{id}            → org / role / employment record
//      GET /employees/{id}/personal-info → contact + emergency contacts
// Steps 2 and 3 run in parallel once employeeId is known.
export function useMeProfile() {
  const { getAccessToken, isSignedIn } = useAsgardeo();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const qc = useQueryClient();
  const userSub = subState.status === "ready" ? subState.sub : undefined;
  const backendConfigured = Boolean(peopleBackendUrl);
  const identityError = subState.status === "error" ? subState.message : null;

  const query = useQuery<MeProfile>({
    // userSub is part of the key so cached data is scoped per-user — no
    // brief cross-user leak on account switch in the same tab.
    queryKey: ["me-profile", userSub],
    enabled: isSignedIn && backendConfigured && Boolean(userSub),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error("No access_token available from Asgardeo");

      // Share the ["user-info", sub] cache slot with useUserInfo (the
      // TopBar's avatar reader). Without this, both hooks would issue an
      // independent GET /user-info on the same page load — React Query
      // only dedupes within a query key, not across separate authedGet
      // calls. fetchQuery populates + returns the cached value.
      const userInfo = await qc.fetchQuery<UserInfo>({
        queryKey: ["user-info", userSub],
        queryFn: () => authedGet<UserInfo>(peopleServiceUrls.userInfo, accessToken),
        staleTime: 5 * 60 * 1000,
      });
      const [employee, personalInfo] = await Promise.all([
        authedGet<Employee>(peopleServiceUrls.employee(userInfo.employeeId), accessToken),
        authedGet<EmployeePersonalInfo>(
          peopleServiceUrls.employeePersonalInfo(userInfo.employeeId),
          accessToken,
        ),
      ]);
      return { userInfo, employee, personalInfo };
    },
    // Profile changes rarely — fetch once per session, don't retry on
    // 4xx (usually a token / role problem, not a transient failure).
    staleTime: 5 * 60 * 1000,
    retry: defaultQueryRetry,
  });

  // Fold identity resolution failures into the query result so the page
  // renders a real error (with a retry path) instead of getting stuck on
  // the loading skeleton. Identity errors take precedence — if the JWT
  // subject is unresolvable, the /user-info call would fail anyway.
  //
  // We override `refetch` on the synthetic result: React Query's own
  // refetch ignores `enabled: false` and would fire the profile query
  // with key ["me-profile", undefined], bypassing the per-user cache
  // scoping. The right retry here re-runs identity resolution — if the
  // decode then succeeds, `enabled` flips true and the profile query
  // starts naturally; if it still fails, the user sees the same error
  // with a fresh chance to retry.
  //
  // The synthetic result doesn't match React Query's discriminated union
  // exactly (the four *Result variants have exclusive boolean flags), so
  // we cast through unknown; the consumer only reads isError + error +
  // isLoading + refetch, and this shape sets those consistently.
  if (identityError && !query.isError) {
    const synthetic = {
      ...query,
      isError: true,
      isPending: false,
      isLoading: false,
      isSuccess: false,
      isFetching: false,
      status: "error" as const,
      error: new Error(identityError),
      refetch: (async () => {
        retryIdentity();
        return query;
      }) as typeof query.refetch,
    };
    return synthetic as unknown as typeof query;
  }
  return query;
}

export function isPeopleBackendConfigured(): boolean {
  return Boolean(peopleBackendUrl);
}
