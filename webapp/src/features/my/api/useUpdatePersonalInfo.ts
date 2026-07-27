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

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { authedPatch } from "@api/http";
import { peopleServiceUrls } from "@config/apiConfig";
import type { UpdatePersonalInfoPayload } from "./types";

// PATCH /employees/{employeeId}/personal-info. On success, awaits the
// me-profile refetch so the parent re-renders with fresh data BEFORE
// per-call onSuccess handlers flip editing off — without the await,
// PersonalInfo / EmergencyContacts briefly re-seeded their form from
// the stale `initial` snapshot, flashing pre-save values in read mode.
//
// Also invalidates ["user-info"] — safe today (nothing this payload
// writes overlaps with UserProfileMenu's display fields) and a cheap
// hedge against a future extension adding e.g. a thumbnail upload.
export function useUpdatePersonalInfo(employeeId: string | undefined) {
  const { getIdToken } = useAsgardeo();
  const qc = useQueryClient();
  return useMutation<void, Error, UpdatePersonalInfoPayload>({
    mutationFn: async (payload) => {
      if (!employeeId) throw new Error("Missing employeeId");
      const idToken = await getIdToken();
      if (!idToken) throw new Error("No id_token available from Asgardeo");
      await authedPatch<void>(
        peopleServiceUrls.employeePersonalInfo(employeeId),
        idToken,
        payload,
      );
    },
    onSuccess: async () => {
      // React Query awaits Promise-returning onSuccess handlers before
      // firing per-call ones. Both invalidations run in parallel; both
      // must resolve before the caller thinks the save is "done".
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["me-profile"] }),
        qc.invalidateQueries({ queryKey: ["user-info"] }),
      ]);
    },
  });
}
