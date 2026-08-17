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

// Wire types for Email Workbench. Ported from Marketing Ops
// (frontend/operations/email-workbench/api.ts) with the fetch helpers removed —
// those become TanStack Query hooks in ../api/useEmailWorkbench.
//
// Four resources behind one operation:
//   templates — approved, reusable HTML + a thumbnail, org-wide, admin-managed
//   drafts    — a marketer's work in progress, per-user, pushed to Pardot
//   blocks    — the Advanced editor's component palette, DB-backed
//   settings  — Pardot send defaults applied on every push

// ---- templates -------------------------------------------------------------

export interface TemplateSummary {
  id: string;
  name: string;
  category: string;
  has_thumbnail: boolean;
  updated_at: string;
}

// The full record adds the raw HTML. That HTML is never re-serialised by this
// app — the editor mutates the live DOM and writes it back — so a template opened
// and saved without edits comes back byte-identical.
export interface TemplateFull extends TemplateSummary {
  html: string;
}

export interface TemplateWrite {
  name: string;
  category: string;
  html: string;
  // base64 data URL. OMIT on edit to keep the existing image — sending an empty
  // string would clear it.
  thumbnail_data_url?: string;
}

// ---- block catalog ---------------------------------------------------------

// One entry in the Advanced editor's palette. `type` is the stable key the editor's
// materialiser looks up, so renaming it breaks existing templates; `html` is raw.
export interface Block {
  id: string;
  type: string;
  label: string;
  icon: string;
  category: string; // 'simple' | 'complex'
  sort_order: number;
  // Hidden blocks are not offered in the palette and not offered to the AI
  // structure fill either — a retired component stays available to templates that
  // already use it without being insertable into new ones.
  hidden: boolean;
  html: string;
  updated_at: string;
}

export interface BlockWrite {
  type: string;
  label: string;
  icon: string;
  category: string;
  sort_order: number;
  hidden: boolean;
  html: string;
}

// ---- AI structure fill -----------------------------------------------------
//
// The one AI-backed endpoint in this migration: a plain-text draft plus a snapshot
// of the template's current blocks goes in, a target structure comes out. The
// model only chooses which block kinds hold which copy — it never emits HTML, so
// the output can't introduce markup the editor doesn't already own.

export interface TemplateBlockSnap {
  i: number;
  type: string;
  text?: string;
  items?: string[];
  label?: string;
  href?: string;
}

export interface TargetBlock {
  kind: string;
  text?: string;
  items?: string[];
  label?: string;
  label2?: string;
  href?: string;
  note?: string;
}

// ---- drafts ----------------------------------------------------------------

export interface DraftSummary {
  id: string;
  name: string;
  subject?: string | null;
  status: string; // 'Draft' | 'Completed'
  // Set once the draft has been pushed. Its presence is what distinguishes
  // "create in Pardot" from "update the existing Pardot template".
  pardot_template_id?: number | null;
  pardot_synced_at?: string | null;
  updated_at: string;
}

export interface DraftFull extends DraftSummary {
  html: string;
  text_version?: string | null;
  source_template_id?: string | null;
}

export interface DraftWrite {
  name: string;
  subject?: string | null;
  html: string;
  text_version?: string | null;
  source_template_id?: string | null;
}

// Final content the Export dialog pushes to Pardot.
export interface PushBody {
  name: string;
  subject?: string | null;
  html: string;
  text_version?: string | null;
}

export interface PushResult {
  pardot_template_id: number;
  status: string;
}

// ---- Pardot send defaults --------------------------------------------------

// Org-level settings applied on every push. The sender is a single general_user;
// only its address and name are configurable — type and userId are fixed
// server-side, which is why they aren't here.
export interface PardotSettings {
  campaign_id?: number | null;
  tracker_domain_id?: number | null;
  is_one_to_one_email: boolean;
  is_auto_responder_email: boolean;
  is_drip_email: boolean;
  is_list_email: boolean;
  sender_options_address?: string | null;
  sender_options_name?: string | null;
  updated_by?: string | null;
  updated_at?: string | null;
}
