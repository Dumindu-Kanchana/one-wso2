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

// Shared HTTP primitives. Every feature slice that fetches from a backend
// should import from here so retry policies, error typing, and Bearer /
// x-jwt-assertion contract stay consistent across the app.
//
// The global QueryClient in AppWithConfig keys its retry logic off
// `HttpError.status`, so features MUST throw HttpError (or subclasses) on
// non-2xx to get the right retry behavior.

import { refreshAccessToken } from "@api/authBridge";

// Thrown on non-2xx responses (and on unexpectedly-empty 2xx GETs). Carries
// the HTTP status so retry logic (both per-query in features and global in
// AppWithConfig) can key off it without regex-parsing the message.
//
// The user-facing `.message` intentionally omits the raw response body —
// backend diagnostics can leak stack traces / internal identifiers and
// this Error can surface in UI error banners. Sanitized body is preserved
// on `.responseBody` for controlled dev logging but never in the message.
export class HttpError extends Error {
  readonly status: number;
  readonly url: string;
  readonly responseBody: string;
  constructor(url: string, status: number, body: string) {
    super(`Request failed with HTTP ${status}`);
    this.name = "HttpError";
    this.status = status;
    this.url = url;
    this.responseBody = body;
  }
}

// One-place translator from any thrown value to a user-facing string,
// used by every dialog / notification banner that surfaces a request
// failure. Prefers a well-formed `{message: "..."}` body when the
// backend supplies one, and otherwise falls back to a status-only
// message — the raw `responseBody` is NEVER returned to the UI,
// because backend responses can include stack traces, internal ids,
// gateway HTML pages, etc. The class comment on HttpError above
// documented this intent; we now enforce it in one place instead of
// six near-duplicate copy-pastes across dialog components.
export function humanizeHttpError(err: unknown): string {
  if (err instanceof HttpError) {
    if (err.responseBody) {
      try {
        const parsed = JSON.parse(err.responseBody) as { message?: unknown };
        if (parsed && typeof parsed.message === "string" && parsed.message.trim()) {
          return parsed.message;
        }
      } catch {
        // Non-JSON body — fall through to the status-only message.
      }
    }
    return `Something went wrong (HTTP ${err.status}).`;
  }
  if (err instanceof Error && err.message) return err.message;
  return "Something went wrong.";
}

// Build the Header record for an authed request. Extra headers are spread
// FIRST so Authorization always wins — an untyped caller cannot accidentally
// overwrite the Bearer token by supplying an `Authorization` key of any
// case. `Content-Type` is added for methods that send a JSON body.
function buildHeaders(
  accessToken: string,
  extraHeaders?: Record<string, string>,
  withJsonBody?: boolean,
): Record<string, string> {
  return {
    ...(extraHeaders ?? {}),
    ...(withJsonBody ? { "Content-Type": "application/json" } : {}),
    Authorization: `Bearer ${accessToken}`,
  };
}

