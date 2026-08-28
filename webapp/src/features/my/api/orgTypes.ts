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
// Organisation reference data from the people-app backend — the option lists the
// My Team filters are built from.
//
// Source of truth: people-app's `modules/database/types.bal`. The shapes are NOT
// uniform, which is the reason this file exists: four records name their label
// `name`, one `careerFunction`, one `designation`, and the manager list has no
// label at all beyond an email. Two carry no `isActive`. Normalising once, at
// the boundary, keeps all of that out of the components — the source app leaked
// these field names into eleven separate filter configs.
//
// Note on isActive: the endpoints already exclude inactive rows by default
// (widening that is admin-only), so nothing here filters on it. Doing so would
// be a no-op that looks meaningful.

/** Business units, teams, sub teams and units all share this shape. */
export interface OrgStructureWire {
  id: number;
  name: string;
  headEmail?: string | null;
  isActive?: boolean;
  activeEmployeeCount?: number;
}

export interface CareerFunctionWire {
  id: number;
  careerFunction: string;
  isActive?: boolean;
}

export interface DesignationWire {
  id: number;
  designation: string;
  jobBand?: number | null;
  careerFunctionId?: number | null;
  isActive?: boolean;
}

/** No isActive on this one. */
export interface CompanyWire {
  id: number;
  name: string;
  prefix?: string | null;
  location?: string | null;
}

/** Nor this one. */
export interface OfficeWire {
  id: number;
  name: string;
  location?: string | null;
}

export interface EmploymentTypeWire {
  id: number;
  name: string;
  isActive?: boolean;
}

/** The manager list carries no display name — only an email. */
export interface ManagerWire {
  employeeId: string;
  workEmail: string;
}

/** What every filter control binds to, whatever the wire shape was. */
export interface OrgOption {
  id: number;
  label: string;
}

/** Managers are selected by email, not by id — kept visibly separate. */
export interface ManagerOption {
  email: string;
}

export interface OrgReference {
  businessUnits: OrgOption[];
  teams: OrgOption[];
  subTeams: OrgOption[];
  units: OrgOption[];
  careerFunctions: OrgOption[];
  designations: OrgOption[];
  companies: OrgOption[];
  offices: OrgOption[];
  employmentTypes: OrgOption[];
  managers: ManagerOption[];
  isLoading: boolean;
  isError: boolean;
}

/** Gender has no endpoint; the source hardcodes these three. */
export const GENDER_OPTIONS = ["Male", "Female", "Not Specified"] as const;
