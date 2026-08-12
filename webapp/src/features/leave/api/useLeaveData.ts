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
import { isLeaveBackendConfigured, leaveServiceUrls } from "@config/apiConfig";
import { useAsgardeoSub } from "@hooks/useAsgardeoSub";
import { leaveRetry } from "../util/leaveError";
import type {
  AppConfig,
  FetchedLeavesRecord,
  LeaveFilter,
  LeaveUserInfo,
  MinimalEmployeeInfo,
} from "./leaveTypes";

export { isLeaveBackendConfigured };

// Build the GET /leaves query string from a filter. Array params repeat.
function leavesQuery(filter: LeaveFilter): string {
  const p = new URLSearchParams();
  if (filter.email) p.set("email", filter.email);
  if (filter.startDate) p.set("startDate", filter.startDate);
  if (filter.endDate) p.set("endDate", filter.endDate);
  if (filter.approverEmail) p.set("approverEmail", filter.approverEmail);
  if (filter.limit != null) p.set("limit", String(filter.limit));
  if (filter.offset != null) p.set("offset", String(filter.offset));
  if (filter.orderBy) p.set("orderBy", filter.orderBy);
  if (filter.subordinatesLeaves) p.set("subordinatesLeaves", "true");
  for (const c of filter.leaveCategory ?? []) p.append("leaveCategory", c);
  for (const s of filter.statuses ?? []) p.append("statuses", s);
  for (const es of filter.employeeStatuses ?? []) p.append("employeeStatuses", es);
  const qs = p.toString();
  return qs ? `?${qs}` : "";
}

// Resolve the signed-in user's `sub` claim via the shared hook, so the
// leave-user-info cache is scoped per-user (no cross-user leak on account
// switch in the same tab) and gets the same retry-after-silent-reauth
// resilience as every other sub-keyed query — see @hooks/useAsgardeoSub.
function useUserSub(): string | undefined {
  const { state } = useAsgardeoSub();
  return state.status === "ready" ? state.sub : undefined;
}

// GET /user-info from the LEAVE backend. Distinct from people-app's — this
// one carries isLead, subordinateCount, location, leadEmail and the leave
// privilege scheme. Keyed per-user so an account switch can't leak.
export function useLeaveUserInfo() {
  const { getIdToken, isSignedIn } = useAsgardeo();
  const userSub = useUserSub();
  const configured = isLeaveBackendConfigured();
  return useQuery<LeaveUserInfo>({
    queryKey: ["leave-user-info", userSub],
    enabled: isSignedIn && configured && Boolean(userSub),
    queryFn: async () => {
      const idToken = await getIdToken();
      if (!idToken) throw new Error("No id_token available from Asgardeo");
      return authedGet<LeaveUserInfo>(leaveServiceUrls.userInfo, idToken);
    },
    staleTime: 5 * 60 * 1000,
    retry: leaveRetry,
  });
}

export function useLeaveAppConfig() {
  const { getIdToken, isSignedIn } = useAsgardeo();
  const configured = isLeaveBackendConfigured();
  return useQuery<AppConfig>({
    queryKey: ["leave-app-config"],
    enabled: isSignedIn && configured,
    queryFn: async () => {
      const idToken = await getIdToken();
      if (!idToken) throw new Error("No id_token available from Asgardeo");
      return authedGet<AppConfig>(leaveServiceUrls.appConfigs, idToken);
    },
    staleTime: 30 * 60 * 1000,
    retry: leaveRetry,
  });
}

// GET /leaves with an arbitrary filter. `enabled` lets callers defer until
// the filter is ready (e.g. a report needs a date range first).
export function useLeaves(filter: LeaveFilter, enabled = true) {
  const { getIdToken, isSignedIn } = useAsgardeo();
  const userSub = useUserSub();
  const configured = isLeaveBackendConfigured();
  return useQuery<FetchedLeavesRecord>({
    // Scope per user — a filter without an explicit email resolves the
    // caller from the token, so an account switch in the same tab could
    // otherwise serve the previous user's leave rows within staleTime.
    queryKey: ["leaves", userSub, filter],
    enabled: enabled && isSignedIn && configured && Boolean(userSub),
    queryFn: async () => {
      const idToken = await getIdToken();
      if (!idToken) throw new Error("No id_token available from Asgardeo");
      return authedGet<FetchedLeavesRecord>(
        `${leaveServiceUrls.leaves}${leavesQuery(filter)}`,
        idToken,
      );
    },
    staleTime: 60 * 1000,
    retry: leaveRetry,
  });
}

export function useLeaveEmployees(enabled = true) {
  const { getIdToken, isSignedIn } = useAsgardeo();
  const configured = isLeaveBackendConfigured();
  return useQuery<MinimalEmployeeInfo[]>({
    queryKey: ["leave-employees"],
    enabled: enabled && isSignedIn && configured,
    queryFn: async () => {
      const idToken = await getIdToken();
      if (!idToken) throw new Error("No id_token available from Asgardeo");
      return authedGet<MinimalEmployeeInfo[]>(leaveServiceUrls.employees, idToken);
    },
    staleTime: 10 * 60 * 1000,
    retry: leaveRetry,
  });
}
