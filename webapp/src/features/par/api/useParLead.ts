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


// Reads and writes for a lead reviewing one of their reports.
//
// Every call here names another employee, so each is a read or write of someone
// else's appraisal. The backend authorises them — a lead may only reach their
// own reports — but the screens gate too, so a mistake shows as a refusal
// rather than as data.
//
// The endpoints are the same ones the employee's own screens use, with a
// different email in the path. That is the whole difference, which is why these
// live beside each other rather than in a separate client.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { authedGet, authedPatch } from "@api/http";
import { httpRetry } from "@api/errors";
import { digiopsHeaders } from "@api/digiopsHeaders";
import { useAccessToken } from "@hooks/useAccessToken";
import { foldIdentityError, useAsgardeoSub } from "@hooks/useAsgardeoSub";
import { parServiceUrls } from "@config/apiConfig";
import { isParBackendConfigured } from "./useParMe";
import type {
  ParF2fStatus,
  ParRating,
  ParSpecialRating,
  ParThreeSixtyReview,
} from "./parTypes";

const STALE = 30 * 1000;

function useBasis() {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;
  const ready = isSignedIn && isParBackendConfigured() && Boolean(userSub);
  return { getAccessToken, subState, retryIdentity, userSub, ready };
}

/** One report's PAR record, as the lead reviewing it sees it. */
export function useReportParRating(parCycleId: number | undefined, employeeEmail: string | undefined) {
  const { getAccessToken, subState, retryIdentity, userSub, ready } = useBasis();
  const query = useQuery<ParRating | undefined>({
    queryKey: ["par", "report-rating", userSub, parCycleId, employeeEmail],
    enabled: ready && parCycleId !== undefined && Boolean(employeeEmail),
    queryFn: async () => {
      const ratings = await authedGet<ParRating[] | ParRating>(
        parServiceUrls.parRating(parCycleId as number, employeeEmail as string),
        await getAccessToken(),
        digiopsHeaders(),
      );
      return Array.isArray(ratings) ? ratings[0] : (ratings ?? undefined);
    },
    // Short: a lead often has the employee's own screen open in another tab, and
    // a stale "not shared yet" would block a review that is now ready.
    staleTime: STALE,
    retry: httpRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

/** The 360 feedback written about one report. */
export function useReportThreeSixtyReviews(
  parCycleId: number | undefined,
  employeeEmail: string | undefined,
) {
  const { getAccessToken, subState, retryIdentity, userSub, ready } = useBasis();
  const query = useQuery<ParThreeSixtyReview[]>({
    queryKey: ["par", "report-360", userSub, parCycleId, employeeEmail],
    enabled: ready && parCycleId !== undefined && Boolean(employeeEmail),
    queryFn: async () =>
      (await authedGet<ParThreeSixtyReview[]>(
        parServiceUrls.reviews(parCycleId as number, employeeEmail as string),
        await getAccessToken(),
        digiopsHeaders(),
      )) ?? [],
    staleTime: STALE,
    retry: httpRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

export interface SaveLeadReviewArgs {
  parCycleId: number;
  parRatingId: number;
  employeeEmail: string;
  parLeadComment: string;
  parRating: string;
  parSpecialRating: ParSpecialRating;
  /** Newline-separated evidence URLs. */
  parPerformanceNoticeAck: string;
  /**
   * Set only when sharing. One-way, and it unlocks the F2F record, so the
   * caller opts in explicitly rather than it being inferred from completeness.
   */
  share?: boolean;
}

/** PATCH the lead's half of a report's PAR — draft save and share alike. */
export function useSaveLeadReview() {
  const { getAccessToken, userSub } = useBasis();
  const qc = useQueryClient();
  return useMutation<void, Error, SaveLeadReviewArgs>({
    mutationFn: async ({ parCycleId, parRatingId, employeeEmail, share, ...values }) => {
      await authedPatch<unknown>(
        parServiceUrls.updateParRating(parCycleId, employeeEmail, parRatingId),
        await getAccessToken(),
        { ...values, ...(share ? { parLeadStatus: "SHARED" } : {}) },
        digiopsHeaders(),
      );
    },
    onSuccess: async (_data, { parCycleId, employeeEmail }) => {
      await Promise.all([
        qc.invalidateQueries({
          queryKey: ["par", "report-rating", userSub, parCycleId, employeeEmail],
        }),
        // The team table's completion counts move when a review is shared.
        qc.invalidateQueries({ queryKey: ["par", "team-report", userSub, parCycleId] }),
        qc.invalidateQueries({ queryKey: ["par", "my-teams", userSub, parCycleId] }),
      ]);
    },
  });
}

export interface RecordF2fArgs {
  parCycleId: number;
  parRatingId: number;
  employeeEmail: string;
  parF2fStatus: ParF2fStatus;
  /** "YYYY-MM-DD". */
  parF2fDate?: string;
}

/** PATCH the face-to-face record. Available once the lead review is shared. */
export function useRecordF2f() {
  const { getAccessToken, userSub } = useBasis();
  const qc = useQueryClient();
  return useMutation<void, Error, RecordF2fArgs>({
    mutationFn: async ({ parCycleId, parRatingId, employeeEmail, ...values }) => {
      await authedPatch<unknown>(
        parServiceUrls.updateParRating(parCycleId, employeeEmail, parRatingId),
        await getAccessToken(),
        values,
        digiopsHeaders(),
      );
    },
    onSuccess: async (_data, { parCycleId, employeeEmail }) => {
      await Promise.all([
        qc.invalidateQueries({
          queryKey: ["par", "report-rating", userSub, parCycleId, employeeEmail],
        }),
        qc.invalidateQueries({ queryKey: ["par", "team-report", userSub, parCycleId] }),
        qc.invalidateQueries({ queryKey: ["par", "my-teams", userSub, parCycleId] }),
      ]);
    },
  });
}
