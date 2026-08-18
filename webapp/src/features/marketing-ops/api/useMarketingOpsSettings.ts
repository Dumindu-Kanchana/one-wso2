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

// The marketing-editable parameter lists behind the two utilities.
//
// Marketing Ops did this with a hand-rolled module-level cache plus an
// `invalidateParameterLists()` function that consumers had to remember to call
// after a write. This is the same behaviour expressed as TanStack Query, which
// One WSO2 already uses for all server state (§11 of the migration findings):
// the cache, the dedupe, the once-per-session staleness and the
// invalidate-after-write all come from the query client instead of being
// maintained by hand. The `invalidateParameterLists` export disappears with it —
// mutations invalidate their own query keys.
//
// Two audiences, two shapes, which is why there are two sets of hooks:
//
//   CONSUMERS (the generators) want mapped, enabled-only data in the shape the
//   pure builders expect, and must never break — so they fall back to the
//   hardcoded SCHEMA/GENERATORS while loading or on error.
//
//   ADMINS (the Marketing Admin panels) want the raw lists including DISABLED
//   values, ids and sort order, because that's what they're editing. They must
//   NOT fall back silently: an admin editing a fallback list would "save" values
//   the backend never sent, wiping whatever was really there.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { authedGet, authedPut } from "@api/http";
import { httpRetry } from "@api/errors";
import { useAccessToken } from "@hooks/useAccessToken";
import {
  isMarketingOpsBackendConfigured,
  marketingOpsServiceUrls,
} from "@config/apiConfig";
import { SCHEMA as FALLBACK_SCHEMA, type Pair } from "../utilities/utm";
import { GENERATORS as FALLBACK_GENERATORS, type Generator } from "../utilities/assetName";

// ---- wire shapes -----------------------------------------------------------

export interface UtmValueDTO {
  id: string;
  label: string;
  code: string;
  enabled: boolean;
  sort_order: number;
}
export interface UtmListDTO {
  parameter: string;
  values: UtmValueDTO[];
}
export interface AssetValueDTO {
  id: string;
  value: string;
  enabled: boolean;
  sort_order: number;
}
export interface AssetListDTO {
  asset_type: string;
  field: string;
  values: AssetValueDTO[];
}

// Write payloads. Note there is no `id` and no `sort_order`: the PUT replaces
// the whole list, so position in the array IS the order, and the backend
// reassigns ids. Sending them would imply a partial update the API doesn't do.
export interface UtmEntry {
  label: string;
  code: string;
  enabled: boolean;
}
export interface AssetEntry {
  value: string;
  enabled: boolean;
}

export type UtmSchema = typeof FALLBACK_SCHEMA;

// ---- query keys ------------------------------------------------------------
//
// Shared between the consumer hooks, the admin hooks and the mutations, so a
// save refreshes every reader of that list. Not keyed per-user: these are
// org-wide settings, identical for everyone, unlike /api/me.
const KEY = {
  utm: ["marketing-ops", "settings", "utm"] as const,
  assetName: ["marketing-ops", "settings", "asset-name"] as const,
};

// ---- raw reads (admin panels) ---------------------------------------------

// GET /api/settings/utm — full lists, disabled values included.
export function useUtmLists() {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  return useQuery<UtmListDTO[]>({
    queryKey: KEY.utm,
    enabled: isSignedIn && isMarketingOpsBackendConfigured(),
    queryFn: async () =>
      authedGet<UtmListDTO[]>(marketingOpsServiceUrls.settingsUtm, await getAccessToken()),
    staleTime: 5 * 60 * 1000,
    retry: httpRetry,
  });
}

// GET /api/settings/asset-name — full lists, disabled values included.
export function useAssetNameLists() {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  return useQuery<AssetListDTO[]>({
    queryKey: KEY.assetName,
    enabled: isSignedIn && isMarketingOpsBackendConfigured(),
    queryFn: async () =>
      authedGet<AssetListDTO[]>(marketingOpsServiceUrls.settingsAssetName, await getAccessToken()),
    staleTime: 5 * 60 * 1000,
    retry: httpRetry,
  });
}

// ---- mapped reads (the generators) ----------------------------------------

