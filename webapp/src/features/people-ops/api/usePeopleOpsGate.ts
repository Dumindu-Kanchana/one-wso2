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

// Authorization gate for the People Ops reports. Same three-state contract
// as useMarketingOpsGate (resolving / error / decided) so PeopleOpsShell can
// render the same careful sequence — but far simpler underneath: Marketing
// Ops has to ask its own backend's /api/me, whereas every fact this gate
// needs is already in the app-wide /user-info query, so this adds no request.
//
// The reports are ADMIN-only, and that is enforced by the BACKEND: both
// POST /employees/search (in its org-wide, non-leadOnly form) and
// POST /reports/employees/generate reject non-admins with 403. This gate
// exists so an unauthorized caller sees an explanation instead of a failed
// request — it is not the security boundary and must never be treated as one.

import { useUserInfo } from "@api/useUserInfo";
import { capabilitiesFromPrivileges } from "@constants/appMenu";
import { describeError } from "@api/errors";

export interface PeopleOpsGate {
  /** Caller holds people-app ADMIN privilege (999). */
  isAdmin: boolean;
  /** The decision hasn't landed yet — render a spinner, never a denial. */
  isResolving: boolean;
  /** /user-info itself failed. Distinct from "decided: not an admin". */
  isError: boolean;
  errorMessage?: string;
  retry: () => void;
}

export function usePeopleOpsGate(): PeopleOpsGate {
  const userInfo = useUserInfo();
  const caps = capabilitiesFromPrivileges(userInfo.data?.privileges);

  return {
    isAdmin: caps.has("admin"),
    // `isPending` rather than `isLoading`, for the same reason the Marketing
    // Ops gate documents: while the Asgardeo sub is still resolving the query
    // is disabled and merely "not fetching", which `isLoading` reports as a
    // finished check holding no privileges — i.e. a denial flash on every
    // cold load, shown to the very admins who do have access.
    isResolving: userInfo.isPending,
    isError: userInfo.isError,
    // describeError never surfaces a raw response body — see @api/errors.
    errorMessage: userInfo.isError ? describeError(userInfo.error) : undefined,
    retry: () => void userInfo.refetch(),
  };
}
