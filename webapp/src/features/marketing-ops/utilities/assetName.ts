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

// Asset Name Generator configuration + builder. Ported verbatim from Marketing
// Ops (frontend/shared/assetName.ts) — framework-free TypeScript, moved across
// unchanged.
//
// Originally transcribed from the marketing team's "WSO2 Asset Name Generator"
// sheet (the visible "Asset Name Generator" tab; the hidden legacy "Name
// Generator" tab is intentionally ignored).
//
// ⚠️ The per-generator dropdown lists differ ON PURPOSE and must not be
// deduplicated into one shared list:
//   - only Paid Ads offers "UK"
//   - only the Salesforce Campaign region list has EU1/EU2/EU3/MEA
//   - the product lists genuinely diverge (Paid Ads has "AI", Generic has
//     "APK"/"MI"/"WSO2CON"/"Agent Manager")
// Each mirrors a separate column in the sheet, and the values feed downstream
// Salesforce/Pardot reporting that expects exactly these strings.
//
// Output templates mirror the sheet's CONCATENATE formulas, with two
// intentional changes agreed with the team:
//   - `{yy}` resolves from a Year PICKER (two-digit), replacing the sheet's
//     hard-coded "26" — applied consistently to ALL generators, including Event
//     (the sheet used a free-text date cell there; now it's the same picker).
//   - The Paid Ads "Campaign Objective" and "Type" columns are dropped: the
//     sheet's Paid Ads formula never referenced them, so they had no effect.
//
// GENERATORS is the FALLBACK — at runtime each select's options are replaced by
// the live values from GET /api/settings/asset-name. The templates and field
// STRUCTURE always come from here; only the option lists are admin-editable.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Type list shared by every generator that uses it (sheet column E).
const TYPE = ["ABM", "Banner", "Content", "Content Syn", "Events", "Form", "Newsletter", "Product", "SDR", "Training", "Other", "Webinar"];

export interface Field {
  key: string;
  label: string;
  kind: "select" | "text" | "year";
  options?: string[];
  optional?: boolean;
  placeholder?: string;
  note?: string;
}

export interface Generator {
  id: string;
  name: string;
  /** Template over field keys + `{yy}` (two-digit year from the picker). */
  template: string;
  fields: Field[];
}

// Year is a picker on every generator and contributes only via the `{yy}` token.
const YEAR: Field = { key: "year", label: "Year", kind: "year" };

export const GENERATORS: Generator[] = [
  {
    id: "generic",
    name: "Generic Asset Name",
    template: "{region}_{product}_{campaign}_{type}_{month}{yy}",
    fields: [
      { key: "region", label: "Target Region", kind: "select", options: ["ANZ", "APAC", "EU", "ME", "Africa", "LATAM", "NA", "GLOBAL"] },
      { key: "product", label: "Product", kind: "select", options: ["APIM", "Choreo", "Identity Server", "Asgardeo", "BFSI", "Healthcare", "OEM", "Ballerina", "Platform", "APK", "Corporate", "MI", "WSO2CON", "Bijira", "Devant", "Agent Manager"] },
      { key: "campaign", label: "Campaign / Event / File Name", kind: "text", placeholder: "e.g. Onboarding" },
      { key: "type", label: "Type", kind: "select", options: TYPE },
      { key: "month", label: "Month", kind: "select", options: MONTHS },
      YEAR,
    ],
  },
  {
    id: "paid",
    name: "Paid Ads Asset Name",
    template: "{region}_{product} | {campaign} | {month}{yy}_{budget}",
    fields: [
      { key: "region", label: "Target Region", kind: "select", options: ["ANZ", "APAC", "UK", "EU", "ME", "Africa", "LATAM", "NA", "GLOBAL"] },
      { key: "product", label: "Product", kind: "select", options: ["APIM", "Choreo", "IAM", "Asgardeo", "Solutions", "AI", "Ballerina", "Platform", "Corporate", "Integration"] },
      { key: "campaign", label: "Campaign / Event / File Name", kind: "text", placeholder: "e.g. Gov" },
      { key: "month", label: "Month", kind: "select", options: MONTHS },
      YEAR,
      { key: "budget", label: "Budget Allocation", kind: "select", options: ["Regional", "BU"] },
    ],
  },
  {
    id: "sf-campaign",
    name: "Salesforce Campaign Name",
    template: "{region}_{product}_{campaign}_{type}_{month}{yy}",
    fields: [
      { key: "region", label: "Target Region", kind: "select", options: ["ANZ", "APAC", "EU1", "EU2", "EU3", "MEA", "LATAM", "NA", "GLOBAL", "EU"] },
      { key: "product", label: "Product", kind: "select", options: ["APIM", "Choreo", "Identity Server", "Asgardeo", "BFSI", "Healthcare", "OEM", "Ballerina", "Platform", "Corporate", "Integration"] },
      { key: "campaign", label: "Campaign / Event / File Name", kind: "text", placeholder: "e.g. WSO2 Con" },
      { key: "type", label: "Type", kind: "select", options: TYPE },
      { key: "month", label: "Month", kind: "select", options: MONTHS },
      YEAR,
    ],
  },
  {
    id: "event-sf-campaign",
    name: "Event Salesforce Campaign Name",
    template: "{region}_{product}_{campaign}_{month}{yy}_{eventType}",
    fields: [
      { key: "region", label: "Target Region", kind: "select", options: ["ANZ", "APAC", "EU", "ME", "Africa", "LATAM", "NA", "GLOBAL"] },
      { key: "product", label: "Product", kind: "select", options: ["APIM", "Choreo", "Identity Server", "Asgardeo", "BFSI", "Healthcare", "OEM", "Ballerina", "Platform", "APK", "Corporate", "MI", "WSO2CON", "Bijira", "Devant", "Agent Manager"] },
      { key: "campaign", label: "Event Name", kind: "text", placeholder: "e.g. Proprietary Event São Paulo" },
      { key: "month", label: "Month", kind: "select", options: MONTHS },
      YEAR,
      { key: "eventType", label: "Event Type", kind: "select", options: ["Webinar", "Workshop", "Trend Chat", "Partner Open Day", "Oxygenate", "WSO2 Summit", "WSO2Con", "Industry Event", "Seminar", "Roadshow", "Meetup"] },
    ],
  },
];

/** Four-digit years offered by the Year picker: previous year through +5. */
export function yearOptions(): string[] {
  const now = new Date().getFullYear();
  const out: string[] = [];
  for (let y = now - 1; y <= now + 5; y++) out.push(String(y));
  return out;
}

/** Default form values: first option for selects, current year for the picker, empty for text. */
export function initValues(gen: Generator): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of gen.fields) {
    if (f.kind === "year") out[f.key] = String(new Date().getFullYear());
    else if (f.kind === "select") out[f.key] = f.options?.[0] ?? "";
    else out[f.key] = "";
  }
  return out;
}

/**
 * Substitute `{key}` tokens in the template with field values. `{yy}` resolves
 * to the last two digits of the picked year. Literal separators are preserved
 * exactly, so the output matches the sheet's CONCATENATE formula shape.
 */
export function buildAssetName(gen: Generator, values: Record<string, string>): string {
  const yy = (values.year ?? "").slice(-2);
  return gen.template.replace(/\{(\w+)\}/g, (_, key) => (key === "yy" ? yy : values[key] ?? ""));
}
