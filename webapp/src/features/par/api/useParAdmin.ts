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


// Reads and writes for PAR administration.
//
// The admin screen is a state machine over the cycle's status, so it queries by
// status rather than by employee: at most one cycle is PENDING, PENDING_QUOTA or
// OPEN at a time, and which one exists decides the whole screen.
//
// `PENDING` is the interesting one. Creating a cycle kicks off a backend job, so
// the cycle sits at PENDING until it finishes — the standalone app polls that
// list every ten seconds and stops when it empties. Reproduced here, including
// the consequence recorded in §9.3: a job that throws sets FAILED, which no
// screen queries, so the poll simply stops and the screen offers to create a
// cycle that the still-occupied slot will refuse.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { authedGet, authedPatch, authedPost, authedPut } from "@api/http";
import { httpRetry } from "@api/errors";
import { digiopsHeaders } from "@api/digiopsHeaders";
import { useAccessToken } from "@hooks/useAccessToken";
import { foldIdentityError, useAsgardeoSub } from "@hooks/useAsgardeoSub";
import { parServiceUrls, type ParCycleStatusQuery } from "@config/apiConfig";
import { isParBackendConfigured } from "./useParMe";
import type {
  ParCycle,
  ParCycleConfigurations,
  ParQuotaGroupDraft,
  ParQuotaTeam,
  ParRating,
  ParTeam,
} from "./parTypes";

/** How often the standalone app re-checks a cycle that is still being created. */
export const PENDING_POLL_MS = 10_000;

function useBasis() {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;
  const ready = isSignedIn && isParBackendConfigured() && Boolean(userSub);
  return { getAccessToken, subState, retryIdentity, userSub, ready };
}

/**
 * Every cycle in a given status, org-wide.
 *
 * `refetchMs` drives the PENDING poll. Left undefined the query is static.
 */
