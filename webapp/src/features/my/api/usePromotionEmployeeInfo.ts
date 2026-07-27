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
import type { PromotionEmployeeInfoResponse } from "./types";
import { digiopsHeaders } from "../util/digiopsHeaders";

// Fetches GET /employee-info?employeeWorkEmail=<email> from the digiops-hr
// promotion app. Non-lead users can only fetch their own record (backend
// enforces requestedBy === employeeWorkEmail).
//
// Skips the request entirely when ONE_WSO2_PROMOTION_BACKEND_URL isn't
// configured — the calling component renders a "not configured" fallback.
export function usePromotionEmployeeInfo(workEmail: string | undefined) {
  const { getIdToken, isSignedIn } = useAsgardeo();
  const backendConfigured = Boolean(promotionBackendUrl);
  return useQuery<PromotionEmployeeInfoResponse>({
    queryKey: ["promotion-employee-info", workEmail],
    enabled: isSignedIn && backendConfigured && Boolean(workEmail),
    queryFn: async () => {
      const idToken = await getIdToken();
      if (!idToken) throw new Error("No id_token available from Asgardeo");
      return authedGet<PromotionEmployeeInfoResponse>(
        promotionServiceUrls.employeeInfo(workEmail!),
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

export function isPromotionBackendConfigured(): boolean {
  return Boolean(promotionBackendUrl);
}
