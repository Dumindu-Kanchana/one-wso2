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

// Authenticated binary downloads for the review exports.
//
// The two export endpoints return a CSV or a server-side zip, not JSON, so they can't
// go through authedGet — but they still need the Bearer token, so they can't be a plain
// link either. Same approach as @features/finance/util/financeReceipts and the Email
// Workbench thumbnails.

import { fetchWithReauth, HttpError } from "@api/http";

/** Fetch a binary endpoint with the Bearer token and hand it to the browser to save. */
export async function downloadAuthed(
  url: string,
  accessToken: string,
  filename: string,
): Promise<void> {
  const res = await fetchWithReauth(url, {}, accessToken);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new HttpError(url, res.status, body);
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoked on the next macrotask rather than synchronously. The claim that the click
  // has already handed the blob over holds in Chrome, but Safari has been observed to
  // start reading after the current task finishes — revoking in the same tick produced
  // a silently empty file, and a CSV export that writes 0 bytes without an error is a
  // bad way to find that out.
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}
