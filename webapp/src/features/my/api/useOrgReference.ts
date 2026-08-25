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
// The filter option lists, as one hook.
//
// Two reasons this is a single `useQueries` rather than ten hooks:
//
//  - The cascade comes for free. The five narrowable lists are the same query
//    entries with a parent id folded into the key, so choosing a Business Unit
//    simply changes a key and React Query fetches the narrowed list — while the
//    unnarrowed one stays cached. That is what makes the hierarchy real; in the
//    source app it was decorative, every list being the full set, so you could
//    combine a Team with an unrelated Business Unit and get nothing.
//  - One loading flag and one error for the whole dialog, instead of nine.
//
// `enabled` matters as much as either: nothing is fetched until the filter
// dialog has actually been opened. The source app fired all ten requests on
// page load, for everyone, including people who never filter.

import { useQueries } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { authedGet } from "@api/http";
import { httpRetry } from "@api/errors";
import { useAccessToken } from "@hooks/useAccessToken";
import { peopleServiceUrls } from "@config/apiConfig";
import { isPeopleBackendConfigured } from "./useMeProfile";
import type {
  CareerFunctionWire,
  CompanyWire,
  DesignationWire,
  EmploymentTypeWire,
  ManagerOption,
  ManagerWire,
  OfficeWire,
  OrgOption,
  OrgReference,
  OrgStructureWire,
} from "./orgTypes";

/** Which parents are currently chosen, so the dependent lists can narrow. */
export interface OrgSelection {
  businessUnitId: number | null;
  teamId: number | null;
  subTeamId: number | null;
  careerFunctionId: number | null;
  companyId: number | null;
}

const ORG = ["people", "org"] as const;

// Taxonomy, not user data: shared by everyone and rarely edited. NOT sub-scoped,
// so it survives an account switch. The long gcTime is the load-bearing half —
// the app-wide client sets refetchOnMount: false, so at the default gcTime the
// whole set would be collected on unmount and refetched on every reopen.
const STALE = 12 * 60 * 60 * 1000;
const GC = 24 * 60 * 60 * 1000;

const byLabel = (a: OrgOption, b: OrgOption) =>
  a.label.localeCompare(b.label, undefined, { sensitivity: "base" });

export function useOrgReference(selection: OrgSelection, enabled: boolean): OrgReference {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const ready = enabled && isSignedIn && isPeopleBackendConfigured();

  const get = async <T>(url: string): Promise<T> => authedGet<T>(url, await getAccessToken());

  const base = { enabled: ready, staleTime: STALE, gcTime: GC, retry: httpRetry };

  return useQueries({
    queries: [
      {
        ...base,
        queryKey: [...ORG, "business-units"],
        queryFn: () => get<OrgStructureWire[]>(peopleServiceUrls.businessUnits),
      },
      {
        ...base,
        // The parent id in the key IS the cascade.
        queryKey: [...ORG, "teams", selection.businessUnitId ?? "all"],
        queryFn: () =>
          get<OrgStructureWire[]>(peopleServiceUrls.teams(selection.businessUnitId ?? undefined)),
      },
      {
        ...base,
        queryKey: [...ORG, "sub-teams", selection.teamId ?? "all"],
        queryFn: () =>
          get<OrgStructureWire[]>(peopleServiceUrls.subTeams(selection.teamId ?? undefined)),
      },
      {
        ...base,
        queryKey: [...ORG, "units", selection.subTeamId ?? "all"],
        queryFn: () =>
          get<OrgStructureWire[]>(peopleServiceUrls.units(selection.subTeamId ?? undefined)),
      },
      {
        ...base,
        queryKey: [...ORG, "career-functions"],
        queryFn: () => get<CareerFunctionWire[]>(peopleServiceUrls.careerFunctions),
      },
      {
        ...base,
        queryKey: [...ORG, "designations", selection.careerFunctionId ?? "all"],
        queryFn: () =>
          get<DesignationWire[]>(
            peopleServiceUrls.designations(selection.careerFunctionId ?? undefined),
          ),
      },
      {
        ...base,
        queryKey: [...ORG, "companies"],
        queryFn: () => get<CompanyWire[]>(peopleServiceUrls.companies),
      },
      {
        ...base,
        queryKey: [...ORG, "offices", selection.companyId ?? "all"],
        queryFn: () => get<OfficeWire[]>(peopleServiceUrls.offices(selection.companyId ?? undefined)),
      },
      {
        ...base,
        queryKey: [...ORG, "employment-types"],
        queryFn: () => get<EmploymentTypeWire[]>(peopleServiceUrls.employmentTypes),
      },
      {
        ...base,
        // Org-wide, not scoped to the caller's chain — see the spec's §8. Most
        // selections will therefore match nobody, and the empty state says so.
        queryKey: [...ORG, "managers"],
        queryFn: () => get<ManagerWire[]>(peopleServiceUrls.managers),
      },
    ],
    // Normalise every differently-shaped record to {id, label} once, here, so no
    // component ever sees `careerFunction` or `designation` as a field name.
    combine: (results) => {
      const named = (i: number): OrgOption[] =>
        ((results[i].data as OrgStructureWire[] | undefined) ?? [])
          .map((r) => ({ id: r.id, label: r.name }))
          .sort(byLabel);

      return {
        businessUnits: named(0),
        teams: named(1),
        subTeams: named(2),
        units: named(3),
        careerFunctions: ((results[4].data as CareerFunctionWire[] | undefined) ?? [])
          .map((r) => ({ id: r.id, label: r.careerFunction }))
          .sort(byLabel),
        designations: ((results[5].data as DesignationWire[] | undefined) ?? [])
          .map((r) => ({ id: r.id, label: r.designation }))
          .sort(byLabel),
        companies: named(6),
        offices: named(7),
        employmentTypes: named(8),
        managers: (((results[9].data as ManagerWire[] | undefined) ?? [])
          .map((r) => ({ email: r.workEmail }))
          .sort((a, b) => a.email.localeCompare(b.email)) satisfies ManagerOption[]),
        isLoading: results.some((r) => r.isLoading),
        isError: results.some((r) => r.isError),
      };
    },
  });
}
