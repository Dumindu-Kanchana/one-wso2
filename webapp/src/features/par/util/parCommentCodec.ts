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


// How PAR stores free text on the wire.
//
// Every comment field — the employee's answer, the lead's review, the admin's
// note, a 360 comment — is stored **base64 of URI-encoded HTML**, not HTML:
//
//   write:  btoa(encodeURIComponent(html))
//   read:   decodeURIComponent(atob(stored))
//
// This is the standalone app's contract with the backend, in
// `slices/employeeSlice`, `threeSixtyReviewSlice`, `employeeHistorySlice` and
// `LeadReviewPanel`. It is not optional and it is not cosmetic: a port that
// sends raw HTML writes records the real app cannot read, and shows base64
// gibberish for every record the real app wrote.
//
// The `encodeURIComponent` wrapper is what makes it safe for non-Latin1 text —
// `btoa` alone throws on anything outside that range, so a comment containing
// an accent or an emoji would fail to save.

/**
 * The standalone app's own base64 test, reproduced exactly.
 *
 * Deliberately the same expression rather than a tidier one: it decides whether
 * a stored value is treated as content or discarded, so the two apps have to
 * agree on the answer for every value.
 */
const BASE64 = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;

/** HTML in, wire format out. */
export function encodeParComment(html: string | null | undefined): string {
  if (typeof html !== "string" || html === "") return "";
  return btoa(encodeURIComponent(html));
}

/**
 * Wire format in, HTML out.
 *
 * A value that is not base64, or that fails to decode, becomes an EMPTY string.
 * That is what the standalone app does, and matching it matters more than
 * salvaging the text: such a value is already invisible in the real app, so
 * passing it through here would show content the real app hides — a difference
 * a reader has no way to explain.
 */
export function decodeParComment(stored: string | null | undefined): string {
  if (typeof stored !== "string" || stored === "") return "";
  if (!BASE64.test(stored)) return "";
  try {
    return decodeURIComponent(atob(stored));
  } catch {
    return "";
  }
}

/**
 * Decode every comment on a PAR record.
 *
 * Applied at the API boundary rather than in components, so nothing downstream
 * has to remember: a component that renders `rating.parLeadComment` gets HTML,
 * and one that forgets to decode cannot exist.
 */
export function decodeRatingComments<
  T extends {
    parEmployeeComment?: string;
    parLeadComment?: string;
    parAdminComment?: string;
  },
>(rating: T | undefined): T | undefined {
  if (rating === undefined) return undefined;
  return {
    ...rating,
    parEmployeeComment: decodeParComment(rating.parEmployeeComment),
    parLeadComment: decodeParComment(rating.parLeadComment),
    parAdminComment: decodeParComment(rating.parAdminComment),
  };
}

/** Decode the comment on each 360 review. */
export function decodeReviewComments<T extends { reviewComment?: string }>(
  reviews: readonly T[],
): T[] {
  return reviews.map((r) => ({ ...r, reviewComment: decodeParComment(r.reviewComment) }));
}
