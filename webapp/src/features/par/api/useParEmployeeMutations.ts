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


// Writes the employee makes to their own PAR.
//
// None set `retry`, matching the house rule: React Query's mutation default is
// zero attempts, and a refused share or a rejected nomination is a final answer
// rather than something a second attempt improves.
//
// No toasts here either — the caller knows whether it saved a draft or shared
// for good, so it owns the wording.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authedPatch, authedPost } from "@api/http";
import { digiopsHeaders } from "@api/digiopsHeaders";
import { useAccessToken } from "@hooks/useAccessToken";
import { useAsgardeoUser } from "@hooks/useAsgardeoUser";
import { useAsgardeoSub } from "@hooks/useAsgardeoSub";
import { parServiceUrls } from "@config/apiConfig";
import type { ParThreeSixtyReviewStatus } from "./parTypes";

function useScope() {
  const getAccessToken = useAccessToken();
  const { state } = useAsgardeoSub();
  const { email } = useAsgardeoUser();
  return { getAccessToken, email, userSub: state.status === "ready" ? state.sub : undefined };
}

export interface SaveParArgs {
  parCycleId: number;
  parRatingId: number;
  /** Sanitised HTML from the answer field. */
  parEmployeeComment: string;
  /**
   * Set only when sharing. Sharing is ONE-WAY and locks the answer, so the
   * caller has to opt into it explicitly rather than it being inferred from a
   * non-empty answer.
   */
  share?: boolean;
}

/**
 * PATCH the employee's own PAR — the draft save and the share are the same
 * request, differing only by whether a status accompanies the answer.
 */
export function useSaveMyPar() {
  const { getAccessToken, email, userSub } = useScope();
  const qc = useQueryClient();
  return useMutation<void, Error, SaveParArgs>({
    mutationFn: async ({ parCycleId, parRatingId, parEmployeeComment, share }) => {
      await authedPatch<unknown>(
        parServiceUrls.updateParRating(parCycleId, email as string, parRatingId),
        await getAccessToken(),
        {
          parEmployeeComment,
          ...(share ? { parEmployeeStatus: "SHARED" } : {}),
        },
        digiopsHeaders(),
      );
    },
    onSuccess: async (_data, { parCycleId }) => {
      // The record carries the status the whole screen keys its locking off, so
      // it has to be re-read rather than patched locally.
      await qc.invalidateQueries({ queryKey: ["par", "my-rating", userSub, parCycleId] });
    },
  });
}

export interface NominateReviewersArgs {
  parCycleId: number;
  reviewerEmails: string[];
}

/** POST the 360 nomination list. Additive: the backend appends to any existing. */
export function useNominateReviewers() {
  const { getAccessToken, email, userSub } = useScope();
  const qc = useQueryClient();
  return useMutation<void, Error, NominateReviewersArgs>({
    mutationFn: async ({ parCycleId, reviewerEmails }) => {
      await authedPost<unknown>(
        parServiceUrls.reviewers(parCycleId, email as string),
        await getAccessToken(),
        { reviewerEmails },
        digiopsHeaders(),
      );
    },
    onSuccess: async (_data, { parCycleId }) => {
      await qc.invalidateQueries({ queryKey: ["par", "my-reviewers", userSub, parCycleId] });
    },
  });
}

export interface SubmitReviewArgs {
  parCycleId: number;
  /** The person being reviewed — NOT the reviewer, who is the caller. */
  employeeEmail: string;
  reviewRating?: string;
  /** Sanitised HTML. */
  reviewComment?: string;
  /**
   * `"SHARED"` submits it for good; `"DRAFT"` keeps it private to the reviewer;
   * `"REJECTED"` declines the request. The wire value for a completed review is
   * `"SHARED"` — see the note in util/parStatus.ts about that collision.
   */
  reviewStatus: ParThreeSixtyReviewStatus;
}

/** PATCH one 360 review this employee was asked to write about someone else. */
export function useSubmitThreeSixtyReview() {
  const { getAccessToken, userSub } = useScope();
  const qc = useQueryClient();
  return useMutation<void, Error, SubmitReviewArgs>({
    mutationFn: async ({ parCycleId, employeeEmail, ...values }) => {
      await authedPatch<unknown>(
        parServiceUrls.review(parCycleId, employeeEmail),
        await getAccessToken(),
        values,
        digiopsHeaders(),
      );
    },
    onSuccess: async (_data, { parCycleId }) => {
      await qc.invalidateQueries({
        queryKey: ["par", "my-review-requests", userSub, parCycleId],
      });
    },
  });
}
