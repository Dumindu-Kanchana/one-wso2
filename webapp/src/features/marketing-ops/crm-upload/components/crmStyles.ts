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

import type { CrmRecordStatus, PipelineRun } from "../crmUploadTypes";

// Constants and style objects for the CRM Upload screens, in their own module so
// CrmUi.tsx exports only components — a file that exports both loses Fast Refresh.

// ---- the outcome language --------------------------------------------------
//
// Five outcomes, and the discipline is that each colour means one thing across every
// screen: a run's status chip, a record's status chip, a proportion bar segment and a
// stat cell all agree.
//
//   success   the record reached Salesforce               inserted, completed
//   info      an existing Salesforce record was changed   updated
//   warning   a person has to decide                      duplicate, partial, pending
//   error     something was rejected                      failed
//   neutral   nothing further will happen, and that's ok   dismissed, deduplicated,
//                                                          superseded
//
// Marketing Ops carried a `statusColor` map of hex values for this. These are MUI
// palette paths instead, so both themes get the right contrast — the source's tints
// were computed from light-mode hex and washed out on dark.
export const OUTCOME = {
  synced: "success.main",
  changed: "info.main",
  attention: "warning.main",
  rejected: "error.main",
  closed: "text.secondary",
} as const;

/** Run status → its one colour. */
export const RUN_STATUS_COLOR: Record<PipelineRun["status"], string> = {
  pending: OUTCOME.attention,
  running: OUTCOME.changed,
  completed: OUTCOME.synced,
  partial: OUTCOME.attention,
  failed: OUTCOME.rejected,
};

/** Record status → its one colour. */
export const RECORD_STATUS_COLOR: Record<CrmRecordStatus, string> = {
  pending: OUTCOME.attention,
  processing: OUTCOME.changed,
  inserted: OUTCOME.synced,
  updated: OUTCOME.changed,
  duplicate: OUTCOME.attention,
  deduplicated: OUTCOME.closed,
  superseded: OUTCOME.closed,
  dismissed: OUTCOME.closed,
  failed: OUTCOME.rejected,
};

// One line on each status, shown as a tooltip on every tab and chip that carries it.
//
// This is the most valuable text in the operation and it is worth keeping verbatim.
// Six of these nine words look like failures and are not: deduplicated, superseded
// and dismissed are all "nothing went wrong, and nothing more will happen", and
// without the explanation a reader counts them as losses.
export const CRM_STATUS_DESCRIPTIONS: Record<string, string> = {
  all: "Every record, regardless of status.",
  pending: "Queued — waiting for the next scheduler run to sync it.",
  processing: "Being synced by the scheduler right now.",
  inserted: "Created in Salesforce via the Entity Service.",
  updated:
    "An existing Salesforce record was updated (sfId update, or a merge from the review queue).",
  duplicate:
    "Salesforce matched an existing record — waiting on a reviewer in the review queue.",
  deduplicated:
    "An exact duplicate of a record already queued; folded into it at ingest and not synced again.",
  superseded: "Replaced at ingest by a newer record with the same Salesforce id (newest wins).",
  dismissed: "A reviewer chose not to write this record. Nothing went wrong.",
  failed: "The Entity Service rejected this record — see the error for details.",
};

/** Lead vs Account, which is a kind and not an outcome — so it borrows neither. */
export const KIND_COLOR = { lead: "info.main", account: "secondary.main" } as const;

/** How far back the un-searched lists reach. Both screens say so out loud. */
export const WINDOW_DAYS = 30;

export function windowFromDate(): string {
  return new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();
}

export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}

export function fmtClock(iso: string | null): string {
  return iso ? new Date(iso).toLocaleTimeString(undefined, { timeStyle: "medium" }) : "—";
}

export function fmtDuration(run: PipelineRun): string {
  if (!run.completed_at) return "—";
  const ms = new Date(run.completed_at).getTime() - new Date(run.started_at).getTime();
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

/** Rotating copy while a screen loads. */
export const CRM_LOADING = {
  pipelines: ["Checking the schedulers…", "Almost there…"],
  runs: ["Loading pipeline runs…", "Almost there…"],
  records: ["Loading records…", "Almost there…"],
  queue: ["Loading the review queue…", "Almost there…"],
  diff: ["Fetching the Salesforce record…", "Comparing values…"],
} as const;

/** Tabular figures, so a column of counts lines up. */
export const NUMERIC = { fontVariantNumeric: "tabular-nums" } as const;

export const primaryBtn = { textTransform: "none", fontSize: 13, fontWeight: 700 } as const;

export const quietBtn = {
  textTransform: "none",
  fontSize: 13,
  fontWeight: 600,
  color: "text.secondary",
  "&:hover": { color: "primary.main" },
} as const;

export const TH = { fontSize: 11, fontWeight: 700 } as const;

export const eyebrow = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.14em",
  textTransform: "uppercase" as const,
  color: "text.secondary",
};