export function useCyclesByStatus(
  status: ParCycleStatusQuery,
  options: { enabled?: boolean; pollWhileNonEmpty?: boolean } = {},
) {
  const { enabled = true, pollWhileNonEmpty = false } = options;
  const { getAccessToken, subState, retryIdentity, userSub, ready } = useBasis();
  const query = useQuery<ParCycle[]>({
    queryKey: ["par", "admin-cycles", userSub, status],
    enabled: enabled && ready,
    queryFn: async () =>
      (await authedGet<ParCycle[]>(
        parServiceUrls.parCyclesByStatus(status),
        await getAccessToken(),
        digiopsHeaders(),
      )) ?? [],
    // A function, not a number: the poll has to stop when the list empties, and
    // that is a property of the data rather than of the caller. Three separate
    // queries to work out whether to poll — which is where this started — was
    // both slower and wrong, since they could disagree.
    refetchInterval: pollWhileNonEmpty
      ? (query) => ((query.state.data ?? []).length > 0 ? PENDING_POLL_MS : false)
      : undefined,
    staleTime: pollWhileNonEmpty ? 0 : 30 * 1000,
    retry: httpRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

/** One cycle by id, for the history view. */
export function useCycleById(parCycleId: number | undefined, enabled = true) {
  const { getAccessToken, subState, retryIdentity, userSub, ready } = useBasis();
  const query = useQuery<ParCycle | undefined>({
    queryKey: ["par", "admin-cycle", userSub, parCycleId],
    enabled: enabled && ready && parCycleId !== undefined,
    queryFn: async () =>
      (await authedGet<ParCycle>(
        parServiceUrls.parCycle(parCycleId as number),
        await getAccessToken(),
        digiopsHeaders(),
      )) ?? undefined,
    staleTime: 5 * 60 * 1000,
    retry: httpRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

/** The org-wide default configuration, applied to FUTURE cycles only. */
export function useGlobalConfigurations(enabled = true) {
  const { getAccessToken, subState, retryIdentity, userSub, ready } = useBasis();
  const query = useQuery<ParCycleConfigurations | undefined>({
    queryKey: ["par", "global-config", userSub],
    enabled: enabled && ready,
    queryFn: async () =>
      (await authedGet<ParCycleConfigurations>(
        parServiceUrls.metaConfigurations,
        await getAccessToken(),
        digiopsHeaders(),
      )) ?? undefined,
    staleTime: 5 * 60 * 1000,
    retry: httpRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

function useAdminInvalidation() {
  const qc = useQueryClient();
  const { userSub } = useBasis();
  return async () => {
    await qc.invalidateQueries({ queryKey: ["par", "admin-cycles", userSub] });
  };
}

/** PUT the org-wide defaults. Affects future cycles, never the open one. */
export function useSaveGlobalConfigurations() {
  const { getAccessToken, userSub } = useBasis();
  const qc = useQueryClient();
  return useMutation<void, Error, ParCycleConfigurations>({
    mutationFn: async (config) => {
      await authedPut<unknown>(
        parServiceUrls.metaConfigurations,
        await getAccessToken(),
        config,
        digiopsHeaders(),
      );
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["par", "global-config", userSub] });
    },
  });
}

/** POST a new cycle. The backend then runs a job; the cycle sits at PENDING. */
export function useCreateParCycle() {
  const { getAccessToken } = useBasis();
  const invalidate = useAdminInvalidation();
  return useMutation<void, Error, Record<string, unknown>>({
    mutationFn: async (payload) => {
      await authedPost<unknown>(
        parServiceUrls.createParCycle,
        await getAccessToken(),
        payload,
        digiopsHeaders(),
      );
    },
    onSuccess: invalidate,
  });
}

/** PATCH a cycle's own fields — deadlines, questions, ratings. */
export function useUpdateParCycle() {
  const { getAccessToken } = useBasis();
  const invalidate = useAdminInvalidation();
  return useMutation<void, Error, { parCycleId: number; values: Record<string, unknown> }>({
    mutationFn: async ({ parCycleId, values }) => {
      await authedPatch<unknown>(
        parServiceUrls.parCycle(parCycleId),
        await getAccessToken(),
        values,
        digiopsHeaders(),
      );
    },
    onSuccess: invalidate,
  });
}

/**
 * Move a cycle's status.
 *
 * The same PATCH as above with only the status — the standalone app has separate
 * thunks for opening and closing, and both send just `parCycleStatus`.
 */
export function useSetParCycleStatus() {
  const { getAccessToken } = useBasis();
  const invalidate = useAdminInvalidation();
  return useMutation<void, Error, { parCycleId: number; parCycleStatus: "OPEN" | "CLOSED" }>({
    mutationFn: async ({ parCycleId, parCycleStatus }) => {
      await authedPatch<unknown>(
        parServiceUrls.parCycle(parCycleId),
        await getAccessToken(),
        { parCycleStatus },
        digiopsHeaders(),
      );
    },
    onSuccess: invalidate,
  });
}

/** The teams in a cycle that have not been put in a quota group yet. */
export function useUngroupedQuotaTeams(parCycleId: number | undefined, enabled = true) {
  const { getAccessToken, subState, retryIdentity, userSub, ready } = useBasis();
  const query = useQuery<ParQuotaTeam[]>({
    queryKey: ["par", "quota-teams", userSub, parCycleId],
    enabled: enabled && ready && parCycleId !== undefined,
    queryFn: async () =>
      (await authedGet<ParQuotaTeam[]>(
        parServiceUrls.specialRatingGroups(parCycleId as number),
        await getAccessToken(),
        digiopsHeaders(),
      )) ?? [],
    staleTime: 30 * 1000,
    retry: httpRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

/**
 * Save the whole grouping in ONE call.
 *
 * There is no per-group endpoint, which is what makes §9.4 true: the grouping
 * lives in browser state until this succeeds, and a refresh before then loses
 * it. Reproduced, because splitting it would need a backend that accepts parts.
 */
export function useSaveQuotaGroups() {
  const { getAccessToken, userSub } = useBasis();
  const qc = useQueryClient();
  return useMutation<
    void,
    Error,
    { parCycleId: number; groups: readonly ParQuotaGroupDraft[] }
  >({
    mutationFn: async ({ parCycleId, groups }) => {
      await authedPost<unknown>(
        parServiceUrls.saveSpecialRatingGroupsQuota(parCycleId),
        await getAccessToken(),
        {
          parCycleId,
          // Shaped as the source sends it: the group's identity plus the teams
          // that belong to it, one row per team.
          parSpecialRatingGroups: groups.flatMap((g, index) =>
            g.teams.map((t) => ({
              parCycleId,
              specialRatingGroupId: t.specialRatingGroupId,
              businessUnit: t.businessUnit,
              department: t.department,
              team: t.team,
              specialRatingQuotaId: index + 1,
            })),
          ),
          specialRatingQuotas: groups.map((g, index) => ({
            specialRatingQuotaId: index + 1,
            specialRatingQuotaName: g.name,
            top5pQuota: g.top5Quota,
            top20pQuota: g.top20Quota,
            allocatedLeads: [],
          })),
        },
        digiopsHeaders(),
      );
    },
    onSuccess: async (_data, { parCycleId }) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["par", "quota-teams", userSub, parCycleId] }),
        qc.invalidateQueries({ queryKey: ["par", "admin-cycles", userSub] }),
      ]);
    },
  });
}

/** Every team in a cycle, org-wide — the same endpoint without a lead scope. */
export function useAllCycleTeams(parCycleId: number | undefined, enabled = true) {
  const { getAccessToken, subState, retryIdentity, userSub, ready } = useBasis();
  const query = useQuery<ParTeam[]>({
    queryKey: ["par", "admin-teams", userSub, parCycleId],
    enabled: enabled && ready && parCycleId !== undefined,
    queryFn: async () =>
      (await authedGet<ParTeam[]>(
        parServiceUrls.teams(parCycleId as number),
        await getAccessToken(),
        digiopsHeaders(),
      )) ?? [],
    staleTime: 60 * 1000,
    retry: httpRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

/** Every participant's PAR in a cycle — the report the admin screen shows. */
export function useCycleParRatings(parCycleId: number | undefined, enabled = true) {
  const { getAccessToken, subState, retryIdentity, userSub, ready } = useBasis();
  const query = useQuery<ParRating[]>({
    queryKey: ["par", "admin-ratings", userSub, parCycleId],
    enabled: enabled && ready && parCycleId !== undefined,
    queryFn: async () =>
      (await authedGet<ParRating[]>(
        parServiceUrls.cycleParRatings(parCycleId as number),
        await getAccessToken(),
        digiopsHeaders(),
      )) ?? [],
    staleTime: 60 * 1000,
    retry: httpRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

/** Which bulk reminder to send. All four are PATCH with no body. */
export type ParReminderKind = "employees" | "leads" | "specialRating" | "threeSixty";

export const PAR_REMINDER_LABELS: Record<ParReminderKind, string> = {
  employees: "Employees who haven't shared their PAR",
  leads: "Leads who haven't shared their review",
  specialRating: "Leads who haven't finalised Top 5% / 20%",
  threeSixty: "Colleagues who owe 360° feedback",
};

const REMINDER_URLS: Record<ParReminderKind, string> = {
  employees: parServiceUrls.remindEmployees,
  leads: parServiceUrls.remindLeads,
  specialRating: parServiceUrls.remindSpecialRating,
  threeSixty: parServiceUrls.remindThreeSixty,
};

/**
 * Send one bulk reminder.
 *
 * PATCH with no body — the server decides who is outstanding, which is why
 * there is nothing to pass and nothing to invalidate.
 *
 * Only four of the six reminder endpoints are reachable from any screen; the
 * other two run on server crons that are disabled by default (§9.5). Not
 * surfaced here either, for the same reason: a button whose effect is governed
 * by a disabled cron is worse than no button.
 */
export function useSendParReminder() {
  const { getAccessToken } = useBasis();
  return useMutation<void, Error, ParReminderKind>({
    mutationFn: async (kind) => {
      await authedPatch<unknown>(
        REMINDER_URLS[kind],
        await getAccessToken(),
        {},
        digiopsHeaders(),
      );
    },
  });
}
