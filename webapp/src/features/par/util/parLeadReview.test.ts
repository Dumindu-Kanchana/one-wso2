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
  DEFAULT_PAR_RATING_RULES as RULES,
  canPickSpecialRating,
  draftAfterRatingChange,
  isEvidenceSatisfied,
  leadShareBlocker,
  type LeadReviewDraft,
} from "@features/par/util/parLeadReview";

function draft(over: Partial<LeadReviewDraft> = {}): LeadReviewDraft {
  return {
    rating: "Successful",
    specialRating: "NOT_ASSIGNED",
    evidenceConfirmed: false,
    evidenceFileCount: 0,
    top5p20pConfirmed: false,
    ...over,
  };
}

const OPEN = {
  locked: false,
  leadDeadlinePassed: false,
  employeeStatus: "SHARED" as const,
};

describe("sharing a lead review", () => {
  it("is allowed once the employee has shared and the deadline is ahead", () => {
    expect(leadShareBlocker({ ...OPEN, draft: draft() }, RULES)).toBeNull();
  });

  it("is blocked before the employee has shared theirs", () => {
    // There is nothing to review yet, and the backend refuses it too.
    expect(
      leadShareBlocker({ ...OPEN, employeeStatus: "PENDING", draft: draft() }, RULES),
    ).toBe("employeeNotShared");
  });

  it("is blocked once the lead deadline has passed", () => {
    expect(
      leadShareBlocker({ ...OPEN, leadDeadlinePassed: true, draft: draft() }, RULES),
    ).toBe("deadlinePassed");
  });

  it("is blocked outright when locked, above every other reason", () => {
    expect(
      leadShareBlocker(
        {
          locked: true,
          leadDeadlinePassed: true,
          employeeStatus: "PENDING",
          draft: draft({ rating: RULES.evidenceRating }),
        },
        RULES,
      ),
    ).toBe("locked");
  });

  it("prefers the employee's status over the deadline", () => {
    // Both apply; "they haven't shared yet" is the actionable one.
    expect(
      leadShareBlocker(
        { locked: false, leadDeadlinePassed: true, employeeStatus: "PENDING", draft: draft() },
        RULES,
      ),
    ).toBe("employeeNotShared");
  });
});

// An admin auditing a live cycle gets this screen with the deadline and
// employee-status guards off. Accepted behaviour, recorded in §9 — pinned here
// so it cannot be "fixed" by accident.
describe("the admin audit view", () => {
  it("bypasses the deadline and the employee's status", () => {
    expect(
      leadShareBlocker(
        {
          locked: false,
          leadDeadlinePassed: true,
          employeeStatus: "PENDING",
          adminAuditView: true,
          draft: draft(),
        },
        RULES,
      ),
    ).toBeNull();
  });

  it("does NOT bypass the evidence requirement", () => {
    // Evidence is about the record being defensible, not about who is looking.
    expect(
      leadShareBlocker(
        {
          ...OPEN,
          adminAuditView: true,
          draft: draft({ rating: RULES.evidenceRating }),
        },
        RULES,
      ),
    ).toBe("evidenceIncomplete");
  });

  it("does not bypass a locked review", () => {
    expect(
      leadShareBlocker({ ...OPEN, locked: true, adminAuditView: true, draft: draft() }, RULES),
    ).toBe("locked");
  });
});

describe("the evidence requirement", () => {
  const evidence = (over: Partial<LeadReviewDraft> = {}) =>
    draft({ rating: RULES.evidenceRating, ...over });

  it("does not apply to other ratings", () => {
    expect(isEvidenceSatisfied(draft({ rating: "Successful" }), RULES)).toBe(true);
    expect(isEvidenceSatisfied(draft({ rating: "" }), RULES)).toBe(true);
  });

  it("needs BOTH the confirmation and a file", () => {
    expect(isEvidenceSatisfied(evidence(), RULES)).toBe(false);
    expect(isEvidenceSatisfied(evidence({ evidenceConfirmed: true }), RULES)).toBe(false);
    expect(isEvidenceSatisfied(evidence({ evidenceFileCount: 2 }), RULES)).toBe(false);
    expect(
      isEvidenceSatisfied(evidence({ evidenceConfirmed: true, evidenceFileCount: 1 }), RULES),
    ).toBe(true);
  });

  it("blocks the share while incomplete", () => {
    expect(leadShareBlocker({ ...OPEN, draft: evidence({ evidenceConfirmed: true }) }, RULES)).toBe(
      "evidenceIncomplete",
    );
  });

  it("follows the configured rating, not a hardcoded one", () => {
    const rules = { top5p20pRating: "Great", evidenceRating: "Concern" };
    expect(isEvidenceSatisfied(draft({ rating: "Needs Improvement" }), rules)).toBe(true);
    expect(isEvidenceSatisfied(draft({ rating: "Concern" }), rules)).toBe(false);
  });
});

describe("assigning Top 5% / 20%", () => {
  it("needs the eligible rating AND the confirmation", () => {
    expect(canPickSpecialRating(draft(), RULES)).toBe(false);
    expect(canPickSpecialRating(draft({ top5p20pConfirmed: true }), RULES)).toBe(true);
    expect(
      canPickSpecialRating(draft({ rating: "Needs Improvement", top5p20pConfirmed: true }), RULES),
    ).toBe(false);
  });

  it("is never available with no rating chosen", () => {
    expect(canPickSpecialRating(draft({ rating: "", top5p20pConfirmed: true }), RULES)).toBe(false);
  });
});

// Silent when wrong: nothing on screen says a stale special rating is still
// attached to a rating that no longer permits one.
describe("changing the rating", () => {
  it("withdraws a special rating the new rating does not permit", () => {
    const before = draft({ specialRating: "TOP5P", top5p20pConfirmed: true });
    const after = draftAfterRatingChange(before, "Needs Improvement", RULES);
    expect(after.specialRating).toBe("NOT_ASSIGNED");
    expect(after.top5p20pConfirmed).toBe(false);
  });

  it("withdraws evidence when the concern is no longer being raised", () => {
    const before = draft({
      rating: RULES.evidenceRating,
      evidenceConfirmed: true,
      evidenceFileCount: 2,
    });
    const after = draftAfterRatingChange(before, "Successful", RULES);
    expect(after.evidenceConfirmed).toBe(false);
    expect(after.evidenceFileCount).toBe(0);
  });

  it("keeps a special rating when the new rating still permits one", () => {
    const before = draft({ specialRating: "TOP20P", top5p20pConfirmed: true });
    const after = draftAfterRatingChange(before, RULES.top5p20pRating, RULES);
    expect(after.specialRating).toBe("TOP20P");
    expect(after.top5p20pConfirmed).toBe(true);
  });

  it("clears both when the rating is cleared entirely", () => {
    const before = draft({
      rating: RULES.top5p20pRating,
      specialRating: "TOP5P",
      top5p20pConfirmed: true,
      evidenceConfirmed: true,
      evidenceFileCount: 1,
    });
    const after = draftAfterRatingChange(before, "", RULES);
    expect(after.specialRating).toBe("NOT_ASSIGNED");
    expect(after.top5p20pConfirmed).toBe(false);
    expect(after.evidenceConfirmed).toBe(false);
    expect(after.evidenceFileCount).toBe(0);
  });

  it("does not mutate the draft it was given", () => {
    const before = draft({ specialRating: "TOP5P", top5p20pConfirmed: true });
    draftAfterRatingChange(before, "Needs Improvement", RULES);
    expect(before.specialRating).toBe("TOP5P");
    expect(before.top5p20pConfirmed).toBe(true);
  });
});