// The access_token eventually expires and getAccessToken() never checks
// that itself (it's a plain storage read), so any long-lived tab
// eventually attaches a dead token and every backend starts 401ing at
// once. On a 401 specifically — never other statuses — try one silent
// re-auth (dedup'd across concurrent callers in @api/authBridge).
//
// Only GET is safe to replay ourselves. A 401 doesn't prove a POST/PATCH/
// DELETE never reached business logic — each backend has its own
// JwtInterceptor in addition to the gateway's, and none of the ~15
// backends this app talks to support a client-supplied idempotency key —
// so resubmitting a mutation risks a duplicate submit/approve/claim if
// that assumption is ever wrong for one of them. For those, still refresh
// (heals the session for the user's *next* attempt) but surface the
// original 401 rather than replaying it.
//
// If there's no way to refresh (accessors not registered yet, or the
// silent re-auth itself fails — e.g. no live Asgardeo session at all),
// fall back to the original 401 response so the caller's normal
// HttpError/error-banner path handles it, rather than surfacing a
// different failure mode for this one case.
async function fetchWithReauth(url: string, init: RequestInit, accessToken: string): Promise<Response> {
  const withAuth = (token: string): RequestInit => ({
    ...init,
    headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}` },
  });
  const first = await fetch(url, withAuth(accessToken));
  if (first.status !== 401) return first;

  const isReplaySafe = (init.method ?? "GET").toUpperCase() === "GET";
  let freshToken: string;
  try {
    freshToken = await refreshAccessToken();
  } catch {
    return first;
  }
  if (!isReplaySafe) return first;
  return fetch(url, withAuth(freshToken));
}

// Parse a 2xx response body as JSON. Both the empty-body case (204,
// Content-Length 0, or a Ballerina resource returning `()`) AND a
// non-empty NON-JSON body (a gateway HTML page, a plain-text error page,
// or anything else that isn't well-formed JSON) throw HttpError — so
// callers see the same HttpError.status-keyed retry/handling path they
// see for real 4xx/5xx responses, rather than a bare SyntaxError.
//
// Not currently reachable via any of our documented endpoints (every
// backend response we consume is a typed Ballerina record with a
// non-empty JSON body on success), but the guard exists so an
// intermediate proxy or gateway that decides to answer with an HTML
// error page can't crash a query hook.
async function readJsonOrThrow<T>(res: Response, url: string): Promise<T> {
  if (res.status === 204 || res.headers.get("content-length") === "0") {
    throw new HttpError(url, res.status, "");
  }
  const text = await res.text();
  if (!text) {
    throw new HttpError(url, res.status, "");
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError(url, res.status, text);
  }
}

// Same behavior for POST/PATCH where an empty response is a legitimate
// "success but no body" — return null. Non-empty non-JSON bodies still
// throw HttpError for the same reason as readJsonOrThrow above.
async function readJsonOrNull<T>(res: Response, url: string): Promise<T | null> {
  if (res.status === 204 || res.headers.get("content-length") === "0") return null;
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError(url, res.status, text);
  }
}

async function throwFromError(url: string, res: Response, method: string): Promise<never> {
  const body = await res.text().catch(() => "");
  if (import.meta.env.DEV && body) {
    console.warn(`[${method}] ${url} → HTTP ${res.status}: ${body.slice(0, 400)}`);
  }
  throw new HttpError(url, res.status, body);
}

// Authed GET — Bearer <Asgardeo access_token>. Same header shape people-app's
// axios interceptor sets (Choreo's gateway rewrites this into
// x-jwt-assertion for the backend's JwtInterceptor).
//
// No Content-Type header on GET: with no body the header is meaningless
// and makes the request non-simple, forcing an unnecessary CORS preflight.
// `extraHeaders` lets specific callers (e.g. promotion-app / par-app,
// which require `x-user-timezone-offset`) add per-backend quirks without
// polluting the core helper. The Authorization header is applied after
// extra headers so it cannot be silently overridden.
export async function authedGet<T>(
  url: string,
  accessToken: string,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  const res = await fetchWithReauth(url, { headers: buildHeaders(accessToken, extraHeaders) }, accessToken);
  if (!res.ok) await throwFromError(url, res, "authedGet");
  return readJsonOrThrow<T>(res, url);
}

// Authed POST with a JSON body. Returns parsed JSON when the response has
// a body, or null on 201/204. Same error semantics as authedGet.
export async function authedPost<T>(
  url: string,
  accessToken: string,
  body: unknown,
  extraHeaders?: Record<string, string>,
): Promise<T | null> {
  const res = await fetchWithReauth(
    url,
    { method: "POST", headers: buildHeaders(accessToken, extraHeaders, true), body: JSON.stringify(body) },
    accessToken,
  );
  if (!res.ok) await throwFromError(url, res, "authedPost");
  return readJsonOrNull<T>(res, url);
}

// Authed PATCH with a JSON body. Returns parsed JSON when the response has
// a body, or null on 204. Same error semantics as authedPost.
export async function authedPatch<T>(
  url: string,
  accessToken: string,
  body: unknown,
  extraHeaders?: Record<string, string>,
): Promise<T | null> {
  const res = await fetchWithReauth(
    url,
    { method: "PATCH", headers: buildHeaders(accessToken, extraHeaders, true), body: JSON.stringify(body) },
    accessToken,
  );
  if (!res.ok) await throwFromError(url, res, "authedPatch");
  return readJsonOrNull<T>(res, url);
}

// Shared React Query retry predicate. Skip retries on 4xx (they don't
// improve with a retry — the caller sent a bad request, or the user
// isn't authorized) and retry once on anything else. Kept next to the
// HTTP primitives so every hook's retry story stays consistent with the
// error typing here — before this existed, ~8 hooks each had their own
// copy of this predicate and drifted from the global QueryClient
// policy in AppWithConfig.
//
// Note the global QueryClient policy uses a stricter rule (retry only
// 502/503, up to twice). Per-query retry overrides the global policy,
// so any hook that opts into this predicate deliberately supersedes
// the global — that's the intended contract for the my-page queries,
// which cover a heterogeneous set of backends where transient upstream
// errors can be any 5xx.
export function defaultQueryRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof HttpError && error.status >= 400 && error.status < 500) return false;
  return failureCount < 1;
}

// Authed DELETE. Returns nothing; throws HttpError on non-2xx.
export async function authedDelete(
  url: string,
  accessToken: string,
  extraHeaders?: Record<string, string>,
): Promise<void> {
  const res = await fetchWithReauth(
    url,
    { method: "DELETE", headers: buildHeaders(accessToken, extraHeaders) },
    accessToken,
  );
  if (!res.ok) await throwFromError(url, res, "authedDelete");
}
