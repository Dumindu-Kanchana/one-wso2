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


// Reads for the employee's own past appraisals.
//
// The list and the detail are separate requests on purpose: a person with
// several years of cycles would otherwise fetch every appraisal to render a
// table that shows none of them. The detail is fetched when a cycle is opened.

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
import type { ParCycle, ParRating } from "./parTypes";

// Closed cycles do not change, so this can be held far longer than anything in
// the open cycle.
const STALE = 10 * 60 * 1000;

function useBasis() {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const { email } = useAsgardeoUser();
  const userSub = subState.status === "ready" ? subState.sub : undefined;
  const ready = isSignedIn && isParBackendConfigured() && Boolean(userSub) && Boolean(email);
  return { getAccessToken, subState, retryIdentity, userSub, email, ready };
}

/** Every closed cycle this employee took part in, newest first. */
export function useMyClosedCycles() {
  const { getAccessToken, subState, retryIdentity, userSub, email, ready } = useBasis();
  const query = useQuery<ParCycle[]>({
    queryKey: ["par", "my-closed-cycles", userSub],
    enabled: ready,
    queryFn: async () => {
      const cycles =
        (await authedGet<ParCycle[]>(
          parServiceUrls.parCycles(email as string, "CLOSED"),
          await getAccessToken(),
          digiopsHeaders(),
        )) ?? [];
      // Sorted here rather than trusting the backend's order, which is
      // unspecified — a history that is not newest-first reads as unordered.
      return [...cycles].sort((a, b) =>
        (b.parCycleEndDate ?? "").localeCompare(a.parCycleEndDate ?? ""),
      );
    },
    staleTime: STALE,
    retry: httpRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

/**
 * One past appraisal in full.
 *
 * `enabled` so the detail is only fetched for the cycle actually opened.
 */
export function useMyParRatingFor(parCycleId: number | undefined, enabled: boolean) {
  const { getAccessToken, subState, retryIdentity, userSub, email, ready } = useBasis();
  const query = useQuery<ParRating | undefined>({
    queryKey: ["par", "my-rating", userSub, parCycleId],
    enabled: enabled && ready && parCycleId !== undefined,
    queryFn: async () => {
      const ratings = await authedGet<ParRating[] | ParRating>(
        parServiceUrls.parRating(parCycleId as number, email as string),
        await getAccessToken(),
        digiopsHeaders(),
      );
      return Array.isArray(ratings) ? ratings[0] : (ratings ?? undefined);
    },
    staleTime: STALE,
    retry: httpRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}
