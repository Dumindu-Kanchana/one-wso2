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
  buildPickerOptions,
  findSelectedOption,
  isSynthetic,
} from "@features/people-ops/components/employeePickerOptions";
import type { EmployeeBasicInfo } from "@features/people-ops/api/peopleOpsTypes";

const ada: EmployeeBasicInfo = {
  employeeId: "WSO2-1",
  firstName: "Ada",
  lastName: "Lovelace",
  workEmail: "ada@wso2.com",
};
const grace: EmployeeBasicInfo = {
  employeeId: "WSO2-2",
  firstName: "Grace",
  lastName: "Hopper",
  workEmail: "grace@wso2.com",
};
const roster = [ada, grace];

describe("buildPickerOptions", () => {
  it("offers the roster unchanged when nothing is selected", () => {
    expect(buildPickerOptions(roster, "")).toEqual(roster);
    expect(buildPickerOptions(roster, "   ")).toEqual(roster);
  });

  it("doesn't duplicate someone already on the roster", () => {
    expect(buildPickerOptions(roster, "ada@wso2.com")).toEqual(roster);
  });

  it("keeps a stored head who has since left the company", () => {
    // /employees/basic-info returns active employees only. Without a
    // stand-in, the Autocomplete would treat this value as unmatched and
    // clear it — blanking the field just by opening the dialog.
    const options = buildPickerOptions(roster, "alan@wso2.com");
    expect(options).toHaveLength(3);
    expect(options[0].workEmail).toBe("alan@wso2.com");
    expect(isSynthetic(options[0])).toBe(true);
  });

  it("puts the stand-in first, where the selected option sits", () => {
    expect(buildPickerOptions(roster, "alan@wso2.com")[0].workEmail).toBe("alan@wso2.com");
  });

  it("matches case-insensitively so casing drift doesn't duplicate a person", () => {
    // An email stored years ago may not match the roster's casing; treating
    // them as different would show the same person twice.
    expect(buildPickerOptions(roster, "ADA@WSO2.COM")).toEqual(roster);
    expect(buildPickerOptions(roster, "  ada@wso2.com  ")).toEqual(roster);
  });

  it("copes with an empty roster", () => {
    // The list not having loaded yet must not discard the stored value.
    const options = buildPickerOptions([], "alan@wso2.com");
    expect(options).toHaveLength(1);
    expect(isSynthetic(options[0])).toBe(true);
  });
});

describe("findSelectedOption", () => {
  it("returns null when nothing is selected", () => {
    expect(findSelectedOption(roster, "")).toBeNull();
    expect(findSelectedOption(roster, "  ")).toBeNull();
  });

  it("finds the person behind a stored email", () => {
    expect(findSelectedOption(roster, "grace@wso2.com")).toBe(grace);
  });

  it("finds them regardless of case or padding", () => {
    expect(findSelectedOption(roster, " GRACE@wso2.com ")).toBe(grace);
  });

  it("returns null for an email absent from the options", () => {
    // The caller passes options from buildPickerOptions, which guarantees a
    // stand-in exists — so a null here means genuinely no match.
    expect(findSelectedOption(roster, "nobody@wso2.com")).toBeNull();
  });
});

describe("isSynthetic", () => {
  it("distinguishes a real employee from a stand-in", () => {
    expect(isSynthetic(ada)).toBe(false);
    expect(
      isSynthetic({ employeeId: "", firstName: "", lastName: "", workEmail: "x@wso2.com" }),
    ).toBe(true);
  });
});
