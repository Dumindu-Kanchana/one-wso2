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

import { HttpError } from "@api/http";

// Receipt endpoints on the finance backends take/return RAW BINARY, not
// JSON or multipart — so they can't go through the shared authedPost helper
// (which JSON-encodes the body). These small helpers post the file bytes
// directly with the file's MIME type, and fetch a stored receipt back as an
// object URL for inline viewing. Same Bearer contract as @api/http.

export const RECEIPT_ACCEPT = "application/pdf,image/jpeg,image/png";
export const RECEIPT_MAX_BYTES = 10 * 1024 * 1024; // 10 MB (opd limit; expense is 5 MB)

// Upload one receipt file. Returns the server-generated file name that must
// be stored on the claim line as `receiptUrl`. Both backends wrap the name
// slightly differently ({fileName} vs {body:{fileName}}), so we accept both.
export async function uploadReceipt(
  url: string,
  idToken: string,
  file: File,
): Promise<string> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": file.type,
      Authorization: `Bearer ${idToken}`,
    },
    body: file,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new HttpError(url, res.status, body);
  }
  const text = await res.text();
  const parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {};
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

// Fetch a stored receipt (binary endpoint) as an object URL for preview.
export async function fetchReceiptObjectUrl(url: string, idToken: string): Promise<ReceiptSource> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new HttpError(url, res.status, body);
  }
  const blob = await res.blob();
  return { url: URL.createObjectURL(blob), type: blob.type || guessTypeFromUrl(url) };
}

// cc-expenses returns attachments as `{ body: <base64> }` (no MIME), so we
// sniff the type from the decoded magic bytes and hand back a data URL.
export async function fetchBase64Attachment(url: string, idToken: string): Promise<ReceiptSource> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new HttpError(url, res.status, body);
  }
  const json = (await res.json()) as { body?: unknown };
  const raw = typeof json.body === "string" ? json.body : "";
  if (!raw) throw new HttpError(url, res.status, "empty attachment");
  // Accept either a bare base64 string or an already-formed data URL.
  if (raw.startsWith("data:")) {
    const type = raw.slice(5, raw.indexOf(";")) || "application/octet-stream";
    return { url: raw, type };
  }
  const type = sniffBase64Type(raw);
  return { url: `data:${type};base64,${raw}`, type };
}

// PUT raw file bytes to an attachment endpoint (cc-expenses). Returns the
// server-stored file name from `{ body: fileName }`.
export async function putBinaryFile(url: string, idToken: string, file: File): Promise<string> {
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": file.type, Authorization: `Bearer ${idToken}` },
    body: file,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new HttpError(url, res.status, body);
  }
  const text = await res.text();
  const parsed = text ? (JSON.parse(text) as { body?: unknown; fileName?: unknown }) : {};
  const name = typeof parsed.body === "string" ? parsed.body : typeof parsed.fileName === "string" ? parsed.fileName : "";
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
