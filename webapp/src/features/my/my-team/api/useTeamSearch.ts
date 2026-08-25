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
// Reads for the My Team screen.
//
// See docs/ported-apps/my-team.md §5 for the contract.

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { authedGet, authedPost } from "@api/http";
import { httpRetry } from "@api/errors";
import { useAccessToken } from "@hooks/useAccessToken";
import { foldIdentityError, useAsgardeoSub } from "@hooks/useAsgardeoSub";
import { peopleServiceUrls } from "@config/apiConfig";
// Already defined next to the profile queries rather than in apiConfig, unlike
// the other backends. Imported rather than duplicated.
import { isPeopleBackendConfigured } from "../../api/useMeProfile";
import type {
  Employee,
  EmployeePersonalInfo,
  EmployeeSearchPayload,
  FilteredEmployeesResponse,
} from "../../api/types";

const EMPTY: FilteredEmployeesResponse = { employees: [], totalCount: 0 };

function useBasis() {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;
  const ready = isSignedIn && isPeopleBackendConfigured() && Boolean(userSub);
  return { getAccessToken, subState, retryIdentity, userSub, ready };
}

/**
 * The team list.
 *
 * A POST that is a read — the filter/sort/pagination payload is far too large
 * for a query string — so it goes through useQuery with the payload in the key,
 * the same arrangement the OPD claim search uses.
 *
 * Sub-scoped because `leadOnly: true` resolves the caller server-side: two users
 * sending an identical payload get different rows, so they must not share a
 * cache entry.
 *
 * `keepPreviousData` is what makes paging and sorting feel solid: the current
 * rows stay while the next set loads. It also removes the need for the source
 * app's per-URL request cancellation, which made its skeleton flash and briefly
 * showed stale rows as though they were fresh.
 */
export function useTeamSearch(payload: EmployeeSearchPayload, enabled = true) {
  const { getAccessToken, subState, retryIdentity, userSub, ready } = useBasis();
  const query = useQuery<FilteredEmployeesResponse>({
    queryKey: ["my-team", "search", userSub, payload],
    enabled: ready && enabled,
    queryFn: async () =>
      (await authedPost<FilteredEmployeesResponse>(
        peopleServiceUrls.employeesSearch,
        await getAccessToken(),
        payload,
      )) ?? EMPTY,
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
    retry: httpRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

/**
 * One team member's job record.
 *
 * Sub-scoped even though the row itself is caller-independent: *access* is not.
 * The backend allows admin, self, or a lead of that employee, so a record
 * cached for one account must never paint for another.
 */
export function useTeamMember(employeeId: string | undefined) {
  const { getAccessToken, subState, retryIdentity, userSub, ready } = useBasis();
  const query = useQuery<Employee>({
    queryKey: ["my-team", "member", userSub, employeeId],
    enabled: ready && Boolean(employeeId),
    queryFn: async () =>
      authedGet<Employee>(peopleServiceUrls.employee(employeeId as string), await getAccessToken()),
    staleTime: 5 * 60 * 1000,
    retry: httpRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

/**
 * A team member's personal details.
 *
 * `enabled` is the whole point: this is only ever requested once the user has
 * expanded the disclosure, so opening someone's record does not pull their NIC,
 * date of birth and home address along with it.
 */
export function useTeamMemberPersonalInfo(employeeId: string | undefined, enabled: boolean) {
  const { getAccessToken, subState, retryIdentity, userSub, ready } = useBasis();
  const query = useQuery<EmployeePersonalInfo>({
    queryKey: ["my-team", "member-personal", userSub, employeeId],
    enabled: ready && enabled && Boolean(employeeId),
    queryFn: async () =>
      authedGet<EmployeePersonalInfo>(
        peopleServiceUrls.employeePersonalInfo(employeeId as string),
        await getAccessToken(),
      ),
    staleTime: 5 * 60 * 1000,
    retry: httpRetry,
  });

  // Folded like the two queries above it. Without this an unresolvable identity
  // leaves the query merely disabled, and a disabled query reports neither
  // `isLoading` nor `isError` — so the page took its success branch and drew
  // the whole personal-details grid as em dashes, with nothing to say it had
  // failed and no way to retry.
  return foldIdentityError(query, subState, retryIdentity);
}
