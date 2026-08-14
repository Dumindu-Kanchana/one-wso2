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

import { fetchWithReauth, HttpError } from "@api/http";

// Receipt endpoints on the finance backends take/return RAW BINARY, not
// JSON or multipart — so they can't go through the shared authedPost helper
// (which JSON-encodes the body). These small helpers post the file bytes
// directly with the file's MIME type, and fetch a stored receipt back as an
// object URL for inline viewing. Same Bearer contract as @api/http.

export const RECEIPT_ACCEPT = "application/pdf,image/jpeg,image/png";

// The backends enforce different max upload sizes, so the client limit must
// match per app — a shared 10 MB constant let the expense page accept a 6 MB
// file the expense backend then rejected.
export const OPD_RECEIPT_MAX_BYTES = 10 * 1024 * 1024; // opd-claims: 10 MB
export const EXPENSE_RECEIPT_MAX_BYTES = 5 * 1024 * 1024; // expense-claims: 5 MB
export const CC_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024; // cc-expenses: 5 MB

// Human label for a byte limit, so UI copy is derived from the constant
// rather than hardcoded ("10 MB" drifting from a 5 MB limit).
export function maxSizeLabel(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

// Parse a 2xx body as JSON, but never let a non-JSON 2xx (plain text / HTML
// from a proxy) surface as a raw SyntaxError — turn it into an HttpError so
// describeError shows an upload failure, not a parser message.
function parseJsonOrThrow(text: string, url: string, status: number): Record<string, unknown> {
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new HttpError(url, status, text);
  }
}

// Upload one receipt file. Returns the server-generated file name that must
// be stored on the claim line as `receiptUrl`. Both backends wrap the name
// slightly differently ({fileName} vs {body:{fileName}}), so we accept both.
//
// Routed through fetchWithReauth so an expired access_token still refreshes
// the session on a 401 — but it's a POST, so (per fetchWithReauth's policy)
// the request itself is never auto-replayed, only the original response is
// returned; the caller's own retry (re-submitting the form) goes out with
// the now-fresh token.
export async function uploadReceipt(
  url: string,
  accessToken: string,
  file: File,
): Promise<string> {
  const res = await fetchWithReauth(url, { method: "POST", headers: { "Content-Type": file.type }, body: file }, accessToken);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new HttpError(url, res.status, body);
  }
  const text = await res.text();
  const parsed = parseJsonOrThrow(text, url, res.status);
  const direct = parsed.fileName;
  const wrapped = (parsed.body as { fileName?: unknown } | undefined)?.fileName;
  const fileName = typeof direct === "string" ? direct : typeof wrapped === "string" ? wrapped : "";
  if (!fileName) throw new HttpError(url, res.status, text);
  return fileName;
}

// A previewable receipt: an object/data URL plus its MIME type so the viewer
// can pick <img> vs <iframe>. Object URLs must be revoked when done (data
// URLs are inert — revoking them is a harmless no-op).
export interface ReceiptSource {
  url: string;
  type: string;
}

// Only these types are ever previewed inline / labelled as their real type.
// Anything else is coerced to octet-stream so a mislabeled or HTML payload
// can't execute in the app origin (a top-level blob:/data: navigation of an
// HTML document runs same-origin — rel="noopener" doesn't help). Callers
// download non-previewable types rather than navigating to them.
const PREVIEWABLE_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);

function safeType(type: string): string {
  return PREVIEWABLE_TYPES.has(type) ? type : "application/octet-stream";
}

export function isPreviewable(type: string): boolean {
  return PREVIEWABLE_TYPES.has(type);
}

