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

// Build the Header record for an authed request. Extra headers are spread
// FIRST so Authorization always wins — an untyped caller cannot accidentally
// overwrite the Bearer token by supplying an `Authorization` key of any
// case. `Content-Type` is added for methods that send a JSON body.
function buildHeaders(
  idToken: string,
  extraHeaders?: Record<string, string>,
  withJsonBody?: boolean,
): Record<string, string> {
  return {
    ...(extraHeaders ?? {}),
    ...(withJsonBody ? { "Content-Type": "application/json" } : {}),
    Authorization: `Bearer ${idToken}`,
  };
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

// Authed GET — Bearer <Asgardeo id_token>. Same header shape people-app's
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
  idToken: string,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  const res = await fetch(url, { headers: buildHeaders(idToken, extraHeaders) });
  if (!res.ok) await throwFromError(url, res, "authedGet");
  return readJsonOrThrow<T>(res, url);
}

// Authed POST with a JSON body. Returns parsed JSON when the response has
// a body, or null on 201/204. Same error semantics as authedGet.
export async function authedPost<T>(
  url: string,
  idToken: string,
  body: unknown,
  extraHeaders?: Record<string, string>,
): Promise<T | null> {
  const res = await fetch(url, {
    method: "POST",
    headers: buildHeaders(idToken, extraHeaders, true),
    body: JSON.stringify(body),
  });
  if (!res.ok) await throwFromError(url, res, "authedPost");
  return readJsonOrNull<T>(res, url);
}

// Authed PATCH with a JSON body. Returns parsed JSON when the response has
// a body, or null on 204. Same error semantics as authedPost.
export async function authedPatch<T>(
  url: string,
  idToken: string,
  body: unknown,
  extraHeaders?: Record<string, string>,
): Promise<T | null> {
  const res = await fetch(url, {
    method: "PATCH",
    headers: buildHeaders(idToken, extraHeaders, true),
    body: JSON.stringify(body),
  });
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
  idToken: string,
  extraHeaders?: Record<string, string>,
): Promise<void> {
  const res = await fetch(url, {
    method: "DELETE",
    headers: buildHeaders(idToken, extraHeaders),
  });
  if (!res.ok) await throwFromError(url, res, "authedDelete");
}
