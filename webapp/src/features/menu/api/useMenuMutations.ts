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

// Writes to the cafeteria menu backend.
//
// None of these set `retry`. React Query's mutation default is zero attempts,
// which is what we want: a refused feedback submission or a "nothing to cancel"
// is a final answer, and the standalone app's inverted retry condition made
// exactly those two statuses wait through three attempts with backoff before the
// user saw anything.
//
// No toasts in here either — the component knows whether the user was ordering
// or updating, so it owns the wording.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authedDelete, authedPost } from "@api/http";
import { useAccessToken } from "@hooks/useAccessToken";
import { menuServiceUrls } from "@config/apiConfig";
import { useAsgardeoSub } from "@hooks/useAsgardeoSub";
import type { DinnerPayload } from "./menuTypes";

/** The dinner query key for the signed-in subject. */
function useDinnerKey(): unknown[] {
  const { state } = useAsgardeoSub();
  return ["menu-dinner", state.status === "ready" ? state.sub : undefined];
}

/** POST /feedback. Invalidates nothing — feedback cannot change the menu. */
export function useSubmitLunchFeedback() {
  const getAccessToken = useAccessToken();
  return useMutation<void, Error, string>({
    mutationFn: async (message) => {
      await authedPost<unknown>(menuServiceUrls.feedback, await getAccessToken(), { message });
    },
  });
}

/** POST /dinner. Places an order, or changes one when the payload carries an id. */
export function useUpsertDinnerOrder() {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  const dinnerKey = useDinnerKey();
  return useMutation<void, Error, DinnerPayload>({
    mutationFn: async (payload) => {
      await authedPost<unknown>(menuServiceUrls.dinner, await getAccessToken(), payload);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: dinnerKey });
    },
  });
}

/** DELETE /dinner. */
export function useCancelDinnerOrder() {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  const dinnerKey = useDinnerKey();
  return useMutation<void, Error, void>({
    mutationFn: async () => {
      await authedDelete(menuServiceUrls.dinner, await getAccessToken());
    },
    onSuccess: async () => {
      // Clear before refetching, so the order summary goes away on the click
      // rather than lingering until the round trip lands.
      qc.setQueryData(dinnerKey, null);
      await qc.invalidateQueries({ queryKey: dinnerKey });
    },
  });
}