// Fetch a stored receipt (binary endpoint) as an object URL for preview.
// Routed through fetchWithReauth (GET is safe to replay) so an expired
// access_token doesn't just fail receipt viewing outright.
export async function fetchReceiptObjectUrl(url: string, accessToken: string): Promise<ReceiptSource> {
  const res = await fetchWithReauth(url, {}, accessToken);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new HttpError(url, res.status, body);
  }
  const blob = await res.blob();
  const type = safeType(blob.type || guessTypeFromUrl(url));
  // Re-wrap when coercing so the object URL carries the safe type, never the
  // original (possibly text/html) one.
  const safeBlob = type === blob.type ? blob : new Blob([blob], { type });
  return { url: URL.createObjectURL(safeBlob), type };
}

// cc-expenses returns attachments as `{ body: <base64> }` (no MIME), so we
// sniff the type from the decoded magic bytes and hand back a data URL.
// Routed through fetchWithReauth (GET is safe to replay) so an expired
// access_token doesn't just fail attachment viewing outright.
export async function fetchBase64Attachment(url: string, accessToken: string): Promise<ReceiptSource> {
  const res = await fetchWithReauth(url, {}, accessToken);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new HttpError(url, res.status, body);
  }
  const json = parseJsonOrThrow(await res.text(), url, res.status) as { body?: unknown };
  const raw = typeof json.body === "string" ? json.body : "";
  if (!raw) throw new HttpError(url, res.status, "empty attachment");
  // Accept either a bare base64 string or an already-formed data URL. Coerce
  // any non-previewable/mislabeled type to octet-stream (download, no inline
  // execution).
  if (raw.startsWith("data:")) {
    const declared = raw.slice(5, raw.indexOf(";")) || "application/octet-stream";
    const type = safeType(declared);
    if (type === declared) return { url: raw, type };
    // Rebuild the data URL under the safe type, preserving the base64 payload.
    const comma = raw.indexOf(",");
    const payload = comma >= 0 ? raw.slice(comma + 1) : "";
    return { url: `data:${type};base64,${payload}`, type };
  }
  const type = safeType(sniffBase64Type(raw));
  return { url: `data:${type};base64,${raw}`, type };
}

// PUT raw file bytes to an attachment endpoint (cc-expenses). Returns the
// server-stored file name from `{ body: fileName }`.
//
// Routed through fetchWithReauth — same refresh-but-don't-replay policy as
// uploadReceipt above (PUT isn't auto-replayed either).
export async function putBinaryFile(url: string, accessToken: string, file: File): Promise<string> {
  const res = await fetchWithReauth(url, { method: "PUT", headers: { "Content-Type": file.type }, body: file }, accessToken);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new HttpError(url, res.status, body);
  }
  const text = await res.text();
  const parsed = parseJsonOrThrow(text, url, res.status) as { body?: unknown; fileName?: unknown };
  const name = typeof parsed.body === "string" ? parsed.body : typeof parsed.fileName === "string" ? parsed.fileName : "";
  // Fail the same way uploadReceipt does — never return "" so a caller can't
  // store an empty attachment name.
  if (!name) throw new HttpError(url, res.status, text);
  return name;
}

// PDF/PNG/JPEG have stable base64 prefixes; default to octet-stream.
function sniffBase64Type(b64: string): string {
  if (b64.startsWith("JVBER")) return "application/pdf"; // %PDF
  if (b64.startsWith("iVBOR")) return "image/png"; // \x89PNG
  if (b64.startsWith("/9j/")) return "image/jpeg"; // JFIF
  return "application/octet-stream";
}

function guessTypeFromUrl(url: string): string {
  const clean = url.split("?")[0].toLowerCase();
  if (clean.endsWith(".pdf")) return "application/pdf";
  if (clean.endsWith(".png")) return "image/png";
  if (clean.endsWith(".jpg") || clean.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

// Extract a lowercase extension from a File (for the cc upload query param).
export function fileExtension(file: File): string {
  const dot = file.name.lastIndexOf(".");
  if (dot >= 0 && dot < file.name.length - 1) return file.name.slice(dot + 1).toLowerCase();
  if (file.type === "application/pdf") return "pdf";
  if (file.type === "image/png") return "png";
  if (file.type === "image/jpeg") return "jpeg";
  return "bin";
}
