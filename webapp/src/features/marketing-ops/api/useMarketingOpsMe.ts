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
import { authedGet } from "@api/http";
import { httpRetry } from "@api/errors";
import { useAccessToken } from "@hooks/useAccessToken";
import { foldIdentityError, useAsgardeoSub } from "@hooks/useAsgardeoSub";
import {
  isMarketingOpsBackendConfigured,
  marketingOpsServiceUrls,
} from "@config/apiConfig";
import type { MarketingOpsMe } from "./marketingOpsTypes";

export { isMarketingOpsBackendConfigured };

// GET /api/me — the single identity + authorization call for the whole
// Marketing Ops perspective. Every gate in this feature derives from it, so it
// is fetched once and shared: React Query dedupes concurrent callers on the key
// below, which means the rail and each page asking independently still produce
// one request.
//
// Keyed per-user (`userSub`) for the same reason every sibling backend's
// user-info query is: switching accounts in the same tab must not serve the
// previous user's authorization decision from cache.
//
// `enabled` lets a caller avoid firing this at all while the Marketing Ops
// perspective isn't active — the rail asks for a gate on every perspective, and
// there's no reason for a People Ops page to be calling a marketing backend.
//
// staleTime of 5 minutes matches the other identity queries (opd/cc/leave
// /user-info): group membership changes rarely, and a stale authorization
// decision is corrected on the next mount rather than needing to be live.
export function useMarketingOpsMe(enabled = true) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;
  const configured = isMarketingOpsBackendConfigured();

  const query = useQuery<MarketingOpsMe>({
    queryKey: ["marketing-ops-me", userSub],
    enabled: enabled && isSignedIn && configured && Boolean(userSub),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<MarketingOpsMe>(marketingOpsServiceUrls.me, accessToken);
    },
    staleTime: 5 * 60 * 1000,
    retry: httpRetry,
  });

  return foldIdentityError(query, subState, retryIdentity);
}
