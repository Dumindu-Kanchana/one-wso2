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


import { describe, expect, it } from "vitest";
import {
  bulkShareProblem,
  describeBulkShare,
  summarizeBulkShare,
  type BulkShareCandidate,
} from "@features/par/util/parBulkShare";

const draft = (id: number): BulkShareCandidate => ({
  parRatingId: id,
  parEmployeeEmail: `p${id}@wso2.com`,
  parLeadStatus: "DRAFT",
});

describe("whether a bulk share can go ahead", () => {
  it("allows a selection that is all drafts", () => {
    expect(bulkShareProblem([draft(1), draft(2)])).toBeNull();
  });

  it("refuses an empty selection", () => {
    expect(bulkShareProblem([])).toBe("noneSelected");
  });

  // All-or-nothing on purpose: quietly filtering a mixed selection to the
  // shareable rows would let a lead believe they had shared somebody they had not.
  it("refuses a mixed selection rather than filtering it", () => {
    expect(bulkShareProblem([draft(1), { ...draft(2), parLeadStatus: "SHARED" }])).toBe(
      "notAllDrafts",
    );
    expect(bulkShareProblem([draft(1), { ...draft(2), parLeadStatus: "PENDING" }])).toBe(
      "notAllDrafts",
    );
    expect(bulkShareProblem([{ ...draft(1), parLeadStatus: undefined }])).toBe("notAllDrafts");
  });
});

// Partial success is the normal outcome, not an edge case: it is one PATCH per
// person and the fifth can fail on quota while the first four go through.
describe("summarising what happened", () => {
  it("counts both halves", () => {
    const s = summarizeBulkShare([
      { email: "a@wso2.com", ok: true },
      { email: "b@wso2.com", ok: false, reason: "Quota full" },
      { email: "c@wso2.com", ok: true },
    ]);
    expect(s.succeeded).toBe(2);
    expect(s.failed).toBe(1);
    expect(s.failedEmails).toEqual(["b@wso2.com"]);
  });

  it("de-duplicates identical reasons", () => {
    // Twelve rows failing the same quota is one sentence, not twelve.
    const s = summarizeBulkShare([
      { email: "a@wso2.com", ok: false, reason: "Quota full" },
      { email: "b@wso2.com", ok: false, reason: "Quota full" },
      { email: "c@wso2.com", ok: false, reason: "Not shared by employee" },
    ]);
    expect(s.reasons).toEqual(["Quota full", "Not shared by employee"]);
    expect(s.failed).toBe(3);
  });

  it("keeps which people failed, since that is what needs acting on", () => {
    const s = summarizeBulkShare([
      { email: "a@wso2.com", ok: false },
      { email: "b@wso2.com", ok: true },
    ]);
    expect(s.failedEmails).toEqual(["a@wso2.com"]);
  });

  it("ignores a blank reason rather than listing an empty line", () => {
    const s = summarizeBulkShare([{ email: "a@wso2.com", ok: false, reason: "   " }]);
    expect(s.reasons).toEqual([]);
    expect(s.failed).toBe(1);
  });

  it("is all zeroes for nothing", () => {
    expect(summarizeBulkShare([])).toEqual({
      succeeded: 0,
      failed: 0,
      reasons: [],
      failedEmails: [],
    });
  });
});

describe("describing the result", () => {
  const summary = (succeeded: number, failed: number) => ({
    succeeded,
    failed,
    reasons: [],
    failedEmails: [],
  });

  it("says both halves on a partial result", () => {
    // Reporting only failures hides work that was done; only successes hides
    // work that was not.
    expect(describeBulkShare(summary(4, 1))).toBe("4 shared, 1 couldn't be");
  });

  it("reads naturally for one and for many", () => {
    expect(describeBulkShare(summary(1, 0))).toBe("Review shared");
    expect(describeBulkShare(summary(3, 0))).toBe("3 reviews shared");
    expect(describeBulkShare(summary(0, 1))).toBe("That review couldn't be shared");
    expect(describeBulkShare(summary(0, 3))).toBe("None of the 3 could be shared");
  });
});
