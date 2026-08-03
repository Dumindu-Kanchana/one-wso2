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

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { authedDelete, authedPost } from "@api/http";
import { leaveServiceUrls } from "@config/apiConfig";
import type { CalculatedLeave, LeavePayload } from "./leaveTypes";

// POST /leaves?isValidationOnlyMode=true — returns computed working days +
// overlap check without creating anything. The Apply form calls this on
// every date/portion change to surface "N working days" and validity.
export function useValidateLeave() {
  const { getIdToken } = useAsgardeo();
  return useMutation<CalculatedLeave, Error, LeavePayload>({
    mutationFn: async (payload) => {
      const idToken = await getIdToken();
      if (!idToken) throw new Error("No id_token available from Asgardeo");
      const res = await authedPost<CalculatedLeave>(
        `${leaveServiceUrls.leaves}?isValidationOnlyMode=true`,
        idToken,
        payload,
      );
      // Validation mode always returns a body.
      if (!res) throw new Error("Empty validation response");
      return res;
    },
  });
}

// POST /leaves — creates the leave. Invalidates the leaves cache so
// history / reports refetch.
export function useSubmitLeave() {
  const { getIdToken } = useAsgardeo();
  const qc = useQueryClient();
  return useMutation<void, Error, LeavePayload>({
    mutationFn: async (payload) => {
      const idToken = await getIdToken();
      if (!idToken) throw new Error("No id_token available from Asgardeo");
      await authedPost<unknown>(
        `${leaveServiceUrls.leaves}?isValidationOnlyMode=false`,
        idToken,
        payload,
      );
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["leaves"] });
    },
  });
}

// DELETE /leaves/{id} — cancels a leave (backend enforces the 30-day
// window and ownership / people-ops rules).
export function useCancelLeave() {
  const { getIdToken } = useAsgardeo();
  const qc = useQueryClient();
  return useMutation<void, Error, number>({
    mutationFn: async (id) => {
      const idToken = await getIdToken();
      if (!idToken) throw new Error("No id_token available from Asgardeo");
      await authedDelete(leaveServiceUrls.leave(id), idToken);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["leaves"] });
    },
  });
}

// POST /leaves/{id}/{approve|reject} — lead action on a pending sabbatical.
export function useApproveLeave() {
  const { getIdToken } = useAsgardeo();
  const qc = useQueryClient();
  return useMutation<void, Error, { id: number; action: "approve" | "reject" }>({
    mutationFn: async ({ id, action }) => {
      const idToken = await getIdToken();
      if (!idToken) throw new Error("No id_token available from Asgardeo");
      await authedPost<unknown>(leaveServiceUrls.leaveAction(id, action), idToken, {});
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["leaves"] });
    },
  });
}