// API lists → the SCHEMA shape the UTM builder expects, enabled values only.
function mapUtm(lists: UtmListDTO[]): UtmSchema {
  const out: UtmSchema = { source: [], medium: [], region: [], bu: [] };
  // Which parameters the response actually CARRIED, as opposed to which came back
  // with values. The fallback used to trigger on an empty list, which conflated two
  // different things: "the API didn't send this parameter" and "an admin retired
  // every value in it". The second is a decision, and reviving the hardcoded list
  // silently overrode it — while `isFallback` still reported false, so the page
  // didn't even say the values were stale.
  const present = new Set<keyof UtmSchema>();
  for (const l of lists) {
    if (l.parameter in out) {
      const k = l.parameter as keyof UtmSchema;
      present.add(k);
      out[k] = l.values.filter((v) => v.enabled).map((v) => [v.label, v.code] as Pair);
    }
  }
  // Only a parameter the API didn't return at all falls back to the hardcoded list.
  (Object.keys(FALLBACK_SCHEMA) as (keyof UtmSchema)[]).forEach((k) => {
    if (!present.has(k)) out[k] = FALLBACK_SCHEMA[k];
  });
  return out;
}

// API lists → GENERATORS with each SELECT field's options replaced by the live
// (enabled) values where a matching list exists. Fields with no live list
// (Month, Year) and the templates / field structure stay exactly as coded —
// only option lists are admin-editable.
function mapGenerators(lists: AssetListDTO[]): Generator[] {
  const opts = new Map<string, string[]>();
  for (const l of lists) {
    opts.set(
      `${l.asset_type}.${l.field}`,
      l.values.filter((v) => v.enabled).map((v) => v.value),
    );
  }
  return FALLBACK_GENERATORS.map((g) => ({
    ...g,
    fields: g.fields.map((f) => {
      if (f.kind !== "select") return f;
      // Presence, not length — same reasoning as mapUtm above. A field whose live
      // list exists but is empty means every value was retired, and the coded
      // options must not come back to contradict that.
      const key = `${g.id}.${f.key}`;
      return opts.has(key) ? { ...f, options: opts.get(key)! } : f;
    }),
  }));
}

// Live UTM schema for the generator. Falls back to the hardcoded lists while
// loading and on error — the tool stays usable either way, which is why this
// returns a bare value rather than a query result. `isFallback` lets the page
// say so quietly instead of pretending the data is live.
export function useUtmSchema(): { schema: UtmSchema; isFallback: boolean } {
  const query = useUtmLists();
  return query.data
    ? { schema: mapUtm(query.data), isFallback: false }
    : { schema: FALLBACK_SCHEMA, isFallback: true };
}

// Live asset-name generators, same fallback contract as useUtmSchema.
export function useAssetGenerators(): { generators: Generator[]; isFallback: boolean } {
  const query = useAssetNameLists();
  return query.data
    ? { generators: mapGenerators(query.data), isFallback: false }
    : { generators: FALLBACK_GENERATORS, isFallback: true };
}

// ---- writes (admin panels) -----------------------------------------------

// PUT /api/settings/utm/{parameter} — replaces that parameter's whole list.
export function useReplaceUtmParameter() {
  const getAccessToken = useAccessToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ parameter, entries }: { parameter: string; entries: UtmEntry[] }) =>
      authedPut<UtmListDTO>(
        marketingOpsServiceUrls.settingsUtmParameter(parameter),
        await getAccessToken(),
        { entries },
      ),
    // Invalidate rather than write the response into the cache: the backend
    // assigns ids and normalises sort_order, so a refetch is the only way to
    // hold what was actually stored. It also refreshes the generator's mapped
    // view, which is what makes an edit visible in the tool immediately.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY.utm }),
  });
}

// PUT /api/settings/asset-name/{assetType}/{field} — replaces that field's list.
export function useReplaceAssetNameField() {
  const getAccessToken = useAccessToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      assetType,
      field,
      entries,
    }: {
      assetType: string;
      field: string;
      entries: AssetEntry[];
    }) =>
      authedPut<AssetListDTO>(
        marketingOpsServiceUrls.settingsAssetNameField(assetType, field),
        await getAccessToken(),
        { entries },
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY.assetName }),
  });
}
