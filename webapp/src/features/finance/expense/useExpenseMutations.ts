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
import { expenseServiceUrls } from "@config/apiConfig";
import { uploadReceipt } from "../util/financeReceipts";
import type {
  ExpenseClaimPayload,
  ExpenseStatusPayload,
  ExpenseTransactionPayload,
} from "./expenseTypes";

// POST /claims/{email}/transactions/receipts/file (raw binary) → fileName.
export function useExpenseReceiptUpload() {
  const { getIdToken } = useAsgardeo();
  return useMutation<string, Error, { email: string; file: File }>({
    mutationFn: async ({ email, file }) => {
      const idToken = await getIdToken();
      if (!idToken) throw new Error("No id_token available from Asgardeo");
      return uploadReceipt(expenseServiceUrls.receiptUpload(email), idToken, file);
    },
  });
}

// POST /claims — submit a new expense claim to the caller's lead.
export function useSubmitExpenseClaim() {
  const { getIdToken } = useAsgardeo();
  const qc = useQueryClient();
  return useMutation<void, Error, ExpenseClaimPayload>({
    mutationFn: async (payload) => {
      const idToken = await getIdToken();
      if (!idToken) throw new Error("No id_token available from Asgardeo");
      await authedPost<unknown>(expenseServiceUrls.claims, idToken, payload);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["expense-claims"] });
      await qc.invalidateQueries({ queryKey: ["expense-app-data"] });
    },
  });
}

// POST /claim-drafts — autosave the in-progress claim; DELETE clears it.
export function useExpenseDraftSync() {
  const { getIdToken } = useAsgardeo();
  const qc = useQueryClient();
  const save = useMutation<void, Error, ExpenseTransactionPayload[]>({
    mutationFn: async (transactions) => {
      const idToken = await getIdToken();
      if (!idToken) throw new Error("No id_token available from Asgardeo");
      await authedPost<unknown>(expenseServiceUrls.claimDrafts, idToken, { transactions });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["expense-app-data"] });
    },
  });
  const remove = useMutation<void, Error, void>({
    mutationFn: async () => {
      const idToken = await getIdToken();
      if (!idToken) throw new Error("No id_token available from Asgardeo");
      await authedDelete(expenseServiceUrls.claimDrafts, idToken);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["expense-app-data"] });
    },
  });
  return { save, remove };
}

// POST /claims/{id}/status — lead or finance approve/reject. The backend
// authorizes on the caller being a lead of the claim or an admin.
export function useExpenseClaimStatus() {
  const { getIdToken } = useAsgardeo();
  const qc = useQueryClient();
  return useMutation<void, Error, { claimId: string; body: ExpenseStatusPayload }>({
    mutationFn: async ({ claimId, body }) => {
      const idToken = await getIdToken();
      if (!idToken) throw new Error("No id_token available from Asgardeo");
      await authedPost<unknown>(expenseServiceUrls.claimStatus(claimId), idToken, body);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["expense-claims"] });
    },
  });
}
