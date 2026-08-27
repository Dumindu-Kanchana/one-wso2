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


// PAR's employee directory, scoped to whoever reports to a given person.
//
// Distinct from the `reports` endpoint, which is cycle-scoped: this one knows
// nothing about cycles, which is what makes browsing HISTORY down a reporting
// line possible for people who were not in the open cycle, or in any.

import { useQuery } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { authedGet } from "@api/http";
import { httpRetry } from "@api/errors";
import { digiopsHeaders } from "@api/digiopsHeaders";
import { useAccessToken } from "@hooks/useAccessToken";
import { foldIdentityError, useAsgardeoSub } from "@hooks/useAsgardeoSub";
import { parServiceUrls } from "@config/apiConfig";
import { isParBackendConfigured } from "./useParMe";
import type { ParDirectoryEmployee } from "./parTypes";

export function useDirectoryReports(leadEmail: string | undefined, enabled = true) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;
  const ready = isSignedIn && isParBackendConfigured() && Boolean(userSub);

  const query = useQuery<ParDirectoryEmployee[]>({
    queryKey: ["par", "directory-reports", userSub, leadEmail],
    enabled: enabled && ready && Boolean(leadEmail),
    queryFn: async () =>
      (await authedGet<ParDirectoryEmployee[]>(
        parServiceUrls.employees(leadEmail as string),
        await getAccessToken(),
        digiopsHeaders(),
      )) ?? [],
    // Org structure, not user data: shared by everyone and rarely edited.
    staleTime: 10 * 60 * 1000,
    retry: httpRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

/**
 * Everybody who is somebody's manager, by email.
 *
 * The chain view offers a drill-down only for a person who BOTH carries the lead
 * flag and appears here — which is what the standalone app does, and the reason
 * matters: the flag alone is set for people who manage nobody, so gating on it
 * offers a drill into an empty level. An earlier version here checked only the
 * flag and showed "Their team" for members who had no team.
 *
 * It costs one fetch of the whole directory. That is what the standalone app
 * spends too, and org structure is shared and rarely edited, so it is held for
 * ten minutes like the rest of the reference data.
 */
export function useDirectoryManagers(enabled = true) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;
  const ready = isSignedIn && isParBackendConfigured() && Boolean(userSub);

  const query = useQuery<ReadonlySet<string>>({
    queryKey: ["par", "directory-managers", userSub],
    enabled: enabled && ready,
    queryFn: async () => {
      const everyone =
        (await authedGet<ParDirectoryEmployee[]>(
          parServiceUrls.employees(),
          await getAccessToken(),
          digiopsHeaders(),
        )) ?? [];
      const managers = new Set<string>();
      for (const person of everyone) {
        const email = person.managerEmail?.trim().toLowerCase();
        if (email) managers.add(email);
      }
      return managers;
    },
    staleTime: 10 * 60 * 1000,
    retry: httpRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

