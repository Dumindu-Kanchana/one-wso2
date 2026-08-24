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
import { employeeStatusMeta } from "./employeeStatus";

describe("employeeStatusMeta", () => {
  it("maps the three known statuses", () => {
    expect(employeeStatusMeta("Active")).toEqual({ label: "Active", color: "success" });
    expect(employeeStatusMeta("Marked leaver")).toEqual({ label: "Marked leaver", color: "warning" });
    expect(employeeStatusMeta("Left")).toEqual({ label: "Left", color: "error" });
  });

  it("is case-insensitive", () => {
    expect(employeeStatusMeta("ACTIVE").color).toBe("success");
    expect(employeeStatusMeta("marked LEAVER").color).toBe("warning");
  });

  it("shows an unknown status as itself, neutrally", () => {
    expect(employeeStatusMeta("Suspended")).toEqual({ label: "Suspended", color: "default" });
  });

  it("shows a dash when there is no status at all", () => {
    for (const empty of [null, undefined, "", "   "]) {
      expect(employeeStatusMeta(empty)).toEqual({ label: "—", color: "default" });
    }
  });

  // The reason for Object.hasOwn over `in`: these all resolve through the
  // prototype chain, and would return a function as the chip meta.
  it("does not resolve inherited property names", () => {
    for (const inherited of ["toString", "constructor", "__proto__", "valueOf"]) {
      expect(employeeStatusMeta(inherited).color).toBe("default");
    }
  });
});
