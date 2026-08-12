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
import { ccServiceUrls } from "@config/apiConfig";
import { HttpError } from "@api/http";
import { fileExtension, putBinaryFile } from "../util/financeReceipts";
import type { CcAttachmentType, CcTransaction, CcTransactionUploadGroup } from "./ccTypes";

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: ["cc-transactions"] }),
    qc.invalidateQueries({ queryKey: ["cc-cards"] }),
  ]);
}

// POST /transactions/employee-submit — a CC owner submits categorised `new`
// transactions for lead approval.
export function useCcEmployeeSubmit() {
  const { getAccessToken } = useAsgardeo();
  const qc = useQueryClient();
  return useMutation<void, Error, CcTransaction[]>({
    mutationFn: async (transactions) => {
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error("No access_token available from Asgardeo");
      await authedPost<unknown>(ccServiceUrls.employeeSubmit, accessToken, transactions);
    },
    onSuccess: () => invalidate(qc),
  });
}

// POST /transactions/save-edit — edit categorisation while still pending.
export function useCcSaveEdit() {
  const { getAccessToken } = useAsgardeo();
  const qc = useQueryClient();
  return useMutation<void, Error, CcTransaction[]>({
    mutationFn: async (transactions) => {
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error("No access_token available from Asgardeo");
      await authedPost<unknown>(ccServiceUrls.saveEdit, accessToken, transactions);
    },
    onSuccess: () => invalidate(qc),
  });
}

// POST /transactions/lead-approve | /transactions/finance-approve — body is
// an array of transaction ids.
export function useCcApprove(stage: "lead" | "finance") {
  const { getAccessToken } = useAsgardeo();
  const qc = useQueryClient();
  return useMutation<void, Error, number[]>({
    mutationFn: async (ids) => {
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error("No access_token available from Asgardeo");
      const url = stage === "lead" ? ccServiceUrls.leadApprove : ccServiceUrls.financeApprove;
      await authedPost<unknown>(url, accessToken, ids);
    },
    onSuccess: () => invalidate(qc),
  });
}

// Attachment upload (PUT raw bytes) + delete for a transaction's receipt or
// contract. Returns the stored file name from the upload.
export function useCcAttachment() {
  const { getAccessToken } = useAsgardeo();
  const qc = useQueryClient();
  const upload = useMutation<string, Error, { id: number; attachmentType: CcAttachmentType; file: File }>({
    mutationFn: async ({ id, attachmentType, file }) => {
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error("No access_token available from Asgardeo");
      const url = ccServiceUrls.attachmentUpload(id, fileExtension(file), attachmentType);
      return putBinaryFile(url, accessToken, file);
    },
    onSuccess: () => invalidate(qc),
  });
  const remove = useMutation<void, Error, { id: number; attachmentType: CcAttachmentType }>({
    mutationFn: async ({ id, attachmentType }) => {
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error("No access_token available from Asgardeo");
      await authedDelete(ccServiceUrls.attachment(id, attachmentType), accessToken);
    },
    onSuccess: () => invalidate(qc),
  });
  return { upload, remove };
}

// POST /transactions/process-statement — finance uploads a CSV; backend
// parses it into new/duplicate/invalid groups (raw text/csv body).
export function useCcProcessStatement() {
  const { getAccessToken } = useAsgardeo();
  return useMutation<CcTransactionUploadGroup, Error, { bankCode: string; fileName: string; file: File }>({
    mutationFn: async ({ bankCode, fileName, file }) => {
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error("No access_token available from Asgardeo");
      const url = ccServiceUrls.processStatement(bankCode, fileName);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/csv", Authorization: `Bearer ${accessToken}` },
        body: file,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new HttpError(url, res.status, body);
      }
      return (await res.json()) as CcTransactionUploadGroup;
    },
  });
}

// POST /transactions — finance saves the reviewed group, creating pending
// transactions.
export function useCcUploadTransactions() {
  const { getAccessToken } = useAsgardeo();
  const qc = useQueryClient();
  return useMutation<void, Error, { bankCode: string; fileName: string; group: CcTransactionUploadGroup }>({
    mutationFn: async ({ bankCode, fileName, group }) => {
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error("No access_token available from Asgardeo");
      await authedPost<unknown>(ccServiceUrls.uploadTransactions(bankCode, fileName), accessToken, group);
    },
    onSuccess: () => invalidate(qc),
  });
}
