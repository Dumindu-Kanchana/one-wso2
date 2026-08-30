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
import { useAccessToken } from "@hooks/useAccessToken";
import { isLeaveBackendConfigured, leaveServiceUrls } from "@config/apiConfig";
import { foldIdentityError, useAsgardeoSub } from "@hooks/useAsgardeoSub";
import { leaveRetry } from "../util/leaveError";
import type {
  AppConfig,
  FetchedLeavesRecord,
  LeaveEntitlement,
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

// GET /user-info from the LEAVE backend. Distinct from people-app's — this
// one carries isLead, subordinateCount, location, leadEmail and the leave
// privilege scheme. Keyed per-user so an account switch can't leak.
export function useLeaveUserInfo() {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;
  const configured = isLeaveBackendConfigured();
  const query = useQuery<LeaveUserInfo>({
    queryKey: ["leave-user-info", userSub],
    enabled: isSignedIn && configured && Boolean(userSub),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<LeaveUserInfo>(leaveServiceUrls.userInfo, accessToken);
    },
    staleTime: 5 * 60 * 1000,
    retry: leaveRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

export function useLeaveAppConfig() {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const configured = isLeaveBackendConfigured();
  return useQuery<AppConfig>({
    queryKey: ["leave-app-config"],
    enabled: isSignedIn && configured,
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<AppConfig>(leaveServiceUrls.appConfigs, accessToken);
    },
    staleTime: 30 * 60 * 1000,
    retry: leaveRetry,
  });
}

// GET /leaves with an arbitrary filter. `enabled` lets callers defer until
// the filter is ready (e.g. a report needs a date range first).
export function useLeaves(filter: LeaveFilter, enabled = true) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;
  const configured = isLeaveBackendConfigured();
  const query = useQuery<FetchedLeavesRecord>({
    // Scope per user — a filter without an explicit email resolves the
    // caller from the token, so an account switch in the same tab could
    // otherwise serve the previous user's leave rows within staleTime.
    queryKey: ["leaves", userSub, filter],
    enabled: enabled && isSignedIn && configured && Boolean(userSub),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<FetchedLeavesRecord>(
        `${leaveServiceUrls.leaves}${leavesQuery(filter)}`,
        accessToken,
      );
    },
    staleTime: 60 * 1000,
    retry: leaveRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

// GET /employees/{email}/leave-entitlement — location-specific quota data
// (leavePolicy = entitled, policyAdjustedLeave = consumed). Only meaningful
// for France/Spain today (see leaveTypesForLocation's LOCATION_LEAVE_TYPES);
// callers gate `enabled` on that. Matches leave-app's getLeaveEntitlement,
// minus its second FR-only current-year RTT fetch — a simplification, not
// a behavior we're trying to avoid.
export function useLeaveEntitlement(email: string | undefined, enabled = true) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const configured = isLeaveBackendConfigured();
  return useQuery<LeaveEntitlement[]>({
    queryKey: ["leave-entitlement", email],
    enabled: enabled && isSignedIn && configured && Boolean(email),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<LeaveEntitlement[]>(leaveServiceUrls.leaveEntitlement(email!), accessToken);
    },
    staleTime: 5 * 60 * 1000,
    retry: leaveRetry,
  });
}

export function useLeaveEmployees(enabled = true) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const configured = isLeaveBackendConfigured();
  return useQuery<MinimalEmployeeInfo[]>({
    queryKey: ["leave-employees"],
    enabled: enabled && isSignedIn && configured,
    queryFn: async () => {
      const accessToken = await getAccessToken();
      // The status filter is not optional. The backend passes `status: ()`
      // straight to the HR GraphQL filter (service.bal:779-793), so omitting it
      // returns whatever that defaults to rather than the three the source
      // asks for by name (leaveService.ts:58-66).
      const params = new URLSearchParams();
      for (const status of ["Active", "Marked leaver", "Left"]) {
        params.append("employeeStatuses", status);
      }
      return authedGet<MinimalEmployeeInfo[]>(
        `${leaveServiceUrls.employees}?${params.toString()}`,
        accessToken,
      );
    },
    staleTime: 10 * 60 * 1000,
    retry: leaveRetry,
  });
}
