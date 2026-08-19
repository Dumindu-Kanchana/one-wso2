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

// Wire types for CRM Upload. Ported from Marketing Ops (operations/crm-upload/api.ts)
// with the fetch helpers removed — those become TanStack Query hooks in
// ../api/useCrmUpload.
//
// The shape of this operation: two schedulers run server side on a timer, each
// locking a batch of enriched records and pushing them to Salesforce through the
// Entity Service. This UI watches that happen, browses what came out, and resolves
// the one thing a machine can't decide — whether an incoming record is really the
// same person or company as one Salesforce already holds.

export type SchedulerType = "leads" | "accounts";
export type RecordKind = "lead" | "account";

/** One execution of one scheduler. */
export interface PipelineRun {
  id: string;
  scheduler_type: SchedulerType;
  status: "pending" | "running" | "completed" | "partial" | "failed";
  triggered_by: string;
  started_at: string;
  completed_at: string | null;
  total_records: number;
  inserted: number;
  updated: number;
  failed: number;
  duplicates: number;
  error_message?: string | null;
  review_queue_url?: string;
}

// One ingested record and what became of it.
//
// The status vocabulary is wider than it first looks, and the distinctions carry
// real information — see CRM_STATUS_DESCRIPTIONS in components/crmStyles.ts, which
// is the user-facing half of this type.
export interface CrmRecord {
  id: string;
  pipeline_run_id: string | null;
  source_system: string;
  payload: Record<string, unknown>;
  status:
    | "pending"
    | "processing"
    | "inserted"
    | "failed"
    | "duplicate"
    | "dismissed"
    | "updated"
    | "deduplicated"
    | "superseded";
  error_message: string | null;
  /** The ingest batch this record belongs to (null on pre-migration-010 rows). */
  batch_id: string | null;
  created_at: string;
  /** Present only on the unified /records endpoint (it unions both tables). */
  record_type?: RecordKind;
}

export type CrmRecordStatus = CrmRecord["status"];

/** The paging envelope every list endpoint returns. */
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface RecordsPage extends Page<CrmRecord> {
  // Per-status totals for the current filter set, EXCLUDING the status filter
  // itself — which is what lets the status tabs show what each would contain
  // rather than what the current one does. Their sum is the 'all' count.
  status_counts: Record<string, number>;
}

/** One collision: an incoming record and the Salesforce record it matched. */
export interface DuplicateReview {
  id: string;
  crm_record_id: string;
  sf_existing_id: string;
  resolution: string;
  record_type: RecordKind;
  incoming: Record<string, unknown>;
}

/** The Salesforce side of a collision, fetched only when a reviewer opens the diff. */
export interface ExistingRecord {
  record_type: RecordKind;
  sf_existing_id: string;
  existing: Record<string, unknown>;
}

export interface ResolveDuplicateBody {
  action: "merge" | "dismiss";
  merged_fields?: Record<string, unknown>;
}
