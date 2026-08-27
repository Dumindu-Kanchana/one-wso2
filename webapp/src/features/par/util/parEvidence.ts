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


// The supporting documents attached to a lead review.
//
// Stored in `parPerformanceNoticeAck` as a newline-separated list of URLs and
// nothing else — no ids, no names, no mime types. So whatever a file looks like
// on screen has to be derived from its URL, and anything derived is a guess that
// has to survive a URL shape nobody promised.
//
// That is also why pasting a link works as well as picking one: the picker's
// only job is producing a URL that ends up in this list.

export interface ParEvidenceFile {
  /** The Drive file id when the URL carries one, else the URL itself. */
  id: string;
  /** What to show. The stored form has no name, so this is the URL until picked. */
  name: string;
  url: string;
}

/** A Drive id out of a `/d/<id>/` URL, or the URL when it has no such segment. */
export function extractDriveId(url: string): string {
  const match = /\/d\/([a-zA-Z0-9_-]+)/.exec(url);
  return match ? match[1] : url;
}

/**
 * Whether a pasted link is plausibly a Google document.
 *
 * Deliberately shape-only: whether the lead can actually open it is between
 * them and Drive's own permissions, and a stricter pattern would reject valid
 * links from Google properties this does not know about. It exists to catch a
 * paste that is obviously not a link at all.
 */
export function isEvidenceUrl(raw: string | null | undefined): boolean {
  if (typeof raw !== "string") return false;
  const url = raw.trim();
  if (url === "") return false;
  // Only https, and only Google hosts: the field's purpose is documents held in
  // the company's own Drive, and an arbitrary link is not evidence of anything.
  return /^https:\/\/([a-z0-9-]+\.)*google\.com\//i.test(url);
}

/** Parse the stored newline-separated list. */
export function parseEvidenceUrls(raw: string | null | undefined): ParEvidenceFile[] {
  if (typeof raw !== "string") return [];
  const seen = new Set<string>();
  const files: ParEvidenceFile[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const url = line.trim();
    if (url === "") continue;
    // The same document attached twice is one document. The source kept both,
    // so a duplicate paste showed up as two identical chips.
    if (seen.has(url)) continue;
    seen.add(url);
    files.push({ id: extractDriveId(url), name: url, url });
  }
  return files;
}

/** Back to the stored form. */
export function serializeEvidenceUrls(files: readonly ParEvidenceFile[]): string {
  return files
    .map((f) => f.url.trim())
    .filter((url) => url !== "")
    .join("\n");
}

/**
 * Add a URL to a list, refusing duplicates.
 *
 * Returns the list unchanged when the URL is already present, so a caller can
 * tell nothing happened without comparing lengths.
 */
export function addEvidenceUrl(
  files: readonly ParEvidenceFile[],
  url: string,
): ParEvidenceFile[] {
  const trimmed = url.trim();
  if (trimmed === "") return [...files];
  if (files.some((f) => f.url.trim() === trimmed)) return [...files];
  return [...files, { id: extractDriveId(trimmed), name: trimmed, url: trimmed }];
}
