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

// Wire types for Events. Ported from Marketing Ops (operations/events/api.ts) with
// the fetch helpers removed — those become TanStack Query hooks in ../api/useEvents.
//
// Note how small this surface is relative to the feature: the browser parses the
// workbook, validates it, scores it and handles every accept/reject/edit locally (see
// ./rules/). The backend supplies reference lists, the model's opinion on values our
// rules couldn't resolve, storage, and the review workflow.

import type { Payload } from "./rules/model";
import type { SuggestItem, SuggestionAnswer } from "./rules/suggest";
import type { Tab } from "./rules/schema";

export type { Tab };
export type { Payload, SuggestItem, SuggestionAnswer };

// One column of one member status.
//
// `header_label` is what the sheet says; `field_name` is what we show. Only two data
// types exist — an email column is text with a `pattern`, so a new format needs no
// release.
export interface FieldDef {
  id?: number;
  tab?: string;
  sort_order?: number;
  header_label: string;
  field_name: string;
  data_type: "text" | "picklist";
  /** Optional regular expression, text columns only. */
  pattern?: string | null;
  picklist: string[];
  mandatory: boolean;
  // A column WE fill in. `field_name` then holds a computed key rather than a label,
  // and type/pattern/picklist/mandatory are all forced off — every one of those is a
  // rule about a value the sheet supplies, and this one it doesn't.
  computed?: boolean;
}

/** Every status' columns, in display order. */
export type FieldDefs = Record<string, FieldDef[]>;

/** A member status — which is also a tab name a workbook may use. */
export interface MemberStatus {
  id?: number;
  name: string;
  score: number;
  sort_order?: number;
  enabled: boolean;
}

export type MemberStatusInput = Pick<MemberStatus, "name" | "score" | "enabled">;

export type Status = "Draft" | "Submitted" | "ChangesRequested" | "Approved" | "Imported";

// Wire value → what a human should read. "Submitted" means different things to the two
// sides, so the submitter-facing label says who is waiting on whom.
export const STATUS_LABEL: Record<Status, string> = {
  Draft: "Draft",
  Submitted: "Awaiting review",
  ChangesRequested: "Changes requested",
  Approved: "Approved",
  Imported: "Imported",
};

export type LeadState = "New" | "MQL";

export interface SubmissionSummary {
  id: string;
  event_name: string;
  event_date?: string | null;
  sf_campaign_url?: string | null;
  lead_state: LeadState;
  owner_email?: string | null;
  status: Status;
  row_count: number;
  source_filename?: string | null;
  template_version?: string | null;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  imported_at?: string | null;
  updated_at?: string | null;
}

export interface SubmissionFull extends SubmissionSummary {
  payload: Payload;
}

export interface Comment {
  id: string;
  comment: string;
  author_email?: string | null;
  created_at?: string | null;
}

// A problem the server refused to accept at submit. A non-empty list means the browser
// and the server DISAGREE — in practice a stale tab running older rules. Worth
// surfacing loudly rather than retrying, because retrying won't help.
export interface Problem {
  tab: string;
  row: number;
  field?: string;
  message: string;
}

export interface SubmitResult {
  submitted: boolean;
  problems: Problem[];
}

export interface SuggestResult {
  assisted: boolean;
  suggestions: SuggestionAnswer[];
}

// Countries and states, plus whether suggestion assistance is configured at all.
// `assisted: false` means the model isn't wired up, so the UI shouldn't offer to ask it.
export interface ReferenceResponse {
  countries: string[];
  states: Record<string, string[]>;
  state_required: string[];
  assisted: boolean;
}
