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

// How long a claim has been waiting on the person now looking at it.
//
// Not the same as how long ago it was filed. An expense claim at the finance
// stage has been with finance only since the lead approved it — dating that
// wait from submission would blame finance for the lead's week, and the whole
// point of showing this is to know whose backlog it is.

/**
 * The instant a claim started waiting on its CURRENT approver.
 *
 * Structural rather than typed to either claim: both carry the two fields this
 * reads, and both queues are ordered by the same helper.
 */
export interface WaitingClaim {
  createdDate: string;
  statusDetails: { status?: string | null; leadApprovedDate?: string | null };
}

export function waitingSince(claim: WaitingClaim): string {
  // Only the expense flow has a stage before this one; `leadApprovedDate` is
  // absent on an OPD claim and on an expense claim still with its lead.
  if (claim.statusDetails.status === "PENDING_FINANCE" && claim.statusDetails.leadApprovedDate) {
    return claim.statusDetails.leadApprovedDate;
  }
  return claim.createdDate;
}

/**
 * Whole days between `since` and `now`, floored, never negative.
 *
 * Compared as calendar days in local time rather than by dividing a
 * millisecond difference: a claim filed at 23:00 and looked at at 08:00 the
 * next morning has been waiting a day, not zero, and that is the number an
 * approver recognises. Local, because the reader's day is the one that counts.
 */
export function daysWaiting(since: string, now: Date = new Date()): number {
  const start = new Date(since);
  if (Number.isNaN(start.getTime())) return 0;
  const startDay = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const nowDay = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((nowDay - startDay) / 86_400_000));
}

/** "today", "1 day", "12 days" — the column reads as a duration, not a date. */
export function waitingLabel(days: number): string {
  if (days <= 0) return "today";
  return days === 1 ? "1 day" : `${days} days`;
}

/** Longest wait first: the one someone is chasing is the one to show first. */
export function byLongestWait<T>(items: T[], since: (item: T) => string): T[] {
  return [...items].sort((a, b) => new Date(since(a)).getTime() - new Date(since(b)).getTime());
}
