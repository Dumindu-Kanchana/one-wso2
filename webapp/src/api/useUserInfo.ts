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

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { authedGet, HttpError } from "@api/http";
import { peopleBackendUrl, peopleServiceUrls } from "@config/apiConfig";

// Minimal shape returned by the people-app /user-info endpoint. Matches
// the fields we consume in the shell — the full type lives in
// features/my/api/types.ts (kept there so feature-scoped code doesn't
// have to reach into src/api for the whole DTO).
export interface UserInfoLite {
  id: number;
  employeeId: string;
  firstName: string;
  lastName: string;
  workEmail: string;
  employeeThumbnail: string | null;
  designation: string | null;
  privileges?: number[];
}

// Fire /user-info by itself — cheaper than the full useMeProfile chain
// (which also pulls /employees/{id} + /employees/{id}/personal-info) and
// safe to mount in the shell (TopBar) where we only need the display
// name. useMeProfile explicitly reads /user-info through this same query
// key via queryClient.fetchQuery, so the two hooks share cache — the
// endpoint hits the network only once per (sub, staleTime) window.
export function useUserInfo() {
  const { getIdToken, isSignedIn, getDecodedIdToken } = useAsgardeo();
  const [userSub, setUserSub] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!isSignedIn) {
      setUserSub(undefined);
      return;
    }
    let cancelled = false;
    getDecodedIdToken()
      .then((token) => {
        if (cancelled) return;
        const s = (token as { sub?: string } | null | undefined)?.sub;
        setUserSub(typeof s === "string" && s.length > 0 ? s : undefined);
      })
      .catch(() => {
        if (!cancelled) setUserSub(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, getDecodedIdToken]);

  return useQuery<UserInfoLite>({
    queryKey: ["user-info", userSub],
    enabled: isSignedIn && Boolean(peopleBackendUrl) && Boolean(userSub),
    queryFn: async () => {
      const idToken = await getIdToken();
      if (!idToken) throw new Error("No id_token available from Asgardeo");
      return authedGet<UserInfoLite>(peopleServiceUrls.userInfo, idToken);
    },
    staleTime: 5 * 60 * 1000,
    retry: (failureCount, error) => {
      if (error instanceof HttpError && error.status >= 400 && error.status < 500) return false;
      return failureCount < 1;
    },
  });
}
