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

// Translate a thrown value into a user-facing string. Prefers a well-formed
// `{message: "..."}` body (the digiops-finance backends use this shape),
// never returns the raw responseBody (which can carry stack traces /
// gateway HTML). Local to the finance feature so it doesn't depend on the
// shared helper that's still in review.
export function describeError(err: unknown): string {
  if (err instanceof HttpError) {
    if (err.responseBody) {
      try {
        const parsed = JSON.parse(err.responseBody) as { message?: unknown };
        if (parsed && typeof parsed.message === "string" && parsed.message.trim()) {
          return parsed.message;
        }
      } catch {
        // non-JSON body — fall through
      }
    }
    return `Something went wrong (HTTP ${err.status}).`;
  }
  if (err instanceof Error && err.message) return err.message;
  return "Something went wrong.";
}

// React Query retry predicate: skip 4xx (won't improve on retry), retry
// once otherwise.
export function financeRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof HttpError && error.status >= 400 && error.status < 500) return false;
  return failureCount < 1;
}
