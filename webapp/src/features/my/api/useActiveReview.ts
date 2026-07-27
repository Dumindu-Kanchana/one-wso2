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
import { parBackendUrl, parServiceUrls } from "@config/apiConfig";
import type { ParCycle, ParRating } from "./types";
import { digiopsHeaders } from "../util/digiopsHeaders";

// Returns the caller's currently-OPEN par cycle (if any). Non-lead/non-admin
// callers can only query their own email; backend enforces that.
export function useActiveParCycle(workEmail: string | undefined) {
  const { getIdToken, isSignedIn } = useAsgardeo();
  const backendConfigured = Boolean(parBackendUrl);
  return useQuery<ParCycle[]>({
    queryKey: ["par-cycles-open", workEmail],
    enabled: isSignedIn && backendConfigured && Boolean(workEmail),
    queryFn: async () => {
      const idToken = await getIdToken();
      if (!idToken) throw new Error("No id_token available from Asgardeo");
      return authedGet<ParCycle[]>(
        parServiceUrls.parCycles(workEmail!, "OPEN"),
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

// Returns the caller's ParRating record for a specific cycle. Only fires
// once we have a cycleId. A 404 from the backend means "no rating record
// exists yet for you in this cycle" — surface it as null, not an error.
export function useParRating(parCycleId: number | undefined, workEmail: string | undefined) {
  const { getIdToken, isSignedIn } = useAsgardeo();
  const backendConfigured = Boolean(parBackendUrl);
  return useQuery<ParRating | null>({
    queryKey: ["par-rating", parCycleId, workEmail],
    enabled:
      isSignedIn && backendConfigured && Boolean(parCycleId) && Boolean(workEmail),
    queryFn: async () => {
      const idToken = await getIdToken();
      if (!idToken) throw new Error("No id_token available from Asgardeo");
      try {
        return await authedGet<ParRating>(
          parServiceUrls.parRating(parCycleId!, workEmail!),
          idToken,
          digiopsHeaders(),
        );
      } catch (e) {
        // Backend returns 404 when there's no rating record yet — treat
        // that as a valid "no data" case instead of an error.
        if (e instanceof HttpError && e.status === 404) return null;
        throw e;
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: (failureCount, error) => {
      if (error instanceof HttpError && error.status >= 400 && error.status < 500) return false;
      return failureCount < 1;
    },
  });
}

export function isParBackendConfigured(): boolean {
  return Boolean(parBackendUrl);
}
