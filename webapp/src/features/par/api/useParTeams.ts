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


// Reads for a team lead's own teams within the open cycle.
//
// A lead can hold several teams — the structure is business unit / department /
// team / sub-team, and each combination they own is its own row with its own
// Top 5% / 20% quota. The list carries per-team completion counts; the members
// come from the per-team endpoint, so opening one team does not fetch the
// others' members.

import { useQuery } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { authedGet } from "@api/http";
import { httpRetry } from "@api/errors";
import { digiopsHeaders } from "@api/digiopsHeaders";
import { useAccessToken } from "@hooks/useAccessToken";
import { useAsgardeoUser } from "@hooks/useAsgardeoUser";
import { foldIdentityError, useAsgardeoSub } from "@hooks/useAsgardeoSub";
import { parServiceUrls } from "@config/apiConfig";
import { isParBackendConfigured } from "./useParMe";
import type { ParTeam, ParTeamReport } from "./parTypes";

const STALE = 60 * 1000;

function useBasis() {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const { email } = useAsgardeoUser();
  const userSub = subState.status === "ready" ? subState.sub : undefined;
  const ready = isSignedIn && isParBackendConfigured() && Boolean(userSub) && Boolean(email);
  return { getAccessToken, subState, retryIdentity, userSub, email, ready };
}

/**
 * The teams this lead owns in a cycle.
 *
 * Scoped by `leadEmail` deliberately: the same endpoint without it returns
 * every team in the cycle, which is the admin view.
 */
export function useMyParTeams(parCycleId: number | undefined) {
  const { getAccessToken, subState, retryIdentity, userSub, email, ready } = useBasis();
  const query = useQuery<ParTeam[]>({
    queryKey: ["par", "my-teams", userSub, parCycleId],
    enabled: ready && parCycleId !== undefined,
    queryFn: async () =>
      (await authedGet<ParTeam[]>(
        parServiceUrls.teams(parCycleId as number, email as string),
        await getAccessToken(),
        digiopsHeaders(),
      )) ?? [],
    staleTime: STALE,
    retry: httpRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

/**
 * One team with its members and remaining quota.
 *
 * `enabled` so members are fetched for the team actually being looked at.
 */
export function useParTeamReport(
  parCycleId: number | undefined,
  parTeamId: number | undefined,
  enabled = true,
) {
  const { getAccessToken, subState, retryIdentity, userSub, ready } = useBasis();
  const query = useQuery<ParTeamReport | undefined>({
    queryKey: ["par", "team-report", userSub, parCycleId, parTeamId],
    enabled: enabled && ready && parCycleId !== undefined && parTeamId !== undefined,
    queryFn: async () =>
      (await authedGet<ParTeamReport>(
        parServiceUrls.team(parCycleId as number, parTeamId as number),
        await getAccessToken(),
        digiopsHeaders(),
      )) ?? undefined,
    staleTime: STALE,
    retry: httpRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}
