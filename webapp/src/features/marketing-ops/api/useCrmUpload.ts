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

// CRM Upload data layer — 9 endpoints as TanStack Query hooks.
//
// One capability, `crmupload`, covers every screen: this operation is the marketing
// team's own tooling, not something regional managers submit into, so there is no
// submitter/reviewer split of the kind Events has.
//
// Everything here is org-wide, so no query key carries the user's `sub`. What each
// list shows is decided entirely by its filters, which is why the keys carry the
// serialized params — two different filter sets are two different caches, and
// switching back to one you had is instant.
//
// Marketing Ops drove all of this with useEffect + useState per component: eleven
// effects across four components, each with its own `cancelled` flag, its own
// loading boolean and its own debounce. Every one of those is what a query key
// already does.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { authedDeleteJson, authedGet, authedPatch, authedPost } from "@api/http";
import { httpRetry } from "@api/errors";
import { useAccessToken } from "@hooks/useAccessToken";
import {
  isMarketingOpsBackendConfigured,
  marketingOpsServiceUrls as urls,
} from "@config/apiConfig";
import type {
  DuplicateReview,
  ExistingRecord,
  Page,
  PipelineRun,
  RecordKind,
  RecordsPage,
  ResolveDuplicateBody,
  SchedulerType,
} from "../crm-upload/crmUploadTypes";

const ROOT = ["marketing-ops", "crm-upload"] as const;

const KEY = {
  runs: (params: string) => [...ROOT, "runs", params] as const,
  latestRun: (kind: SchedulerType) => [...ROOT, "runs", "latest", kind] as const,
  records: (params: string) => [...ROOT, "records", params] as const,
  duplicates: (params: string) => [...ROOT, "duplicates", params] as const,
  // Keyed by the SALESFORCE id, not the duplicate id: several incoming records can
  // collide with the same master, and refetching it per collision would hit the
  // Entity Service once per row for no new information. Marketing Ops achieved the
  // same thing with a hand-rolled Map cache in its api module.
  existing: (sfId: string) => [...ROOT, "duplicates", "existing", sfId] as const,
};

function useBase() {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const ready = isSignedIn && isMarketingOpsBackendConfigured();
  return { getAccessToken, ready };
}

// Invalidate every CRM Upload list. Used after a trigger or a delete: a run that
// started changes the run lists, and its records land in the record lists — which
// list is on screen is not this layer's business.
function useInvalidateAll() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ROOT });
}

// ---- pipeline runs ---------------------------------------------------------

export function useRuns(params: URLSearchParams, enabled = true) {
  const { getAccessToken, ready } = useBase();
  const qs = params.toString();
  return useQuery<Page<PipelineRun>>({
    queryKey: KEY.runs(qs),
    enabled: ready && enabled,
    queryFn: async () => authedGet<Page<PipelineRun>>(urls.crmUploadRuns(params), await getAccessToken()),
    retry: httpRetry,
  });
}

// The most recent run of one scheduler — the Pipelines screen's whole subject.
//
// `limit: 1` rather than reading item[0] of a full page: the list endpoint already
// orders newest-first, and asking for one is honest about what's wanted.
export function useLatestRun(kind: SchedulerType) {
  const { getAccessToken, ready } = useBase();
  return useQuery<PipelineRun | null>({
    queryKey: KEY.latestRun(kind),
    enabled: ready,
    queryFn: async () => {
      const params = new URLSearchParams({ scheduler_type: kind, limit: "1" });
      const page = await authedGet<Page<PipelineRun>>(
        urls.crmUploadRuns(params),
        await getAccessToken(),
      );
      return page.items[0] ?? null;
    },
    retry: httpRetry,
  });
}

// Start a scheduler by hand. Returns the new run's id.
//
// A run takes longer than the request that starts it, so the response means
// "accepted", never "finished" — the caller says so, and the lists refresh
// afterwards to pick up the run once it exists.
export function useTriggerRun() {
  const { getAccessToken } = useBase();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async (kind: SchedulerType) =>
      authedPost<{ run_id: string; status: string }>(
        urls.crmUploadTrigger(kind),
        await getAccessToken(),
        {},
      ),
    onSuccess: invalidate,
  });
}

// ---- records ---------------------------------------------------------------

export function useCrmRecords(params: URLSearchParams, enabled = true) {
  const { getAccessToken, ready } = useBase();
  const qs = params.toString();
  return useQuery<RecordsPage>({
    queryKey: KEY.records(qs),
    enabled: ready && enabled,
    queryFn: async () =>
      authedGet<RecordsPage>(urls.crmUploadRecords(params), await getAccessToken()),
    // Keep the previous page's rows on screen while the next one loads, so paging
    // and typing in the search box don't blank the table on every keystroke.
    placeholderData: (prev) => prev,
    retry: httpRetry,
  });
}

// Hard-delete one ingested record. The reason is required and goes to the audit log,
// never the record's own data — this exists for data-subject erasure requests.
export function useDeleteCrmRecord() {
  const { getAccessToken } = useBase();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async ({
      recordType,
      id,
      reason,
    }: {
      recordType: RecordKind;
      id: string;
      reason: string;
    }) =>
      authedDeleteJson<{ id: string; deleted: boolean }>(
        urls.crmUploadRecord(recordType, id),
        await getAccessToken(),
        { reason },
      ),
    onSuccess: invalidate,
  });
}

// ---- the review queue ------------------------------------------------------

export function useDuplicates(params: URLSearchParams, enabled = true) {
  const { getAccessToken, ready } = useBase();
  const qs = params.toString();
  return useQuery<Page<DuplicateReview>>({
    queryKey: KEY.duplicates(qs),
    enabled: ready && enabled,
    queryFn: async () =>
      authedGet<Page<DuplicateReview>>(urls.crmUploadDuplicates(params), await getAccessToken()),
    placeholderData: (prev) => prev,
    retry: httpRetry,
  });
}

// The Salesforce record an incoming one collided with.
//
// `staleTime: Infinity` for the session: a master record does not change while a
// reviewer is deciding what to do about it, and this call reaches the Entity Service
// rather than this backend — the one request here worth not repeating.
export function useExistingRecord(duplicateId: string | null, sfExistingId: string | null) {
  const { getAccessToken, ready } = useBase();
  return useQuery<ExistingRecord>({
    queryKey: KEY.existing(sfExistingId ?? ""),
    enabled: ready && Boolean(duplicateId) && Boolean(sfExistingId),
    queryFn: async () =>
      authedGet<ExistingRecord>(
        urls.crmUploadDuplicateExisting(duplicateId!),
        await getAccessToken(),
      ),
    staleTime: Infinity,
    retry: httpRetry,
  });
}

// Merge or dismiss one collision.
//
// Merging writes the reviewer's chosen field values to the existing Salesforce
// record; dismissing drops the incoming one without writing anything. Either way the
// duplicate leaves the queue, and the record it belonged to changes status — so this
// invalidates the record lists too, not just the queue.
export function useResolveDuplicate() {
  const { getAccessToken } = useBase();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: ResolveDuplicateBody }) =>
      authedPatch<{ id: string; resolution: string }>(
        urls.crmUploadDuplicateResolve(id),
        await getAccessToken(),
        body,
      ),
    onSuccess: invalidate,
  });
}
