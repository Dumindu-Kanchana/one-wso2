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


// Validation for creating or editing a cycle.
//
// Ported field for field and message for message from the standalone app's Yup
// schema in views/adminPortal/components/ParCreationForm.tsx. The messages are
// user-facing copy, so they are reproduced rather than reworded.
//
// Two source facts that look like omissions and are reproduced anyway, because
// tightening them would refuse cycles the real app accepts:
//
//   - `parF2FDeadline` has NO rule. It is collected and not validated.
//   - `parEvaluationStartDate` has no rule of its own; it exists only as the
//     lower bound the other dates are compared against.
//
// One quirk worth naming: `parLeadDeadline` carries BOTH a `.min()` against the
// employee deadline and a separate test asserting it is strictly later. The
// min alone would admit an equal date, so the strict test is what actually
// forbids the two deadlines falling on the same day.

export interface ParCycleFormValues {
  parCycleName: string;
  parCycleStartDate: string;
  parCycleEndDate: string;
  parEvaluationStartDate: string;
  parEvaluationEndDate: string;
  parEmployeeDeadline: string;
  parThreeSixtyRatingDeadline: string;
  parLeadDeadline: string;
  parSpecialRatingDeadline: string;
  parF2FDeadline: string;
  employeeParQuestion: string;
  threeSixtyReviewQuestion: string;
  parRatings: string[];
  threeSixtyReviewRatings: string[];
}

export type ParCycleFormProblems = Partial<Record<keyof ParCycleFormValues, string>>;

const REQUIRED = "Required";
const AFTER_CYCLE_START = "Must be later than the cycle start date";
const AFTER_CREATION = "Must be later than PAR creation date";
const BEFORE_EVAL_END = "Must be earlier than the PAR evaluation closing date";
const AFTER_EMPLOYEE_DEADLINE = "Must be later than employee PAR deadline";

/** A `YYYY-MM-DD` string as a comparable value, or null when unusable. */
function day(value: string | undefined): number | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  // Same round-trip check as the other date helpers: Date rolls overflow
  // forward, so "2026-02-31" would otherwise compare as 3 March.
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return date.getTime();
}

/**
 * Every problem with the form, keyed by field.
 *
 * An empty object means it can be submitted. Ordering within a field matches the
 * source: `required` is reported last, after the comparisons, because Yup
 * evaluates the chain in declaration order and stops at the first failure — so a
 * blank date reports "Required" and a filled-but-wrong one reports the comparison.
 */
export function parCycleFormProblems(values: ParCycleFormValues): ParCycleFormProblems {
  const p: ParCycleFormProblems = {};

  if (values.parCycleName.trim() === "") p.parCycleName = REQUIRED;
  if (values.employeeParQuestion.trim() === "") p.employeeParQuestion = REQUIRED;
  if (values.threeSixtyReviewQuestion.trim() === "") p.threeSixtyReviewQuestion = REQUIRED;

  if (values.parRatings.length === 0) p.parRatings = "At least one rating is required";
  if (values.threeSixtyReviewRatings.length === 0) {
    p.threeSixtyReviewRatings = "At least one rating is required";
  }

  const cycleStart = day(values.parCycleStartDate);
  const evalStart = day(values.parEvaluationStartDate);
  const evalEnd = day(values.parEvaluationEndDate);
  const employee = day(values.parEmployeeDeadline);

  if (cycleStart === null) p.parCycleStartDate = REQUIRED;

  const cycleEnd = day(values.parCycleEndDate);
  if (cycleEnd === null) p.parCycleEndDate = REQUIRED;
  else if (cycleStart !== null && cycleEnd < cycleStart) p.parCycleEndDate = AFTER_CYCLE_START;

  if (evalEnd === null) p.parEvaluationEndDate = REQUIRED;
  else if (evalStart !== null && evalEnd < evalStart) p.parEvaluationEndDate = AFTER_CREATION;

  // The three deadlines bounded by the evaluation window.
  for (const field of [
    "parEmployeeDeadline",
    "parThreeSixtyRatingDeadline",
    "parSpecialRatingDeadline",
  ] as const) {
    const value = day(values[field]);
    if (value === null) {
      p[field] = REQUIRED;
      continue;
    }
    if (evalStart !== null && value < evalStart) p[field] = AFTER_CREATION;
    else if (evalEnd !== null && value > evalEnd) p[field] = BEFORE_EVAL_END;
  }

  const lead = day(values.parLeadDeadline);
  if (lead === null) p.parLeadDeadline = REQUIRED;
  else if (employee !== null && lead < employee) p.parLeadDeadline = AFTER_EMPLOYEE_DEADLINE;
  else if (evalEnd !== null && lead > evalEnd) p.parLeadDeadline = BEFORE_EVAL_END;
  // Strictly later, not merely not-earlier: the source adds a separate test for
  // this, and without it the two deadlines could share a day.
  else if (employee !== null && lead === employee) p.parLeadDeadline = AFTER_EMPLOYEE_DEADLINE;

  return p;
}

/** Whether the form can be submitted at all. */
export function isParCycleFormValid(values: ParCycleFormValues): boolean {
  return Object.keys(parCycleFormProblems(values)).length === 0;
}

/** A blank form, matching the source's initial values. */
export function emptyParCycleForm(): ParCycleFormValues {
  return {
    parCycleName: "",
    parCycleStartDate: "",
    parCycleEndDate: "",
    parEvaluationStartDate: "",
    parEvaluationEndDate: "",
    parEmployeeDeadline: "",
    parThreeSixtyRatingDeadline: "",
    parLeadDeadline: "",
    parSpecialRatingDeadline: "",
    parF2FDeadline: "",
    employeeParQuestion: "",
    threeSixtyReviewQuestion: "",
    parRatings: [],
    threeSixtyReviewRatings: [],
  };
}
