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

import { describe, expect, it } from "vitest";
import { byLongestWait, daysWaiting, waitingLabel, waitingSince } from "./claimWaiting";
import type { ExpenseClaim } from "../expense/expenseTypes";

// Backends return UTC datetimes, and `daysWaiting` compares LOCAL calendar
// days — so a fixture written as a bare "…Z" string lands on whichever local
// day the runner's offset puts it on. Building each instant from local parts
// and serialising it keeps these assertions true in every timezone; the first
// draft of this file asserted the UTC day and failed in the suite's own zone.
const iso = (y: number, m: number, d: number, h = 9) => new Date(y, m, d, h).toISOString();

const claim = (over: Partial<ExpenseClaim> & { statusDetails?: unknown }) =>
  ({
    id: "EXP-1",
    transactions: [],
    totalAmount: 100,
    currencyCode: "USD",
    employeeEmail: "a@wso2.com",
    leadEmails: [],
    createdDate: iso(2026, 7, 1),
    statusDetails: { status: "PENDING_LEAD", leadApprovedDate: null },
    ...over,
  }) as ExpenseClaim;

// The number answers "whose backlog is this", so it has to start when the claim
// reached its current approver — not when it was filed.
describe("when the wait started", () => {
  it("is submission, while a claim is still with its lead", () => {
    expect(waitingSince(claim({}))).toBe(iso(2026, 7, 1));
  });

  it("is the lead's approval, once it is with finance", () => {
    const c = claim({
      statusDetails: { status: "PENDING_FINANCE", leadApprovedDate: iso(2026, 7, 9) },
    } as Partial<ExpenseClaim>);
    expect(waitingSince(c)).toBe(iso(2026, 7, 9));
  });

  // Dating a finance wait from submission would charge finance for the lead's
  // week, which is the opposite of what this column is for.
  it("does not blame finance for the time the lead had it", () => {
    const c = claim({
      createdDate: iso(2026, 7, 1),
      statusDetails: { status: "PENDING_FINANCE", leadApprovedDate: iso(2026, 7, 9) },
    } as Partial<ExpenseClaim>);
    expect(daysWaiting(waitingSince(c), new Date(2026, 7, 11))).toBe(2);
    expect(daysWaiting(c.createdDate, new Date(2026, 7, 11))).toBe(10);
  });

  // An OPD claim has no lead stage, so there is no earlier date to prefer.
  it("falls back to submission when there is no lead approval recorded", () => {
    const c = claim({
      statusDetails: { status: "PENDING_FINANCE", leadApprovedDate: null },
    } as Partial<ExpenseClaim>);
    expect(waitingSince(c)).toBe(iso(2026, 7, 1));
  });
});

describe("counting the days", () => {
  it("counts calendar days, so overnight is a day and not zero", () => {
    expect(daysWaiting(iso(2026, 7, 10, 23), new Date(2026, 7, 11, 8))).toBe(1);
  });

  it("is zero on the day it arrived", () => {
    expect(daysWaiting(iso(2026, 7, 11, 2), new Date(2026, 7, 11, 20))).toBe(0);
  });

  it("never goes negative on a future date", () => {
    expect(daysWaiting(iso(2026, 8, 1), new Date(2026, 7, 11))).toBe(0);
  });

  it("survives a date it cannot parse", () => {
    expect(daysWaiting("not a date")).toBe(0);
  });

  it("reads as a duration", () => {
    expect(waitingLabel(0)).toBe("today");
    expect(waitingLabel(1)).toBe("1 day");
    expect(waitingLabel(12)).toBe("12 days");
  });
});

describe("ordering the queue", () => {
  it("puts the longest wait first", () => {
    const items = [
      { id: "new", at: iso(2026, 7, 10) },
      { id: "oldest", at: iso(2026, 7, 1) },
      { id: "middle", at: iso(2026, 7, 5) },
    ];
    expect(byLongestWait(items, (i) => i.at).map((i) => i.id)).toEqual([
      "oldest",
      "middle",
      "new",
    ]);
  });

  it("leaves the caller's array alone", () => {
    const items = [{ at: iso(2026, 7, 10) }, { at: iso(2026, 7, 1) }];
    byLongestWait(items, (i) => i.at);
    expect(items[0].at).toBe(iso(2026, 7, 10));
  });
});
