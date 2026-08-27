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


// Reads for the employee's own PAR.
//
// Everything hangs off the open cycle: there is at most one at a time, so each
// query below is disabled until its id is known rather than guessing at it. All
// of them are sub-scoped, so a sign-out then a different sign-in in the same tab
// cannot serve the previous person's appraisal.

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
import { decodeRatingComments, decodeReviewComments } from "../util/parCommentCodec";
import type {
  ParCycle,
  ParRating,
  ParReviewer,
  ParThreeSixtyReview,
  ParThreeSixtyReviewRequest,
} from "./parTypes";

const STALE = 60 * 1000;

function useBasis() {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const { email } = useAsgardeoUser();
  const userSub = subState.status === "ready" ? subState.sub : undefined;
  const ready = isSignedIn && isParBackendConfigured() && Boolean(userSub) && Boolean(email);
  return { getAccessToken, subState, retryIdentity, userSub, email, ready };
}

/**
 * The cycle currently open to this employee, if any.
 *
 * Returns `undefined` rather than erroring when nothing is open — between
 * cycles is a normal state, not a fault, and the screen says so.
 */
export function useMyParCycle() {
  const { getAccessToken, subState, retryIdentity, userSub, email, ready } = useBasis();
  const query = useQuery<ParCycle | undefined>({
    queryKey: ["par", "my-cycle", userSub],
    enabled: ready,
    queryFn: async () => {
      const cycles = await authedGet<ParCycle[]>(
        parServiceUrls.parCycles(email as string, "OPEN"),
        await getAccessToken(),
        digiopsHeaders(),
      );
      // The backend answers with a list even though only one cycle can hold
      // this status. Taking the first is the source's behaviour too.
      return Array.isArray(cycles) ? cycles[0] : undefined;
    },
    staleTime: STALE,
    retry: httpRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

/** This employee's PAR record within a cycle. */
export function useMyParRating(parCycleId: number | undefined) {
  const { getAccessToken, subState, retryIdentity, userSub, email, ready } = useBasis();
  const query = useQuery<ParRating | undefined>({
    queryKey: ["par", "my-rating", userSub, parCycleId],
    enabled: ready && parCycleId !== undefined,
    queryFn: async () => {
      const ratings = await authedGet<ParRating[] | ParRating>(
        parServiceUrls.parRating(parCycleId as number, email as string),
        await getAccessToken(),
        digiopsHeaders(),
      );
      // Tolerates both shapes: the endpoint is plural and has been seen to
      // answer with a bare object for a single record.
      const rating = Array.isArray(ratings) ? ratings[0] : (ratings ?? undefined);
      // Decoded here, at the boundary — the wire format is base64, not HTML.
      return decodeRatingComments(rating);
    },
    staleTime: STALE,
    retry: httpRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

/** Colleagues this employee nominated to review them. */
export function useMyReviewers(parCycleId: number | undefined) {
  const { getAccessToken, subState, retryIdentity, userSub, email, ready } = useBasis();
  const query = useQuery<ParReviewer[]>({
    queryKey: ["par", "my-reviewers", userSub, parCycleId],
    enabled: ready && parCycleId !== undefined,
    queryFn: async () =>
      (await authedGet<ParReviewer[]>(
        parServiceUrls.reviewers(parCycleId as number, email as string),
        await getAccessToken(),
        digiopsHeaders(),
      )) ?? [],
    staleTime: STALE,
    retry: httpRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

/**
 * The 360 feedback written ABOUT this employee.
 *
 * Only readable once the lead has shared their review — before that the
 * backend withholds it, so a 403 here is expected rather than a fault.
 */
export function useMyReviews(parCycleId: number | undefined, enabled = true) {
  const { getAccessToken, subState, retryIdentity, userSub, email, ready } = useBasis();
  const query = useQuery<ParThreeSixtyReview[]>({
    queryKey: ["par", "my-reviews", userSub, parCycleId],
    enabled: enabled && ready && parCycleId !== undefined,
    queryFn: async () =>
      decodeReviewComments(
        (await authedGet<ParThreeSixtyReview[]>(
          parServiceUrls.reviews(parCycleId as number, email as string),
          await getAccessToken(),
          digiopsHeaders(),
        )) ?? [],
      ),
    staleTime: STALE,
    retry: httpRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

/**
 * The review THIS employee has written about someone else, if they started one.
 *
 * The path carries the reviewee's email; the reviewer is whoever the token
 * belongs to. Enabled only while the form is open, so opening the screen does
 * not fetch a draft per outstanding request.
 */
export function useMyThreeSixtyDraft(
  parCycleId: number | undefined,
  revieweeEmail: string | undefined,
  enabled: boolean,
) {
  const { getAccessToken, subState, retryIdentity, userSub, ready } = useBasis();
  const query = useQuery<ParThreeSixtyReview | undefined>({
    queryKey: ["par", "my-360-draft", userSub, parCycleId, revieweeEmail],
    enabled: enabled && ready && parCycleId !== undefined && Boolean(revieweeEmail),
    queryFn: async () => {
      const review = await authedGet<ParThreeSixtyReview | ParThreeSixtyReview[]>(
        parServiceUrls.review(parCycleId as number, revieweeEmail as string),
        await getAccessToken(),
        digiopsHeaders(),
      );
      const one = Array.isArray(review) ? review[0] : (review ?? undefined);
      return one === undefined ? undefined : decodeReviewComments([one])[0];
    },
    // Not cached across opens: a stale draft shown in an editor is worse than a
    // brief spinner, because it is silently the wrong text to submit.
    staleTime: 0,
    retry: httpRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

/** 360 feedback OTHERS have asked this employee to write. */
export function useMyReviewRequests(parCycleId: number | undefined) {
  const { getAccessToken, subState, retryIdentity, userSub, email, ready } = useBasis();
  const query = useQuery<ParThreeSixtyReviewRequest[]>({
    queryKey: ["par", "my-review-requests", userSub, parCycleId],
    enabled: ready && parCycleId !== undefined,
    queryFn: async () =>
      (await authedGet<ParThreeSixtyReviewRequest[]>(
        parServiceUrls.reviewRequests(parCycleId as number, email as string),
        await getAccessToken(),
        digiopsHeaders(),
      )) ?? [],
    staleTime: STALE,
    retry: httpRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}
