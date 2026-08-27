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
// Who may see which PAR screen.
//
// PAR does NOT use people-app's privilege numbers, so `capabilitiesFromPrivileges`
// is the wrong tool here — it would grant or deny the wrong people. Roles come
// from two places instead:
//
//   ADMIN     → an Asgardeo group on the ID token, named per deployment
//   TEAM_LEAD → PAR's own employee record (useParMe)
//
// Only `isTeamLead` opens the lead screens. The `lead` flag beside it is a
// DIFFERENT thing and is not interchangeable: in the source it gates the chain
// view alone, and only together with a directory check that the person actually
// has reports. It is not an access signal for these screens, which is why this
// gate does not read it.
// See docs/ported-apps/par-app.md §2.
//
// Reading a group from the token is a compromise, not the house preference —
// Marketing Ops gates on what its backend returns and says of its own groups
// array "never gate on this". PAR has no equivalent: its `/user-privileges`
// endpoint is behind a disabled flag, carries a TODO, has no backend resource
// and is read by no component. The group is the only signal available.

import { useQuery } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { describeError } from "@api/errors";
import { useAsgardeoUser } from "@hooks/useAsgardeoUser";
import { foldIdentityError, useAsgardeoSub } from "@hooks/useAsgardeoSub";
import { parItemVisible } from "../util/parItems";
import { useParMe } from "./useParMe";

// Re-exported so the rail keeps importing "the PAR gate" as one thing, even
// though the decision itself lives in a module free of Asgardeo imports — see
// util/parItems.ts for why that split exists.
export { PAR_ITEM_IDS, parItemVisible } from "../util/parItems";
export type { ParRoles } from "../util/parItems";

export interface ParGate {
  canSee: (itemId: string) => boolean;
  isAdmin: boolean;
  isTeamLead: boolean;
  isResolving: boolean;
  isError: boolean;
  errorMessage?: string;
  retry: () => void;
}

export function useParGate(enabled = true): ParGate {
  const user = useAsgardeoUser();
  const groups = useIdTokenGroups(enabled);
  const me = useParMe(user.email, enabled);

  const adminGroup = window.config?.ONE_WSO2_PAR_ADMIN_GROUP ?? "";
  // An unset group name must not make everyone an admin.
  const isAdmin = adminGroup !== "" && groups.value.includes(adminGroup);
  const isTeamLead = Boolean(me.data?.isTeamLead);

  return {
    canSee: (itemId: string) => parItemVisible(itemId, { isAdmin, isTeamLead }),
    isAdmin,
    isTeamLead,
    // `isPending`, not `isLoading`: the window before the Asgardeo subject
    // resolves counts as still resolving. With `isLoading` that window reads as
    // a finished check with no access, flashing a denial on a cold load.
    //
    // BOTH sources have to land. Either one alone would let the other's answer
    // be read as "no", which is a denial shown to someone who does have access.
    isResolving: enabled && (me.isPending || groups.isPending),
    isError: me.isError || groups.isError,
    errorMessage: me.isError
      ? describeError(me.error)
      : groups.isError
        ? describeError(groups.error)
        : undefined,
    retry: () => {
      void me.refetch();
      void groups.refetch();
    },
  };
}

/**
 * The `groups` claim from the ID token.
 *
 * Decoding the token is the only path that works here: `useAsgardeo().user` is
 * populated only when profile fetching is enabled, which this app disables, and
 * `useAsgardeoUser` deliberately exposes just the display claims.
 *
 * A query rather than an effect writing state: the claim never changes for a
 * signed-in session, so it wants caching and a retry path, and the effect
 * version had to hand-roll both.
 *
 * Keyed on `sub` so a sign-out then a different sign-in in the same tab can't
 * serve the previous user's groups — which here would mean serving their
 * admin rights.
 */
function useIdTokenGroups(enabled: boolean) {
  const { isSignedIn, getDecodedIdToken } = useAsgardeo();
  const { state, retry: retryIdentity } = useAsgardeoSub();
  const userSub = state.status === "ready" ? state.sub : undefined;

  const query = useQuery<string[]>({
    queryKey: ["par", "id-token-groups", userSub],
    enabled: enabled && isSignedIn && Boolean(userSub),
    queryFn: async () => {
      const token = await getDecodedIdToken();
      const raw = (token as { groups?: unknown } | null | undefined)?.groups;
      // Asgardeo sends a bare string when the user is in exactly one group and
      // an array otherwise. Handling only the array would make a single-group
      // admin look like a non-admin.
      if (Array.isArray(raw)) return raw.filter((g): g is string => typeof g === "string");
      if (typeof raw === "string") return [raw];
      // No claim at all is a legitimate answer — most people are in no groups.
      return [];
    },
    staleTime: Infinity,
    // Nothing about a local decode gets better on a second attempt, and a
    // retry would only delay the error the shell needs to show.
    retry: false,
  });

  const folded = foldIdentityError(query, state, retryIdentity);
  return {
    value: folded.data ?? [],
    isPending: folded.isPending,
    isError: folded.isError,
    error: folded.error,
    refetch: folded.refetch,
  };
}
