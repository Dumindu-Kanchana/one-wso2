/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

/**
 * Whether this person has been offered the introductory tour.
 *
 * One flag, not a progress cursor. Dismissing the offer is a decision, so a
 * partial tour counts the same as a finished one: we asked, they answered, and
 * the tour stays reachable from the profile menu forever after. Storing a step
 * index instead would mean reappearing at whatever step someone walked away
 * from, which is the nagging behaviour this avoids.
 *
 * Per-user rather than per-browser, following @features/favourites — a browser
 * profile is shared more often than an account is, and "has this person seen the
 * tour" is a fact about the person.
 */
const STORAGE_KEY_BASE = "one-wso2.tour.v1";

function storageKey(sub: string): string {
  return `${STORAGE_KEY_BASE}.${sub}`;
}

/**
 * True when the tour has already been offered to this user.
 *
 * Unknown identity reads as SEEN, not unseen. The offer is only worth making to
 * someone we can remember answering it — without a sub we would re-ask on every
 * render and never be able to record the answer.
 */
export function hasSeenTour(sub: string | undefined): boolean {
  if (!sub) return true;
  try {
    return localStorage.getItem(storageKey(sub)) !== null;
  } catch {
    // Private browsing and blocked storage land here. An unreadable flag means
    // we cannot record an answer either, so treat it as answered and stay quiet
    // rather than offering a tour on every page view.
    return true;
  }
}

/** Records that the offer was made and answered, however it was answered. */
export function markTourSeen(sub: string | undefined): void {
  if (!sub) return;
  try {
    localStorage.setItem(storageKey(sub), new Date().toISOString());
  } catch {
    // Failing to persist is survivable: the tour shows once more next time.
    // Throwing out of a click handler is not.
  }
}

/** Test and support seam — lets a user be put back into the first-visit state. */
export function forgetTourSeen(sub: string | undefined): void {
  if (!sub) return;
  try {
    localStorage.removeItem(storageKey(sub));
  } catch {
    // Nothing to do: the flag stays, and the offer stays unmade.
  }
}
