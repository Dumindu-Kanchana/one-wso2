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

import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { authedGet, HttpError } from "@api/http";
import { peopleBackendUrl, peopleServiceUrls } from "@config/apiConfig";
import type { Employee, EmployeePersonalInfo, UserInfo } from "./types";

// Re-export HttpError for existing feature-scoped consumers that still
// import it from here. Prefer importing from @api/http directly.
export { HttpError };

export interface MeProfile {
  userInfo: UserInfo;
  employee: Employee;
  personalInfo: EmployeePersonalInfo;
}

// Resolves the current Asgardeo user's `sub` claim. Used as an identity
// discriminator in downstream query keys so a sign-out→different-user
// sign-in in the same tab can't briefly serve the previous user's cached
// data. We can't use useAsgardeo().user for this — that field is only
// populated when preferences.user.fetchUserProfile is true (we disable it)
// or on the AsgardeoV2 platform (our tenant isn't). Decoding the id_token
// via the SDK is the one path that always works.
//
// Returns a three-state value so the caller can distinguish loading
// ({status: "loading"}), success ({status: "ready", sub}), and terminal
// failure ({status: "error", message}). Callers surface the error state
// in the UI instead of leaving the downstream query silently disabled.
type SubState =
  | { status: "loading" }
  | { status: "ready"; sub: string }
  | { status: "error"; message: string };

// A tick counter drives the identity-resolution effect: bumping it re-runs
// getDecodedIdToken() so a user-visible "Retry" can recover from a decode
// error without having to sign out and back in.
function useAsgardeoSub(): { state: SubState; retry: () => void } {
  const { isSignedIn, getDecodedIdToken } = useAsgardeo();
  const [state, setState] = useState<SubState>({ status: "loading" });
  const [retryTick, setRetryTick] = useState(0);
  const retry = useCallback(() => setRetryTick((n) => n + 1), []);

  useEffect(() => {
    if (!isSignedIn) {
      setState({ status: "loading" });
      return;
    }
    let cancelled = false;
    setState({ status: "loading" });
    getDecodedIdToken()
      .then((token) => {
        if (cancelled) return;
        const s = (token as { sub?: string } | null | undefined)?.sub;
        if (typeof s === "string" && s.length > 0) {
          setState({ status: "ready", sub: s });
        } else {
          setState({
            status: "error",
            message: "Signed in, but the identity token has no `sub` claim.",
          });
        }
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        setState({ status: "error", message: `Couldn't decode identity token: ${msg}` });
      });
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, getDecodedIdToken, retryTick]);

  return { state, retry };
}

// Two-step fetch that mirrors people-app's own me flow:
//   1. GET /user-info                 → employeeId (from the JWT identity)
//   2. GET /employees/{id}            → org / role / employment record
//      GET /employees/{id}/personal-info → contact + emergency contacts
// Steps 2 and 3 run in parallel once employeeId is known.
export function useMeProfile() {
  const { getIdToken, isSignedIn } = useAsgardeo();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const qc = useQueryClient();
  const userSub = subState.status === "ready" ? subState.sub : undefined;
  const backendConfigured = Boolean(peopleBackendUrl);
  const identityError = subState.status === "error" ? subState.message : null;

  const query = useQuery<MeProfile>({
    // userSub is part of the key so cached data is scoped per-user — no
    // brief cross-user leak on account switch in the same tab.
    queryKey: ["me-profile", userSub],
    enabled: isSignedIn && backendConfigured && Boolean(userSub),
    queryFn: async () => {
      const idToken = await getIdToken();
      if (!idToken) throw new Error("No id_token available from Asgardeo");

      // Share the ["user-info", sub] cache slot with useUserInfo (the
      // TopBar's avatar reader). Without this, both hooks would issue an
      // independent GET /user-info on the same page load — React Query
      // only dedupes within a query key, not across separate authedGet
      // calls. fetchQuery populates + returns the cached value.
      const userInfo = await qc.fetchQuery<UserInfo>({
        queryKey: ["user-info", userSub],
        queryFn: () => authedGet<UserInfo>(peopleServiceUrls.userInfo, idToken),
        staleTime: 5 * 60 * 1000,
      });
      const [employee, personalInfo] = await Promise.all([
        authedGet<Employee>(peopleServiceUrls.employee(userInfo.employeeId), idToken),
        authedGet<EmployeePersonalInfo>(
          peopleServiceUrls.employeePersonalInfo(userInfo.employeeId),
          idToken,
        ),
      ]);
      return { userInfo, employee, personalInfo };
    },
    // Profile changes rarely — fetch once per session, don't retry on
    // 4xx (usually a token / role problem, not a transient failure).
    staleTime: 5 * 60 * 1000,
    retry: (failureCount, error) => {
      if (error instanceof HttpError && error.status >= 400 && error.status < 500) return false;
      return failureCount < 1;
    },
  });

  // Fold identity resolution failures into the query result so the page
  // renders a real error (with a retry path) instead of getting stuck on
  // the loading skeleton. Identity errors take precedence — if the JWT
  // subject is unresolvable, the /user-info call would fail anyway.
  //
  // We override `refetch` on the synthetic result: React Query's own
  // refetch ignores `enabled: false` and would fire the profile query
  // with key ["me-profile", undefined], bypassing the per-user cache
  // scoping. The right retry here re-runs identity resolution — if the
  // decode then succeeds, `enabled` flips true and the profile query
  // starts naturally; if it still fails, the user sees the same error
  // with a fresh chance to retry.
  //
  // The synthetic result doesn't match React Query's discriminated union
  // exactly (the four *Result variants have exclusive boolean flags), so
  // we cast through unknown; the consumer only reads isError + error +
  // isLoading + refetch, and this shape sets those consistently.
  if (identityError && !query.isError) {
    const synthetic = {
      ...query,
      isError: true,
      isPending: false,
      isLoading: false,
      isSuccess: false,
      isFetching: false,
      status: "error" as const,
      error: new Error(identityError),
      refetch: (async () => {
        retryIdentity();
        return query;
      }) as typeof query.refetch,
    };
    return synthetic as unknown as typeof query;
  }
  return query;
}

export function isPeopleBackendConfigured(): boolean {
  return Boolean(peopleBackendUrl);
}
