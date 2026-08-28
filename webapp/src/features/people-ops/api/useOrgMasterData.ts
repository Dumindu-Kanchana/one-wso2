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

// The org master data behind the report filter drawer's dropdowns: business
// units, teams, sub-teams, units, career functions, designations, companies,
// offices and employment types.
//
// All nine are fetched together by useOrgMasterData and normalised to a
// single `{id, label}` option shape, because the raw payloads disagree about
// what the label field is called (`name` for most, `careerFunction` and
// `designation` for two). Normalising once here keeps that quirk out of the
// drawer, which would otherwise need a special case per dropdown.
//
// These lists are organisation structure: they change when HR restructures,
// not during a session. They are cached for 30 minutes and deliberately not
// invalidated by anything the reports do.

import { useQueries } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { authedGet, defaultQueryRetry } from "@api/http";
import { useAccessToken } from "@hooks/useAccessToken";
import { peopleBackendUrl, peopleServiceUrls } from "@config/apiConfig";
import { useAsgardeoSub } from "@hooks/useAsgardeoSub";
import type {
  BusinessUnit,
  CareerFunction,
  Company,
  Designation,
  EmploymentType,
  Office,
  OrgOption,
  SubTeam,
  Team,
  Unit,
} from "./peopleOpsTypes";

const MASTER_DATA_STALE_TIME = 30 * 60 * 1000;

// Sort options alphabetically by label, case-insensitively — mirrors
// people-app's sortAndFormatOptions, so a given dropdown lists its choices
// in the same order in both apps.
function toOptions<T>(
  rows: T[] | undefined,
  id: (row: T) => number,
  label: (row: T) => string,
): OrgOption[] {
  return (rows ?? [])
    .map((row) => ({ id: id(row), label: label(row) }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
}

export interface OrgMasterData {
  businessUnits: OrgOption[];
  teams: OrgOption[];
  subTeams: OrgOption[];
  units: OrgOption[];
  careerFunctions: OrgOption[];
  designations: OrgOption[];
  companies: OrgOption[];
  offices: OrgOption[];
  employmentTypes: OrgOption[];
  /** True until every list has resolved — the drawer shows them as loading. */
  isLoading: boolean;
  /** At least one list failed. The drawer still opens; that dropdown is empty. */
  isError: boolean;
}

export function useOrgMasterData(enabled = true): OrgMasterData {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;

  const ready =
    enabled && isSignedIn && Boolean(peopleBackendUrl) && Boolean(userSub);

  // One useQueries call rather than nine useQuery calls: the drawer wants a
  // single "are these ready?" answer, and this keeps that aggregation honest
  // as endpoints are added or removed.
  function listQuery<T>(key: string, url: string) {
    return {
      queryKey: ["people-ops", "org", key, userSub],
      enabled: ready,
      queryFn: async (): Promise<T[]> => {
        const accessToken = await getAccessToken();
        return authedGet<T[]>(url, accessToken);
      },
      staleTime: MASTER_DATA_STALE_TIME,
      retry: defaultQueryRetry,
    };
  }

  const results = useQueries({
    queries: [
      listQuery<BusinessUnit>("business-units", peopleServiceUrls.businessUnits),
      listQuery<Team>("teams", peopleServiceUrls.teams()),
      listQuery<SubTeam>("sub-teams", peopleServiceUrls.subTeams()),
      listQuery<Unit>("units", peopleServiceUrls.units()),
      listQuery<CareerFunction>("career-functions", peopleServiceUrls.careerFunctions),
      listQuery<Designation>("designations", peopleServiceUrls.designations()),
      listQuery<Company>("companies", peopleServiceUrls.companies),
      listQuery<Office>("offices", peopleServiceUrls.offices()),
      listQuery<EmploymentType>("employment-types", peopleServiceUrls.employmentTypes),
    ],
  });

  const [
    businessUnits,
    teams,
    subTeams,
    units,
    careerFunctions,
    designations,
    companies,
    offices,
    employmentTypes,
  ] = results;

  return {
    businessUnits: toOptions(
      businessUnits.data as BusinessUnit[] | undefined,
      (r) => r.id,
      (r) => r.name,
    ),
    teams: toOptions(teams.data as Team[] | undefined, (r) => r.id, (r) => r.name),
    subTeams: toOptions(subTeams.data as SubTeam[] | undefined, (r) => r.id, (r) => r.name),
    units: toOptions(units.data as Unit[] | undefined, (r) => r.id, (r) => r.name),
    // The two that don't call their label `name`.
    careerFunctions: toOptions(
      careerFunctions.data as CareerFunction[] | undefined,
      (r) => r.id,
      (r) => r.careerFunction,
    ),
    designations: toOptions(
      designations.data as Designation[] | undefined,
      (r) => r.id,
      (r) => r.designation,
    ),
    companies: toOptions(companies.data as Company[] | undefined, (r) => r.id, (r) => r.name),
    offices: toOptions(offices.data as Office[] | undefined, (r) => r.id, (r) => r.name),
    employmentTypes: toOptions(
      employmentTypes.data as EmploymentType[] | undefined,
      (r) => r.id,
      (r) => r.name,
    ),
    isLoading: ready && results.some((r) => r.isPending),
    isError: results.some((r) => r.isError),
  };
}
