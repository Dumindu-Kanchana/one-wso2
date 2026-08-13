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

import { useQuery } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { authedGet, authedPost } from "@api/http";
import { useAccessToken } from "@hooks/useAccessToken";
import { isOpdBackendConfigured, opdServiceUrls } from "@config/apiConfig";
import { useUserSub } from "@hooks/useAsgardeoSub";
import { financeRetry } from "../util/financeError";
import type {
  OpdAppData,
  OpdClaim,
  OpdClaimSearchPayload,
  OpdEmployee,
  OpdUserInfo,
} from "./opdTypes";

export { isOpdBackendConfigured };

// GET /user-info — the OPD role scheme (userRoles: 444 submitter / 555
// finance). Keyed per-user so an account switch can't leak.
export function useOpdUserInfo(enabled = true) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const userSub = useUserSub();
  const configured = isOpdBackendConfigured();
  return useQuery<OpdUserInfo>({
    queryKey: ["opd-user-info", userSub],
    enabled: enabled && isSignedIn && configured && Boolean(userSub),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<OpdUserInfo>(opdServiceUrls.userInfo, accessToken);
    },
    staleTime: 5 * 60 * 1000,
    retry: financeRetry,
  });
}

// GET /app-data — claim summary (limit/remaining) + any saved draft.
export function useOpdAppData() {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const userSub = useUserSub();
  const configured = isOpdBackendConfigured();
  return useQuery<OpdAppData>({
    queryKey: ["opd-app-data", userSub],
    enabled: isSignedIn && configured && Boolean(userSub),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<OpdAppData>(opdServiceUrls.appData, accessToken);
    },
    staleTime: 60 * 1000,
    retry: financeRetry,
  });
}

// POST /search-claims — the list endpoint for both History (own claims) and
// Approvals (all claims). `enabled` defers until a filter is ready.
export function useOpdClaims(payload: OpdClaimSearchPayload, enabled = true) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const userSub = useUserSub();
  const configured = isOpdBackendConfigured();
  return useQuery<OpdClaim[]>({
    // Scope per user — a search with no explicit email resolves the caller
    // from the token, so two users would otherwise share one cache entry.
    queryKey: ["opd-claims", userSub, payload],
    enabled: enabled && isSignedIn && configured && Boolean(userSub),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      const res = await authedPost<OpdClaim[]>(opdServiceUrls.searchClaims, accessToken, payload);
      return res ?? [];
    },
    staleTime: 60 * 1000,
    retry: financeRetry,
  });
}

// GET /employees — for resolving approver-view user names/avatars.
export function useOpdEmployees(enabled = true) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const userSub = useUserSub();
  const configured = isOpdBackendConfigured();
  return useQuery<OpdEmployee[]>({
    queryKey: ["opd-employees", userSub],
    enabled: enabled && isSignedIn && configured && Boolean(userSub),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<OpdEmployee[]>(opdServiceUrls.employees, accessToken);
    },
    staleTime: 10 * 60 * 1000,
    retry: financeRetry,
  });
}
