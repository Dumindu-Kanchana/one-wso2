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
import { authedGet, HttpError } from "@api/http";
import { promotionBackendUrl, promotionServiceUrls } from "@config/apiConfig";
import type { PromotionHistoryResponse } from "./types";
import { digiopsHeaders } from "../util/digiopsHeaders";

// Fetches the caller's APPROVED promotion history from the digiops-hr
// promotion app. Only fires when `enabled` is true — used to defer the
// request until the "View promotion history" dialog is opened.
//
// Non-lead / non-admin users can only fetch their own history — the
// backend authorization rejects cross-user lookups with a 401/403.
export function usePromotionHistory(workEmail: string | undefined, enabled: boolean) {
  const { getIdToken, isSignedIn } = useAsgardeo();
  const backendConfigured = Boolean(promotionBackendUrl);
  return useQuery<PromotionHistoryResponse>({
    queryKey: ["promotion-history", workEmail],
    enabled: enabled && isSignedIn && backendConfigured && Boolean(workEmail),
    queryFn: async () => {
      const idToken = await getIdToken();
      if (!idToken) throw new Error("No id_token available from Asgardeo");
      return authedGet<PromotionHistoryResponse>(
        promotionServiceUrls.promotionHistory(workEmail!),
        idToken,
        digiopsHeaders(),
      );
    },
    staleTime: 5 * 60 * 1000,
    retry: (failureCount, error) => {
      if (error instanceof HttpError && error.status >= 400 && error.status < 500) return false;
      return failureCount < 1;
    },
  });
}
