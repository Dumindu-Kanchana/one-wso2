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

// Email Workbench data layer — 23 endpoints across four resources, as TanStack
// Query hooks. Marketing Ops drove these from a plain `emailWorkbenchApi` object
// with no caching; here reads are queries and writes are mutations that invalidate
// the lists they affect, so a rename in one view updates every other.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { authedDelete, authedGet, authedPost, authedPut } from "@api/http";
import { httpRetry } from "@api/errors";
import { useAccessToken } from "@hooks/useAccessToken";
import {
  isMarketingOpsBackendConfigured,
  marketingOpsServiceUrls as urls,
} from "@config/apiConfig";
import { useAsgardeoSub } from "@hooks/useAsgardeoSub";
import type {
  Block,
  BlockWrite,
  DraftFull,
  DraftSummary,
  DraftWrite,
  PardotSettings,
  PushBody,
  PushResult,
  TargetBlock,
  TemplateBlockSnap,
  TemplateFull,
  TemplateSummary,
  TemplateWrite,
} from "../email-workbench/emailWorkbenchTypes";

// ---- query keys ------------------------------------------------------------
//
// Templates, blocks and settings are ORG-WIDE — identical for every caller — so
// they aren't keyed per user. Drafts are PER-USER and must be, or switching
// accounts in one tab would serve the previous user's drafts from cache.
const KEY = {
  templates: ["marketing-ops", "ew", "templates"] as const,
  template: (id: string) => ["marketing-ops", "ew", "template", id] as const,
  categories: ["marketing-ops", "ew", "categories"] as const,
  drafts: (sub?: string) => ["marketing-ops", "ew", "drafts", sub] as const,
  draft: (id: string, sub?: string) => ["marketing-ops", "ew", "draft", id, sub] as const,
  blocks: ["marketing-ops", "ew", "blocks"] as const,
  settings: ["marketing-ops", "ew", "settings"] as const,
};

function useEnabled(extra = true): boolean {
  const { isSignedIn } = useAsgardeo();
  return extra && isSignedIn && isMarketingOpsBackendConfigured();
}

// ---- templates -------------------------------------------------------------

export function useTemplates() {
  const enabled = useEnabled();
  const getAccessToken = useAccessToken();
  return useQuery<TemplateSummary[]>({
    queryKey: KEY.templates,
    enabled,
    queryFn: async () =>
      authedGet<TemplateSummary[]>(urls.emailWorkbenchTemplates, await getAccessToken()),
    staleTime: 2 * 60 * 1000,
    retry: httpRetry,
  });
}

// One template with its HTML. Fetched only when a template is actually opened —
// the list endpoint deliberately omits HTML so the gallery isn't dragging every
// template's full markup around.
export function useTemplate(id: string | null) {
  const enabled = useEnabled(Boolean(id));
  const getAccessToken = useAccessToken();
  return useQuery<TemplateFull>({
    queryKey: KEY.template(id ?? ""),
    enabled,
    queryFn: async () =>
      authedGet<TemplateFull>(urls.emailWorkbenchTemplate(id!), await getAccessToken()),
    // Approved templates change rarely; a stale one is corrected on next mount.
    staleTime: 5 * 60 * 1000,
    retry: httpRetry,
  });
}

export function useTemplateCategories() {
  const enabled = useEnabled();
  const getAccessToken = useAccessToken();
  return useQuery<string[]>({
    queryKey: KEY.categories,
    enabled,
    queryFn: async () => authedGet<string[]>(urls.emailWorkbenchCategories, await getAccessToken()),
    staleTime: 5 * 60 * 1000,
    retry: httpRetry,
  });
}

export function useSaveTemplate() {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  return useMutation({
    // One mutation for create and update: the only difference is the URL and the
    // verb, and every caller is a form that doesn't care which it is.
    mutationFn: async ({ id, body }: { id?: string; body: TemplateWrite }) => {
      const token = await getAccessToken();
      return id
        ? authedPut<{ id: string }>(urls.emailWorkbenchTemplate(id), token, body)
        : authedPost<{ id: string }>(urls.emailWorkbenchTemplates, token, body);
    },
    onSuccess: (_r, { id }) =>
      Promise.all([
        qc.invalidateQueries({ queryKey: KEY.templates }),
        qc.invalidateQueries({ queryKey: KEY.categories }),
        // The single-template cache holds the HTML the editor reads, so it must
        // refresh too or reopening shows the pre-save markup.
        id ? qc.invalidateQueries({ queryKey: KEY.template(id) }) : Promise.resolve(),
      ]),
  });
}

export function useDeleteTemplate() {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      authedDelete(urls.emailWorkbenchTemplate(id), await getAccessToken()),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: KEY.templates }),
        qc.invalidateQueries({ queryKey: KEY.categories }),
      ]),
  });
}

// ---- drafts (per user) -----------------------------------------------------

export function useDrafts() {
  const { state } = useAsgardeoSub();
  const sub = state.status === "ready" ? state.sub : undefined;
  const enabled = useEnabled(Boolean(sub));
  const getAccessToken = useAccessToken();
  return useQuery<DraftSummary[]>({
    queryKey: KEY.drafts(sub),
    enabled,
    queryFn: async () => authedGet<DraftSummary[]>(urls.emailWorkbenchDrafts, await getAccessToken()),
    // Your own drafts change as you work, so keep this short.
    staleTime: 30 * 1000,
    retry: httpRetry,
  });
}

