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
import { authedDelete, authedPost } from "@api/http";
import { useAccessToken } from "@hooks/useAccessToken";
import { leaveServiceUrls } from "@config/apiConfig";
import type { CalculatedLeave, LeavePayload } from "./leaveTypes";

// POST /leaves?isValidationOnlyMode=true — returns computed working days +
// overlap check without creating anything. The Apply form calls this on
// every date/portion change to surface "N working days" and validity.
export function useValidateLeave() {
  const getAccessToken = useAccessToken();
  return useMutation<CalculatedLeave, Error, LeavePayload>({
    mutationFn: async (payload) => {
      const accessToken = await getAccessToken();
      const res = await authedPost<CalculatedLeave>(
        `${leaveServiceUrls.leaves}?isValidationOnlyMode=true`,
        accessToken,
        payload,
      );
      // Validation mode always returns a body.
      if (!res) throw new Error("Empty validation response");
      return res;
    },
  });
}

// POST /leaves — creates the leave.
//
// Both caches have to go. Submitting spends entitlement, and
// ["leave-entitlement"] carries a five-minute staleTime — invalidating only
// ["leaves"] left the balance panel showing the pre-submit figures for that
// long. The source has the same problem and solves it by remounting the panel
// (GeneralLeave.tsx:148,264); invalidating is the same fix without the remount.
export function useSubmitLeave() {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  return useMutation<void, Error, LeavePayload>({
    mutationFn: async (payload) => {
      const accessToken = await getAccessToken();
      await authedPost<unknown>(
        `${leaveServiceUrls.leaves}?isValidationOnlyMode=false`,
        accessToken,
        payload,
      );
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["leaves"] }),
        qc.invalidateQueries({ queryKey: ["leave-entitlement"] }),
      ]);
    },
  });
}

// DELETE /leaves/{id} — cancels a leave (backend enforces the 30-day
// window and ownership / people-ops rules).
export function useCancelLeave() {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  return useMutation<void, Error, number>({
    mutationFn: async (id) => {
      const accessToken = await getAccessToken();
      await authedDelete(leaveServiceUrls.leave(id), accessToken);
    },
    // Cancelling returns the days too, so the balance moves here as well.
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["leaves"] }),
        qc.invalidateQueries({ queryKey: ["leave-entitlement"] }),
      ]);
    },
  });
}

// POST /leaves/{id}/{approve|reject} — lead action on a pending sabbatical.
export function useApproveLeave() {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  return useMutation<void, Error, { id: number; action: "approve" | "reject" }>({
    mutationFn: async ({ id, action }) => {
      const accessToken = await getAccessToken();
      await authedPost<unknown>(leaveServiceUrls.leaveAction(id, action), accessToken, {});
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["leaves"] });
    },
  });
}
