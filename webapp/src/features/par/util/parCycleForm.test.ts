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
  emptyParCycleForm,
  isParCycleFormValid,
  parCycleFormProblems,
  type ParCycleFormValues,
} from "@features/par/util/parCycleForm";

/** A cycle whose dates are all in order. */
function valid(over: Partial<ParCycleFormValues> = {}): ParCycleFormValues {
  return {
    parCycleName: "H1 2026",
    parCycleStartDate: "2026-01-01",
    parCycleEndDate: "2026-06-30",
    parEvaluationStartDate: "2026-06-01",
    parEvaluationEndDate: "2026-06-30",
    parEmployeeDeadline: "2026-06-10",
    parThreeSixtyRatingDeadline: "2026-06-15",
    parLeadDeadline: "2026-06-20",
    parSpecialRatingDeadline: "2026-06-25",
    parF2FDeadline: "2026-06-28",
    employeeParQuestion: "What did you deliver?",
    threeSixtyReviewQuestion: "How did they contribute?",
    parRatings: ["Successful"],
    threeSixtyReviewRatings: ["Strong"],
    ...over,
  };
}

describe("a well-formed cycle", () => {
  it("has no problems", () => {
    expect(parCycleFormProblems(valid())).toEqual({});
    expect(isParCycleFormValid(valid())).toBe(true);
  });
});

describe("what is required", () => {
  it("reports every empty field on a blank form", () => {
    const p = parCycleFormProblems(emptyParCycleForm());
    for (const field of [
      "parCycleName",
      "parCycleStartDate",
      "parCycleEndDate",
      "parEvaluationEndDate",
      "parEmployeeDeadline",
      "parThreeSixtyRatingDeadline",
      "parLeadDeadline",
      "parSpecialRatingDeadline",
      "employeeParQuestion",
      "threeSixtyReviewQuestion",
      "parRatings",
      "threeSixtyReviewRatings",
    ] as const) {
      expect(p[field], field).toBeTruthy();
    }
  });

  it("needs at least one rating of each kind", () => {
    expect(parCycleFormProblems(valid({ parRatings: [] })).parRatings).toBe(
      "At least one rating is required",
    );
    expect(
      parCycleFormProblems(valid({ threeSixtyReviewRatings: [] })).threeSixtyReviewRatings,
    ).toBe("At least one rating is required");
  });
});

// Reproduced from the source, and deliberately NOT tightened: requiring these
// would refuse cycles the real app accepts.
describe("what the source does not validate", () => {
  it("accepts a blank F2F deadline", () => {
    expect(parCycleFormProblems(valid({ parF2FDeadline: "" }))).toEqual({});
  });

  it("accepts a blank evaluation start date", () => {
    // It has no rule of its own — it exists only as the bound the others use.
    const p = parCycleFormProblems(valid({ parEvaluationStartDate: "" }));
    expect(p.parEvaluationStartDate).toBeUndefined();
  });
});

describe("date ordering", () => {
  it("wants the cycle to end after it starts", () => {
    expect(parCycleFormProblems(valid({ parCycleEndDate: "2025-12-31" })).parCycleEndDate).toBe(
      "Must be later than the cycle start date",
    );
  });

  it("keeps the three window deadlines inside the evaluation window", () => {
    for (const field of [
      "parEmployeeDeadline",
      "parThreeSixtyRatingDeadline",
      "parSpecialRatingDeadline",
    ] as const) {
      expect(parCycleFormProblems(valid({ [field]: "2026-05-01" }))[field], field).toBe(
        "Must be later than PAR creation date",
      );
      expect(parCycleFormProblems(valid({ [field]: "2026-07-15" }))[field], field).toBe(
        "Must be earlier than the PAR evaluation closing date",
      );
    }
  });

  it("wants the lead deadline after the employee's", () => {
    expect(
      parCycleFormProblems(valid({ parLeadDeadline: "2026-06-05" })).parLeadDeadline,
    ).toBe("Must be later than employee PAR deadline");
  });

  // The source adds a separate strict test on top of its .min(), which is the
  // only thing stopping the two deadlines sharing a day.
  it("refuses a lead deadline on the SAME day as the employee's", () => {
    expect(
      parCycleFormProblems(valid({ parLeadDeadline: "2026-06-10" })).parLeadDeadline,
    ).toBe("Must be later than employee PAR deadline");
  });

  it("keeps the lead deadline inside the evaluation window too", () => {
    expect(
      parCycleFormProblems(valid({ parLeadDeadline: "2026-07-20" })).parLeadDeadline,
    ).toBe("Must be earlier than the PAR evaluation closing date");
  });
});

describe("dates that are not dates", () => {
  it("treats an impossible date as missing rather than comparing it", () => {
    // Date rolls "2026-02-31" forward to 3 March, which would compare as valid.
    expect(parCycleFormProblems(valid({ parEmployeeDeadline: "2026-02-31" })).parEmployeeDeadline)
      .toBe("Required");
  });

  it("treats nonsense as missing", () => {
    for (const bad of ["", "  ", "not-a-date", "10/06/2026"]) {
      expect(
        parCycleFormProblems(valid({ parCycleStartDate: bad })).parCycleStartDate,
        JSON.stringify(bad),
      ).toBe("Required");
    }
  });
});