export function useDraft(id: string | null) {
  const { state } = useAsgardeoSub();
  const sub = state.status === "ready" ? state.sub : undefined;
  const enabled = useEnabled(Boolean(id && sub));
  const getAccessToken = useAccessToken();
  return useQuery<DraftFull>({
    queryKey: KEY.draft(id ?? "", sub),
    enabled,
    queryFn: async () => authedGet<DraftFull>(urls.emailWorkbenchDraft(id!), await getAccessToken()),
    staleTime: 30 * 1000,
    retry: httpRetry,
  });
}

export function useSaveDraft() {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id?: string; body: DraftWrite }) => {
      const token = await getAccessToken();
      return id
        ? authedPut<{ id: string }>(urls.emailWorkbenchDraft(id), token, body)
        : authedPost<{ id: string }>(urls.emailWorkbenchDrafts, token, body);
    },
    // Broad invalidation on the drafts subtree rather than naming the user's key:
    // the editor autosaves, and matching the exact per-user key at every call site
    // is the kind of detail that silently rots.
    onSuccess: () => qc.invalidateQueries({ queryKey: ["marketing-ops", "ew", "drafts"] }),
  });
}

export function useDeleteDraft() {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      authedDelete(urls.emailWorkbenchDraft(id), await getAccessToken()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["marketing-ops", "ew", "drafts"] }),
  });
}

// Push a draft to Pardot.
//
// `alreadyPushed` picks the endpoint: /push CREATES the Pardot template and flips
// the draft to Completed, /update-pardot PATCHes an existing one and 409s if the
// draft was never pushed. Getting this wrong doesn't fail quietly — it either
// duplicates a template in Pardot or errors — so the decision is made from the
// draft's own `pardot_template_id` rather than from UI state.
export function usePushDraft() {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      body,
      alreadyPushed,
    }: {
      id: string;
      body: PushBody;
      alreadyPushed: boolean;
    }) =>
      authedPost<PushResult>(
        alreadyPushed
          ? urls.emailWorkbenchDraftUpdatePardot(id)
          : urls.emailWorkbenchDraftPush(id),
        await getAccessToken(),
        body,
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["marketing-ops", "ew", "drafts"] }),
  });
}

// ---- block catalog ---------------------------------------------------------

// The Advanced editor's palette. DB-backed with NO hardcoded fallback — the
// catalog is the single source of truth, so if this fails the editor says the
// palette is unavailable rather than offering a stale guess at the components.
export function useBlocks(enabledOverride = true) {
  const enabled = useEnabled(enabledOverride);
  const getAccessToken = useAccessToken();
  return useQuery<Block[]>({
    queryKey: KEY.blocks,
    enabled,
    queryFn: async () => authedGet<Block[]>(urls.emailWorkbenchBlocks, await getAccessToken()),
    staleTime: 5 * 60 * 1000,
    retry: httpRetry,
  });
}

export function useSaveBlock() {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id?: string; body: BlockWrite }) => {
      const token = await getAccessToken();
      return id
        ? authedPut<{ id: string }>(urls.emailWorkbenchBlock(id), token, body)
        : authedPost<{ id: string }>(urls.emailWorkbenchBlocks, token, body);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY.blocks }),
  });
}

export function useDeleteBlock() {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      authedDelete(urls.emailWorkbenchBlock(id), await getAccessToken()),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY.blocks }),
  });
}

// ---- Pardot send defaults --------------------------------------------------

export function usePardotSettings() {
  const enabled = useEnabled();
  const getAccessToken = useAccessToken();
  return useQuery<PardotSettings>({
    queryKey: KEY.settings,
    enabled,
    queryFn: async () =>
      authedGet<PardotSettings>(urls.emailWorkbenchSettings, await getAccessToken()),
    staleTime: 5 * 60 * 1000,
    retry: httpRetry,
  });
}

export function useSavePardotSettings() {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: PardotSettings) =>
      authedPut<PardotSettings>(urls.emailWorkbenchSettings, await getAccessToken(), body),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY.settings }),
  });
}

// ---- AI structure fill -----------------------------------------------------

// A mutation, not a query: it's genuinely non-idempotent from the user's point of
// view (the same draft can map differently on a second run), it costs a model
// call, and it must only fire when the user asks.
export function useStructureFill() {
  const getAccessToken = useAccessToken();
  return useMutation({
    mutationFn: async ({
      draft,
      templateBlocks,
      allowedKinds,
      mergeFields,
    }: {
      draft: string;
      templateBlocks: TemplateBlockSnap[];
      allowedKinds: string[];
      mergeFields: string[];
    }) =>
      authedPost<{ blocks: TargetBlock[] }>(urls.emailWorkbenchStructure, await getAccessToken(), {
        draft,
        template_blocks: templateBlocks,
        allowed_kinds: allowedKinds,
        merge_fields: mergeFields,
      }),
  });
}
