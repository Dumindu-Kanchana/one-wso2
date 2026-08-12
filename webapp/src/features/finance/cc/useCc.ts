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
import { authedGet } from "@api/http";
import { ccServiceUrls, isCcBackendConfigured } from "@config/apiConfig";
import { useUserSub } from "../util/financeAuth";
import { financeRetry } from "../util/financeError";
import { daysAgoIso, todayIso } from "../util/financeFormat";
import type {
  CcCreditCard,
  CcEmployee,
  CcExpenseTypeList,
  CcJobNumberList,
  CcProductAndBusinessUnitList,
  CcSubRegionList,
  CcTransaction,
} from "./ccTypes";

export { isCcBackendConfigured };

export function useCcUserInfo(enabled = true) {
  const { getAccessToken, isSignedIn } = useAsgardeo();
  const userSub = useUserSub();
  const configured = isCcBackendConfigured();
  return useQuery<CcEmployee>({
    queryKey: ["cc-user-info", userSub],
    enabled: enabled && isSignedIn && configured && Boolean(userSub),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error("No access_token available from Asgardeo");
      return authedGet<CcEmployee>(ccServiceUrls.userInfo, accessToken);
    },
    staleTime: 5 * 60 * 1000,
    retry: financeRetry,
  });
}

export function useCreditCards(includeInactive = false) {
  const { getAccessToken, isSignedIn } = useAsgardeo();
  const userSub = useUserSub();
  const configured = isCcBackendConfigured();
  return useQuery<CcCreditCard[]>({
    queryKey: ["cc-cards", userSub, includeInactive],
    enabled: isSignedIn && configured && Boolean(userSub),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error("No access_token available from Asgardeo");
      return authedGet<CcCreditCard[]>(ccServiceUrls.creditCards, accessToken);
    },
    staleTime: 5 * 60 * 1000,
    retry: financeRetry,
  });
}

// GET /transactions?dateFrom&dateTo&includeInactive — scoped server-side by
// the caller's privileges + email. The backend REQUIRES dateFrom/dateTo, so
// callers that don't care about a window (New / Pending / Approve, which
// filter by status) get a wide default spanning the last ~3 years.
const DEFAULT_WINDOW_DAYS = 365 * 3;

export function useCcTransactions(
  opts: { dateFrom?: string; dateTo?: string; includeInactive?: boolean } = {},
) {
  const { getAccessToken, isSignedIn } = useAsgardeo();
  const userSub = useUserSub();
  const configured = isCcBackendConfigured();
  const dateFrom = opts.dateFrom ?? daysAgoIso(DEFAULT_WINDOW_DAYS);
  const dateTo = opts.dateTo ?? todayIso();
  const includeInactive = opts.includeInactive ?? false;
  return useQuery<CcTransaction[]>({
    queryKey: ["cc-transactions", userSub, dateFrom, dateTo, includeInactive],
    enabled: isSignedIn && configured && Boolean(userSub),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error("No access_token available from Asgardeo");
      // The backend requires all three query params to be present.
      const p = new URLSearchParams();
      p.set("dateFrom", dateFrom);
      p.set("dateTo", dateTo);
      p.set("includeInactive", String(includeInactive));
      return authedGet<CcTransaction[]>(ccServiceUrls.transactions(`?${p.toString()}`), accessToken);
    },
    staleTime: 30 * 1000,
    retry: financeRetry,
  });
}

// The four dropdown sources the submission form needs. Bundled so the form
// mounts one hook.
export function useCcMenus() {
  const { getAccessToken, isSignedIn } = useAsgardeo();
  const userSub = useUserSub();
  const configured = isCcBackendConfigured();
  // Scope these to the signed-in user like the other authenticated CC
  // queries: logout only calls Asgardeo signOut() and does not clear the
  // React Query cache, so an in-tab account switch could otherwise serve a
  // prior user's cached responses (job numbers are per-user; the rest are
  // reference data, but keying uniformly keeps the cache clean).
  const enabled = isSignedIn && configured && Boolean(userSub);

  const auth = async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) throw new Error("No access_token available from Asgardeo");
    return accessToken;
  };

  const expenseTypes = useQuery<CcExpenseTypeList>({
    queryKey: ["cc-expense-types", userSub],
    enabled,
    queryFn: async () => authedGet<CcExpenseTypeList>(ccServiceUrls.expenseTypes, await auth()),
    staleTime: 30 * 60 * 1000,
    retry: financeRetry,
  });
  const subRegions = useQuery<CcSubRegionList>({
    queryKey: ["cc-sub-regions", userSub],
    enabled,
    queryFn: async () => authedGet<CcSubRegionList>(ccServiceUrls.subRegions, await auth()),
    staleTime: 30 * 60 * 1000,
    retry: financeRetry,
  });
  const units = useQuery<CcProductAndBusinessUnitList>({
    queryKey: ["cc-units", userSub],
    enabled,
    queryFn: async () => authedGet<CcProductAndBusinessUnitList>(ccServiceUrls.productAndBusinessUnits, await auth()),
    staleTime: 30 * 60 * 1000,
    retry: financeRetry,
  });
  const jobNumbers = useQuery<CcJobNumberList>({
    queryKey: ["cc-job-numbers", userSub],
    enabled,
    queryFn: async () => authedGet<CcJobNumberList>(ccServiceUrls.jobNumbers, await auth()),
    staleTime: 30 * 60 * 1000,
    retry: financeRetry,
  });

  return { expenseTypes, subRegions, units, jobNumbers };
}
