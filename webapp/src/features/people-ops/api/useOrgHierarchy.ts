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

// The org hierarchy: reading the whole tree, and creating or editing the
// mappings that place one entity under another.
//
// The tree arrives in a single GET rather than a request per level. It is a
// few hundred nodes at most, and fetching per expansion would make the four
// columns pop in one after another as you drill down.
//
// On ids, because this is where mistakes would be silent: creating a team
// placement takes a business unit's ENTITY id, but creating a sub-team
// placement takes a business-unit-team's MAPPING id. Both are integers, so
// nothing catches a mix-up — see the payload types in peopleOpsTypes.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { authedGet, authedPatch, authedPost, defaultQueryRetry, HttpError } from "@api/http";
import { useAccessToken } from "@hooks/useAccessToken";
import { peopleBackendUrl, peopleServiceUrls } from "@config/apiConfig";
import { foldIdentityError, useAsgardeoSub } from "@hooks/useAsgardeoSub";
import type {
  CreateSubTeamMappingPayload,
  CreateTeamMappingPayload,
  CreateUnitMappingPayload,
  MappingLevel,
  OrgChartBusinessUnit,
  UpdateMappingPayload,
} from "./peopleOpsTypes";

const HIERARCHY_KEY = ["people-ops", "org-hierarchy"];

// A 403 is a settled "you are not an admin", not a transient failure.
function hierarchyRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof HttpError && error.status === 403) return false;
  return defaultQueryRetry(failureCount, error);
}

// GET /company-org-structure — the whole tree.
export function useOrgHierarchy(enabled = true) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;

  const query = useQuery<OrgChartBusinessUnit[]>({
    queryKey: [...HIERARCHY_KEY, userSub],
    enabled: enabled && isSignedIn && Boolean(peopleBackendUrl) && Boolean(userSub),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<OrgChartBusinessUnit[]>(
        peopleServiceUrls.companyOrgStructure,
        accessToken,
      );
    },
    staleTime: 60 * 1000,
    retry: hierarchyRetry,
  });

  return foldIdentityError(query, subState, retryIdentity);
}

// Awaited refetch, not a fire-and-forget invalidate: this app sets
// refetchOnMount: false globally, so marking the tree stale would not put the
// new placement on screen. Awaiting also keeps the dialog's spinner up until
// the columns hold real data.
function useRefreshHierarchy() {
  const qc = useQueryClient();
  return async () => {
    await qc.refetchQueries({ queryKey: HIERARCHY_KEY });
  };
}

// Per-level wiring for the three mapping collections. One table rather than
// six near-identical hooks — the levels differ only in URL and payload shape.
const MAPPING_URLS: Record<
  MappingLevel,
  { collection: string; item: (mappingId: number) => string }
> = {
  team: {
    collection: peopleServiceUrls.businessUnitTeams,
    item: peopleServiceUrls.businessUnitTeam,
  },
  subTeam: {
    collection: peopleServiceUrls.businessUnitTeamSubTeams,
    item: peopleServiceUrls.businessUnitTeamSubTeam,
  },
  unit: {
    collection: peopleServiceUrls.businessUnitTeamSubTeamUnits,
    item: peopleServiceUrls.businessUnitTeamSubTeamUnit,
  },
};

// The payload shape is per-level, so the caller builds it and this just posts
// it — typed as a union so a caller cannot hand a unit payload to the team
// endpoint.
export type CreateMappingPayload =
  | CreateTeamMappingPayload
  | CreateSubTeamMappingPayload
  | CreateUnitMappingPayload;

// POST a placement: put an existing entity under a parent.
export function useCreateMapping(level: MappingLevel) {
  const getAccessToken = useAccessToken();
  const refresh = useRefreshHierarchy();

  return useMutation<unknown, Error, CreateMappingPayload>({
    mutationFn: async (payload) => {
      const accessToken = await getAccessToken();
      return authedPost<unknown>(MAPPING_URLS[level].collection, accessToken, payload);
    },
    onSuccess: refresh,
  });
}

// PATCH a placement: its functional head, or whether the placement is active.
//
// Deactivating a MAPPING removes the entity from this branch without touching
// the entity, which stays available everywhere else it is placed.
export function useUpdateMapping(level: MappingLevel) {
  const getAccessToken = useAccessToken();
  const refresh = useRefreshHierarchy();

  return useMutation<
    unknown,
    Error,
    { mappingId: number; payload: UpdateMappingPayload }
  >({
    mutationFn: async ({ mappingId, payload }) => {
      const accessToken = await getAccessToken();
      return authedPatch<unknown>(MAPPING_URLS[level].item(mappingId), accessToken, payload);
    },
    onSuccess: refresh,
  });
}
