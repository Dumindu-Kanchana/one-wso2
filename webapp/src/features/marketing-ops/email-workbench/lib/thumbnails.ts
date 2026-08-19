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

// Template thumbnails.
//
// These are the one endpoint in this operation that returns an IMAGE rather than
// JSON, and it still requires the Authorization header — so it cannot be an
// `<img src>`. The bytes are fetched with the Bearer token and handed to the DOM
// as an object URL. Same approach as @features/finance/util/financeReceipts.
//
// Object URLs are a manual-lifetime resource, and this is where that gets
// interesting: a template's thumbnail is shown in BOTH galleries (the compose
// picker and the admin catalog), so revoking on one component's unmount would
// blank the image in the other. Ownership therefore lives in this module, and a
// URL is revoked only when a NEWER version of the same template supersedes it.
//
// `version` is the template's `updated_at`. It participates in the cache key AND
// is sent as `?v=`, so the URL is immutable from the HTTP layer's point of view
// and a re-uploaded thumbnail busts both caches at once.

import { fetchWithReauth } from "@api/http";
import { marketingOpsServiceUrls } from "@config/apiConfig";

// key (`id:version`) → in-flight or resolved object URL.
const thumbCache = new Map<string, Promise<string | null>>();
// id → its current cache key. Without this, evicting a superseded thumbnail would
// mean scanning every key on each miss — O(N) per template, O(N²) across a gallery
// load. With it, eviction is O(1).
const thumbLatest = new Map<string, string>();

async function load(
  id: string,
  version: string | undefined,
  accessToken: string,
): Promise<string | null> {
  const url = marketingOpsServiceUrls.emailWorkbenchTemplateThumbnail(id, version);
  try {
    const res = await fetchWithReauth(url, {}, accessToken);
    if (!res.ok) return null;
    const blob = await res.blob();
    // A zero-byte 200 is a template without a thumbnail, not an error — callers
    // render their placeholder for null either way.
    return blob.size > 0 ? URL.createObjectURL(blob) : null;
  } catch {
    return null;
  }
}

// Fetch (or reuse) a template's thumbnail as an object URL. Returns null when the
// template has no thumbnail or the fetch failed — a missing preview image is never
// worth failing a gallery over.
export function fetchThumbnail(
  id: string,
  version: string | undefined,
  accessToken: string,
): Promise<string | null> {
  const key = `${id}:${version ?? ""}`;
  let p = thumbCache.get(key);
  if (!p) {
    const prev = thumbLatest.get(id);
    if (prev && prev !== key) {
      const old = thumbCache.get(prev);
      thumbCache.delete(prev);
      void old?.then((u) => {
        if (u) URL.revokeObjectURL(u);
      });
    }
    thumbLatest.set(id, key);
    p = load(id, version, accessToken).then((url) => {
      // Don't cache failures — a transient error shouldn't permanently blank a
      // thumbnail for the rest of the session.
      if (url === null) thumbCache.delete(key);
      return url;
    });
    thumbCache.set(key, p);
  }
  return p;
}
