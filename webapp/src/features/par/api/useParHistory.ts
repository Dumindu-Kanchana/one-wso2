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
import { decodeRatingComments } from "../util/parCommentCodec";
import type { ParCycle, ParRating } from "./parTypes";

// Closed cycles do not change, so this can be held far longer than anything in
// the open cycle.
const STALE = 10 * 60 * 1000;

function useBasis() {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;
  const ready = isSignedIn && isParBackendConfigured() && Boolean(userSub);
  return { getAccessToken, subState, retryIdentity, userSub, ready };
}

/**
 * Every closed cycle a given employee took part in, newest first.
 *
 * Takes the email rather than assuming the signed-in user, so a lead can read a
 * report's history through the same path. The backend decides whether they may.
 */
export function useClosedCyclesFor(employeeEmail: string | undefined, enabled = true) {
  const { getAccessToken, subState, retryIdentity, userSub, ready } = useBasis();
  const query = useQuery<ParCycle[]>({
    queryKey: ["par", "closed-cycles", userSub, employeeEmail],
    enabled: enabled && ready && Boolean(employeeEmail),
    queryFn: async () => {
      // Returned in the backend's own order. The standalone app does not sort
      // these, and an earlier version here did — so the two apps could disagree
      // about the order of somebody's history for no stated reason. If the order
      // turns out wrong it is a finding to raise, not to paper over here.
      return (
        (await authedGet<ParCycle[]>(
          parServiceUrls.parCycles(employeeEmail as string, "CLOSED"),
          await getAccessToken(),
          digiopsHeaders(),
        )) ?? []
      );
    },
    staleTime: STALE,
    retry: httpRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

/** The signed-in employee's own closed cycles. */
export function useMyClosedCycles() {
  const { email } = useAsgardeoUser();
  return useClosedCyclesFor(email);
}

/**
 * One past appraisal in full, for any employee.
 *
 * `enabled` so the detail is only fetched for the cycle actually opened.
 */
export function useParRatingFor(
  parCycleId: number | undefined,
  employeeEmail: string | undefined,
  enabled: boolean,
) {
  const { getAccessToken, subState, retryIdentity, userSub, ready } = useBasis();
  const query = useQuery<ParRating | undefined>({
    queryKey: ["par", "rating-for", userSub, parCycleId, employeeEmail],
    enabled: enabled && ready && parCycleId !== undefined && Boolean(employeeEmail),
    queryFn: async () => {
      const ratings = await authedGet<ParRating[] | ParRating>(
        parServiceUrls.parRating(parCycleId as number, employeeEmail as string),
        await getAccessToken(),
        digiopsHeaders(),
      );
      const rating = Array.isArray(ratings) ? ratings[0] : (ratings ?? undefined);
      return decodeRatingComments(rating);
    },
    staleTime: STALE,
    retry: httpRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

/** The signed-in employee's own appraisal for one past cycle. */
export function useMyParRatingFor(parCycleId: number | undefined, enabled: boolean) {
  const { email } = useAsgardeoUser();
  return useParRatingFor(parCycleId, email, enabled);
}
