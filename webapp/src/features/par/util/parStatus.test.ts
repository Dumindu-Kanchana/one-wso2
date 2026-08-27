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
  parCycleStatusMeta,
  parEmployeeStatusMeta,
  parF2fStatusMeta,
  parLeadStatusMeta,
  parSpecialRatingMeta,
  parThreeSixtyStatusMeta,
} from "@features/par/util/parStatus";

// The whole reason these are separate maps: "SHARED" is three different facts
// depending on which field carried it, and the 360 case is the one that reads
// wrong if they are merged.
describe("the SHARED collision", () => {
  it("calls a completed 360 review completed, not shared", () => {
    expect(parThreeSixtyStatusMeta("SHARED").label).toBe("Completed");
  });

  it("still calls a shared PAR and a shared lead review shared", () => {
    expect(parEmployeeStatusMeta("SHARED").label).toBe("Shared");
    expect(parLeadStatusMeta("SHARED").label).toBe("Shared");
  });

  it("keeps all three green — they differ in wording, not in meaning of done", () => {
    expect(parThreeSixtyStatusMeta("SHARED").color).toBe("success");
    expect(parEmployeeStatusMeta("SHARED").color).toBe("success");
    expect(parLeadStatusMeta("SHARED").color).toBe("success");
  });
});

describe("labels", () => {
  it("spells out SHARED_BLOCKED instead of capitalizing the wire value", () => {
    // The source rendered this as "Shared_blocked". It is also not a state
    // anyone selects, so the label has to explain why the PAR is uneditable.
    const meta = parEmployeeStatusMeta("SHARED_BLOCKED");
    expect(meta.label).toBe("Shared (locked)");
    expect(meta.label).not.toMatch(/_/);
  });

  it("gives every known status a human label with no underscores", () => {
    const all = [
      ...(["PENDING", "DRAFT", "SHARED", "SHARED_BLOCKED"] as const).map(parEmployeeStatusMeta),
      ...(["PENDING", "DRAFT", "SHARED"] as const).map(parLeadStatusMeta),
      ...(["PENDING", "DRAFT", "SHARED", "REJECTED"] as const).map((s) =>
        parThreeSixtyStatusMeta(s),
      ),
      ...(["PENDING", "SCHEDULED", "COMPLETED"] as const).map(parF2fStatusMeta),
      ...(["PENDING", "PENDING_QUOTA", "OPEN", "CLOSED", "FAILED"] as const).map(
        parCycleStatusMeta,
      ),
      ...(["TOP5P", "TOP20P", "NOT_ASSIGNED"] as const).map(parSpecialRatingMeta),
    ];
    for (const meta of all) {
      expect(meta.label).not.toMatch(/_/);
      expect(meta.label).not.toBe("");
    }
  });

  it("declines a 360 request rather than rejecting the person", () => {
    expect(parThreeSixtyStatusMeta("REJECTED").label).toBe("Declined");
    expect(parThreeSixtyStatusMeta("REJECTED").color).toBe("error");
  });

  it("renders the common special rating as a quiet dash", () => {
    expect(parSpecialRatingMeta("NOT_ASSIGNED")).toEqual({ label: "—", color: "default" });
    expect(parSpecialRatingMeta("TOP5P").label).toBe("Top 5%");
    expect(parSpecialRatingMeta("TOP20P").label).toBe("Top 20%");
  });

  it("treats a cycle awaiting quota as needing attention and a pending one as not", () => {
    // A cycle that hasn't opened yet is on schedule; one stuck without a quota
    // is waiting on an admin. Colouring both amber would cry wolf.
    expect(parCycleStatusMeta("PENDING").color).toBe("default");
    expect(parCycleStatusMeta("PENDING_QUOTA").color).toBe("warning");
    expect(parCycleStatusMeta("FAILED").color).toBe("error");
  });
});

describe("a 360 review past its deadline", () => {
  it("stops calling a pending review pending once nobody can fill it", () => {
    expect(parThreeSixtyStatusMeta("PENDING").label).toBe("Pending");
    expect(parThreeSixtyStatusMeta("PENDING", { deadlinePassed: true })).toEqual({
      label: "—",
      color: "default",
    });
  });

  it("leaves every other status alone after the deadline", () => {
    // The reviews that were actually answered still have to report what
    // happened; only the un-actionable one goes quiet.
    for (const status of ["DRAFT", "SHARED", "REJECTED"] as const) {
      expect(parThreeSixtyStatusMeta(status, { deadlinePassed: true })).toEqual(
        parThreeSixtyStatusMeta(status),
      );
    }
  });
});

describe("unknown and hostile values", () => {
  const maps = [
    parEmployeeStatusMeta,
    parLeadStatusMeta,
    parF2fStatusMeta,
    parCycleStatusMeta,
    parSpecialRatingMeta,
    (s: string | null | undefined) => parThreeSixtyStatusMeta(s),
  ];

  it("shows a status added by the backend as itself, rather than crashing", () => {
    for (const meta of maps) {
      expect(meta("ESCALATED")).toEqual({ label: "ESCALATED", color: "default" });
    }
  });

  it("does not resolve inherited property names off the prototype", () => {
    // `in` and a bare index-plus-`??` both match these and hand back a function,
    // which would be rendered as a chip label.
    for (const meta of maps) {
      for (const name of ["toString", "constructor", "hasOwnProperty", "__proto__"]) {
        const result = meta(name);
        expect(typeof result.label).toBe("string");
        expect(result.color).toBe("default");
      }
    }
  });

  it("falls back to a dash for nothing at all", () => {
    for (const meta of maps) {
      for (const empty of [undefined, null, "", "   "]) {
        expect(meta(empty)).toEqual({ label: "—", color: "default" });
      }
    }
  });
});
