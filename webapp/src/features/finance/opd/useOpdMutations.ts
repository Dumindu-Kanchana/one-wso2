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
import { opdServiceUrls } from "@config/apiConfig";
import { uploadReceipt } from "../util/financeReceipts";
import type { OpdClaimPayload, OpdStatusPayload, OpdTransaction } from "./opdTypes";

// POST /claims/{email}/transactions/receipts/file (raw binary) → fileName.
export function useOpdReceiptUpload() {
  const { getIdToken } = useAsgardeo();
  return useMutation<string, Error, { email: string; file: File }>({
    mutationFn: async ({ email, file }) => {
      const idToken = await getIdToken();
      if (!idToken) throw new Error("No id_token available from Asgardeo");
      return uploadReceipt(opdServiceUrls.receiptUpload(email), idToken, file);
    },
  });
}

// POST /claims — submit a new OPD claim. Invalidates the claims + app-data
// caches so History and the remaining-balance summary refetch.
export function useSubmitOpdClaim() {
  const { getIdToken } = useAsgardeo();
  const qc = useQueryClient();
  return useMutation<void, Error, OpdClaimPayload>({
    mutationFn: async (payload) => {
      const idToken = await getIdToken();
      if (!idToken) throw new Error("No id_token available from Asgardeo");
      await authedPost<unknown>(opdServiceUrls.claims, idToken, payload);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["opd-claims"] });
      await qc.invalidateQueries({ queryKey: ["opd-app-data"] });
    },
  });
}

// POST /claim-drafts — persist the in-progress claim as a server-side draft
// (autosaved from the New Claim page). DELETE /claim-drafts clears it.
export function useOpdDraftSync() {
  const { getIdToken } = useAsgardeo();
  const qc = useQueryClient();
  const save = useMutation<void, Error, OpdTransaction[]>({
    mutationFn: async (transactions) => {
      const idToken = await getIdToken();
      if (!idToken) throw new Error("No id_token available from Asgardeo");
      await authedPost<unknown>(opdServiceUrls.claimDrafts, idToken, { transactions });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["opd-app-data"] });
    },
  });
  const remove = useMutation<void, Error, void>({
    mutationFn: async () => {
      const idToken = await getIdToken();
      if (!idToken) throw new Error("No id_token available from Asgardeo");
      await authedDelete(opdServiceUrls.claimDrafts, idToken);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["opd-app-data"] });
    },
  });
  return { save, remove };
}

// POST /claims/{id}/status — finance approve/reject. Reject carries a reason.
export function useOpdClaimStatus() {
  const { getIdToken } = useAsgardeo();
  const qc = useQueryClient();
  return useMutation<void, Error, { claimId: string; body: OpdStatusPayload }>({
    mutationFn: async ({ claimId, body }) => {
      const idToken = await getIdToken();
      if (!idToken) throw new Error("No id_token available from Asgardeo");
      await authedPost<unknown>(opdServiceUrls.claimStatus(claimId), idToken, body);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["opd-claims"] });
    },
  });
}
