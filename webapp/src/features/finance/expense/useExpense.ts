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

import { useQuery } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { authedGet, authedPost } from "@api/http";
import { expenseServiceUrls, isExpenseBackendConfigured } from "@config/apiConfig";
import { useUserSub } from "../util/financeAuth";
import { financeRetry } from "../util/financeError";
import type {
  ExchangeRate,
  ExpenseAppData,
  ExpenseClaim,
  ExpenseClaimSearchPayload,
  ExpenseClaimsSearchResponse,
  ExpenseTypeData,
} from "./expenseTypes";

export { isExpenseBackendConfigured };

// GET /app-data — the caller's employee record, lead/finance view flags,
// reimbursement currency, travels and any draft. Keyed per-user.
export function useExpenseAppData(enabled = true) {
  const { getIdToken, isSignedIn } = useAsgardeo();
  const userSub = useUserSub();
  const configured = isExpenseBackendConfigured();
  return useQuery<ExpenseAppData>({
    queryKey: ["expense-app-data", userSub],
    enabled: enabled && isSignedIn && configured && Boolean(userSub),
    queryFn: async () => {
      const idToken = await getIdToken();
      if (!idToken) throw new Error("No id_token available from Asgardeo");
      return authedGet<ExpenseAppData>(expenseServiceUrls.appData, idToken);
    },
    staleTime: 5 * 60 * 1000,
    retry: financeRetry,
  });
}

// POST /search-claims — the list endpoint for History (own), Lead approvals
// (leadEmail) and Finance approvals (admin). `enabled` defers until ready.
export function useExpenseClaims(payload: ExpenseClaimSearchPayload, enabled = true) {
  const { getIdToken, isSignedIn } = useAsgardeo();
  const userSub = useUserSub();
  const configured = isExpenseBackendConfigured();
  return useQuery<ExpenseClaim[]>({
    // Scope per user — a claim search with no explicit email resolves the
    // caller from the token, so two users would share one cache entry.
    queryKey: ["expense-claims", userSub, payload],
    enabled: enabled && isSignedIn && configured && Boolean(userSub),
    queryFn: async () => {
      const idToken = await getIdToken();
      if (!idToken) throw new Error("No id_token available from Asgardeo");
      const res = await authedPost<ExpenseClaimsSearchResponse>(
        expenseServiceUrls.searchClaims,
        idToken,
        payload,
      );
      return res?.body ?? [];
    },
    staleTime: 60 * 1000,
    retry: financeRetry,
  });
}

// GET /user-configurations/expense-types — the expense-type dropdown,
// scoped to the caller's country and (optionally) a travel job number.
export function useExpenseTypes(travelJobNumber: string | undefined, enabled = true) {
  const { getIdToken, isSignedIn } = useAsgardeo();
  const configured = isExpenseBackendConfigured();
  return useQuery<ExpenseTypeData[]>({
    queryKey: ["expense-types", travelJobNumber ?? null],
    enabled: enabled && isSignedIn && configured,
    queryFn: async () => {
      const idToken = await getIdToken();
      if (!idToken) throw new Error("No id_token available from Asgardeo");
      return authedGet<ExpenseTypeData[]>(expenseServiceUrls.expenseTypes(travelJobNumber), idToken);
    },
    staleTime: 10 * 60 * 1000,
    retry: financeRetry,
  });
}

// GET /currencies/{base}/rates/{date} — exchange rates into the
// reimbursement currency for the bill date. Only fires once base+date exist.
export function useExchangeRates(baseCode: string | undefined, date: string | undefined) {
  const { getIdToken, isSignedIn } = useAsgardeo();
  const configured = isExpenseBackendConfigured();
  return useQuery<ExchangeRate[]>({
    queryKey: ["expense-rates", baseCode ?? null, date ?? null],
    enabled: isSignedIn && configured && Boolean(baseCode) && Boolean(date),
    queryFn: async () => {
      const idToken = await getIdToken();
      if (!idToken) throw new Error("No id_token available from Asgardeo");
      return authedGet<ExchangeRate[]>(expenseServiceUrls.exchangeRates(baseCode!, date!), idToken);
    },
    staleTime: 30 * 60 * 1000,
    retry: financeRetry,
  });
}
