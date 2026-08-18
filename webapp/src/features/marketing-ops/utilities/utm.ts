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

// UTM Generator schema + URL builder. Ported verbatim from Marketing Ops
// (digiops-marketing/agents/marketing-ops/frontend/shared/utm.ts) — this is
// framework-free TypeScript, so it moves across unchanged rather than being
// rewritten. Do not "clean it up": the values below are a data contract with
// links already in the wild.
//
// Originally transcribed from the marketing team's "UTM Generator.html". Each
// entry is [label, lowercase code]; the CODE is what goes into the URL.
//
// ⚠️ Two things that look like bugs and are not:
//   - "suppport" (three p's) for WSO2 Support Portal is the upstream spelling.
//     Correcting it would change the utm_source of every link generated from
//     here on, splitting that source's analytics into two buckets that don't
//     add up. Leave it.
//   - 'APIM' and 'API Manager' both map to code 'apim', and 'ME' appears in
//     both `source` (Medium, the publication) and `region` (Middle East) with
//     different meanings. Both are intentional.
//
// SCHEMA is the FALLBACK. At runtime the lists come from
// GET /api/settings/utm, which marketing admins maintain — see
// @features/marketing-ops/api/useMarketingOpsSettings. These values are what
// the tool falls back to when that call hasn't landed or fails, so the
// generator is never unusable.

export type Pair = [label: string, code: string];

export const SCHEMA: Record<"source" | "medium" | "region" | "bu", Pair[]> = {
  source: [
    ["ChatGPT", "gpt"],
    ["Demandbase", "db"], ["DZone", "dz"], ["Drift", "drift"], ["Facebook", "fb"], ["G2", "g2"],
    ["Google", "go"], ["InfoQ", "iq"], ["LinkedIn", "li"], ["Mailer", "mailer"], ["Medium", "me"],
    ["Meetup", "mp"], ["Twitter", "tw"], ["WSO2 Docs", "docs"], ["WSO2 Discord Channel", "discord"],
    ["WSO2 Partner Portal", "partner"], ["WSO2 Support Portal", "suppport"], ["Xing", "xing"],
    ["Yesware", "yw"], ["YouTube", "yt"], ["ZDNet", "zd"],
  ],
  medium: [
    ["CPC", "cpc"], ["Email", "email"], ["Link", "link"], ["Organic Post", "orgpost"], ["Sponsored Link", "slink"],
  ],
  region: [
    ["APAC", "apac"], ["EU", "eu"], ["UK", "uk"], ["NA", "na"], ["LATAM", "latam"],
    ["ANZ", "anz"], ["ME", "me"], ["Africa", "afr"], ["Global", "global"],
  ],
  bu: [
    ["Choreo", "choreo"], ["APIM", "apim"], ["API Manager", "apim"], ["Bijira", "bijira"], ["Integration", "int"], ["Devant", "dev"],
    ["IAM", "iam"], ["Asgardeo", "asg"], ["Corporate", "corp"], ["Other", "other"], ["Solutions", "solutions"],
  ],
};

export const DEFAULTS = { source: "mailer", medium: "email", region: "global", bu: "apim" };

// Campaign name → lowercase, every non-alphanumeric run collapsed to one
// underscore, trimmed. "API_Platform_Onboarding" → "api_platform_onboarding".
export function sanitizeCampaign(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

// Strip STRAY percent signs and trim; otherwise leave the URL intact.
//
// Marketing Ops removed every `%`, which is right for the case it was written for —
// someone pastes a URL carrying a literal percent and the tracking link breaks — but
// wrong for a legitimately encoded one: `/a%20b` became `/a20b`, a different
// resource, and the page cheerfully reported that a character had been "removed".
//
// A `%` followed by two hex digits is valid percent-encoding and is left alone. Only
// a `%` that cannot be part of an escape is dropped.
export function cleanPageUrl(raw: string): string {
  return raw.replace(/%(?![0-9a-fA-F]{2})/g, "").trim();
}

/** Whether cleanPageUrl would actually drop something — for an honest warning. */
export function hasStrayPercent(raw: string): boolean {
  return /%(?![0-9a-fA-F]{2})/.test(raw);
}

// YYYY-MM-DD → MMDDYY
export function formatDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${m}${d}${y.slice(2)}`;
}

export interface UtmInput {
  pageUrl: string;
  source: string;
  medium: string;
  region: string;
  bu: string;
  campaign: string;
  startDate: string;
}
export interface UtmSegment { v: string; hint: string }
export interface UtmResult { url: string; segments: UtmSegment[] }

// Build the parameterized URL + the colour-coded utm_campaign breakdown.
// Empty campaign/date are dropped so we never emit a stray "__".
export function buildUtmUrl(i: UtmInput): UtmResult {
  const clean = cleanPageUrl(i.pageUrl);
  const campaign = sanitizeCampaign(i.campaign);
  const date = formatDate(i.startDate);
  const segments: UtmSegment[] = [
    { v: i.source, hint: "source" },
    { v: i.medium, hint: "medium" },
    { v: i.region, hint: "region" },
    { v: i.bu, hint: "BU" },
    { v: campaign, hint: "campaign" },
    { v: date, hint: "date" },
  ].filter((s) => s.v);

  const utmCampaign = segments.map((s) => s.v).join("_");
  if (!clean) return { url: "", segments };

  // Params must go BEFORE any #fragment, otherwise they become part of the
  // fragment and are ignored by the server. Split the URL, append, re-attach.
  const hashIdx = clean.indexOf("#");
  const beforeHash = hashIdx === -1 ? clean : clean.slice(0, hashIdx);
  const fragment = hashIdx === -1 ? "" : clean.slice(hashIdx);

  // REPLACE any utm_* the input already carries rather than appending beside it.
  // Tagging an already-tagged URL used to produce two utm_source and two
  // utm_campaign params, and which one a given analytics tool honours is not
  // something to leave to chance. Other query params are kept — they're usually
  // functional (a product id, a locale) and dropping them would break the link.
  //
  // rebuildLinkUtm in the email editor already strips utm_* before calling this, so
  // this is a no-op on that path rather than a change to it.
  const [path, query = ""] = beforeHash.split("?");
  const kept = query.split("&").filter((p) => p && !/^utm_/i.test(p));
  const base = kept.length ? `${path}?${kept.join("&")}` : path;

  const joiner = base.includes("?") ? "&" : "?";
  const url = `${base}${joiner}utm_source=${i.source}&utm_medium=${i.medium}&utm_campaign=${utmCampaign}${fragment}`;
  return { url, segments };
}
