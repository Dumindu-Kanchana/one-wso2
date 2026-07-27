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

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { authedDelete, authedGet, authedPost, HttpError } from "@api/http";
import { peopleBackendUrl, peopleServiceUrls } from "@config/apiConfig";
import type { NewVehiclePayload, VehiclesResponse } from "./types";

// people-app vehicle endpoints are keyed on the caller's email (backend
// enforces employeeEmail === userInfo.email in the JWT). We pass the
// caller's email in from the component — usually the workEmail from
// useUserInfo, or the id_token email claim. Both should match.

function vehiclesKey(email: string | undefined) {
  return ["me-vehicles", email] as const;
}

export function useVehicles(email: string | undefined) {
  const { getIdToken, isSignedIn } = useAsgardeo();
  const backendConfigured = Boolean(peopleBackendUrl);
  return useQuery<VehiclesResponse>({
    queryKey: vehiclesKey(email),
    enabled: isSignedIn && backendConfigured && Boolean(email),
    queryFn: async () => {
      const idToken = await getIdToken();
      if (!idToken) throw new Error("No id_token available from Asgardeo");
      // limit=100 is plenty — client-side pagination in the card is 2 at
      // a time. If a user ever has more than ~10 vehicles we can revisit.
      const url = `${peopleServiceUrls.employeeVehicles(email!)}?vehicleStatus=ACTIVE&limit=100`;
      return authedGet<VehiclesResponse>(url, idToken);
    },
    staleTime: 60 * 1000,
    retry: (failureCount, error) => {
      if (error instanceof HttpError && error.status >= 400 && error.status < 500) return false;
      return failureCount < 1;
    },
  });
}

export function useAddVehicle(email: string | undefined) {
  const { getIdToken } = useAsgardeo();
  const qc = useQueryClient();
  return useMutation<void, Error, NewVehiclePayload>({
    mutationFn: async (payload) => {
      if (!email) throw new Error("Missing owner email");
      const idToken = await getIdToken();
      if (!idToken) throw new Error("No id_token available from Asgardeo");
      await authedPost<void>(peopleServiceUrls.employeeVehicles(email), idToken, payload);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: vehiclesKey(email) });
    },
  });
}

export function useDeleteVehicle(email: string | undefined) {
  const { getIdToken } = useAsgardeo();
  const qc = useQueryClient();
  return useMutation<void, Error, number>({
    mutationFn: async (vehicleId) => {
      if (!email) throw new Error("Missing owner email");
      const idToken = await getIdToken();
      if (!idToken) throw new Error("No id_token available from Asgardeo");
      await authedDelete(peopleServiceUrls.employeeVehicle(email, vehicleId), idToken);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: vehiclesKey(email) });
    },
  });
}
