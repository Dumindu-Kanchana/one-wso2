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

import { FileIcon, SearchIcon, type LucideIcon } from "@wso2/oxygen-ui-icons-react";

/**
 * What a tracked entry points at.
 *
 * Deliberately a discriminator from day one even though One WSO2 only produces
 * two of these today. csm-portal is scheduled to land here as a perspective
 * (see the reserved `csm` entry in @constants/perspectives), and it pins eight
 * kinds — case, project, account, incident, change_request, problem, plus its
 * own page/search. Adding those must be a matter of extending this union and
 * the registry below, not reshaping the store.
 */
export type PinKind =
  // A route with no query state — a nav destination.
  | "page"
  // A route plus filter/query state, so distinct filtered views pin separately.
  // Nothing in One WSO2 keeps filters in the URL yet; csm-portal does.
  | "search";

interface PinKindMeta {
  /** Plural heading, for grouping entries by kind once more than one exists. */
  label: string;
  icon: LucideIcon;
  /** Stable display order across groups. */
  order: number;
}

/**
 * Per-kind presentation, as a registry rather than a `switch`.
 *
 * csm-portal's equivalent (`kindMeta.tsx`) is a switch over its kinds, which is
 * fine in one app but becomes a shared chokepoint in a merged one — every new
 * domain would have to edit the same function. A record lets each domain
 * contribute its own entry, the way csm-portal's own `WIDGET_RESOURCE_CONFIG`
 * already does for dashboard widgets.
 */
export const PIN_KIND_META: Record<PinKind, PinKindMeta> = {
  page: { label: "Pages", icon: FileIcon, order: 10 },
  search: { label: "Searches", icon: SearchIcon, order: 20 },
};

/** Kinds in display order — for grouping, once a second kind is in play. */
export function pinKindsInOrder(): PinKind[] {
  return (Object.keys(PIN_KIND_META) as PinKind[]).sort(
    (a, b) => PIN_KIND_META[a].order - PIN_KIND_META[b].order,
  );
}

export function isPinKind(value: unknown): value is PinKind {
  return typeof value === "string" && value in PIN_KIND_META;
}
