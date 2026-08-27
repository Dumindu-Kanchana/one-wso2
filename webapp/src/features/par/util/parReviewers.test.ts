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
  acceptableReviewers,
  normalizeEmail,
  reviewerProblem,
} from "@features/par/util/parReviewers";

const CTX = {
  selfEmail: "me@wso2.com",
  leadEmail: "lead@wso2.com",
  existing: ["already@wso2.com"] as const,
};

describe("who may be nominated", () => {
  it("accepts a colleague", () => {
    expect(reviewerProblem("peer@wso2.com", CTX)).toBeNull();
  });

  // The source's dialog skipped only the lead on your own PAR, so this was
  // possible: feedback you write about yourself, shown to your lead as a
  // colleague's view.
  it("refuses the employee themselves", () => {
    expect(reviewerProblem("me@wso2.com", CTX)).toBe("self");
  });

  it("refuses their lead, who reviews the PAR separately", () => {
    expect(reviewerProblem("lead@wso2.com", CTX)).toBe("lead");
  });

  it("refuses someone already asked", () => {
    expect(reviewerProblem("already@wso2.com", CTX)).toBe("duplicate");
  });

  it("refuses nothing and obvious non-addresses", () => {
    expect(reviewerProblem("", CTX)).toBe("empty");
    expect(reviewerProblem("   ", CTX)).toBe("empty");
    expect(reviewerProblem(undefined, CTX)).toBe("empty");
    for (const bad of ["peer", "peer@", "@wso2.com", "peer@wso2", "a b@wso2.com"]) {
      expect(reviewerProblem(bad, CTX), bad).toBe("invalid");
    }
  });
});

// Addresses reach this from what someone typed, from the directory, and from
// what the backend stored. Those three will not agree on case or padding.
describe("comparing addresses", () => {
  it("ignores case and padding when excluding the employee", () => {
    expect(reviewerProblem("  ME@WSO2.com ", CTX)).toBe("self");
  });

  it("ignores case and padding when excluding the lead", () => {
    expect(reviewerProblem("Lead@WSO2.COM", CTX)).toBe("lead");
  });

  it("ignores case and padding when spotting a duplicate", () => {
    expect(reviewerProblem("Already@wso2.com", CTX)).toBe("duplicate");
  });

  it("normalizes to a comparable form", () => {
    expect(normalizeEmail("  Peer@WSO2.Com ")).toBe("peer@wso2.com");
    expect(normalizeEmail(undefined)).toBe("");
  });
});

describe("filtering a whole nomination list", () => {
  it("keeps only what may be sent", () => {
    const out = acceptableReviewers(
      ["peer@wso2.com", "me@wso2.com", "lead@wso2.com", "already@wso2.com", "other@wso2.com"],
      CTX,
    );
    expect(out).toEqual(["peer@wso2.com", "other@wso2.com"]);
  });

  it("sends one copy when the same person is listed twice", () => {
    // Two identical entries would otherwise both pass, since neither is in
    // `existing` at the time it is checked.
    expect(acceptableReviewers(["peer@wso2.com", "PEER@wso2.com"], CTX)).toEqual([
      "peer@wso2.com",
    ]);
  });

  it("returns nothing when everything is excluded", () => {
    expect(acceptableReviewers(["me@wso2.com", "lead@wso2.com", ""], CTX)).toEqual([]);
  });

  it("works when the employee has no lead recorded", () => {
    // A blank lead must not exclude every address by matching the empty string.
    const out = acceptableReviewers(["peer@wso2.com"], {
      selfEmail: "me@wso2.com",
      leadEmail: null,
      existing: [],
    });
    expect(out).toEqual(["peer@wso2.com"]);
  });
});
