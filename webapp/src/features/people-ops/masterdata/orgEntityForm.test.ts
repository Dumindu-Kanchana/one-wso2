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
  deactivationBlockedReason,
  initialFormState,
  isDirty,
  toCreatePayload,
  toUpdatePayload,
  validateOrgEntityForm,
} from "@features/people-ops/masterdata/orgEntityForm";
import { filterOrgEntities } from "@features/people-ops/masterdata/orgEntityFilter";
import type { OrgChartEntity } from "@features/people-ops/api/peopleOpsTypes";

function entity(overrides: Partial<OrgChartEntity> = {}): OrgChartEntity {
  return {
    id: 1,
    name: "Platform",
    headEmail: "lead@wso2.com",
    isActive: true,
    activeEmployeeCount: 0,
    ...overrides,
  };
}

describe("validateOrgEntityForm", () => {
  const valid = { name: "Platform", headEmail: "lead@wso2.com", isActive: true };

  it("accepts a well-formed entity", () => {
    expect(validateOrgEntityForm(valid)).toEqual({});
  });

  it("requires a name that isn't only whitespace", () => {
    expect(validateOrgEntityForm({ ...valid, name: "   " }).name).toBeTruthy();
    expect(validateOrgEntityForm({ ...valid, name: "" }).name).toBeTruthy();
  });

  it("enforces the backend's 45-character name limit", () => {
    expect(validateOrgEntityForm({ ...valid, name: "a".repeat(45) }).name).toBeUndefined();
    expect(validateOrgEntityForm({ ...valid, name: "a".repeat(46) }).name).toBeTruthy();
  });

  it("treats the head email as optional", () => {
    // An entity may not have a head yet; blank must not block saving.
    expect(validateOrgEntityForm({ ...valid, headEmail: "" }).headEmail).toBeUndefined();
    expect(validateOrgEntityForm({ ...valid, headEmail: "  " }).headEmail).toBeUndefined();
  });

  it("rejects an email that isn't one", () => {
    expect(validateOrgEntityForm({ ...valid, headEmail: "not-an-email" }).headEmail).toBeTruthy();
    expect(validateOrgEntityForm({ ...valid, headEmail: "a@b" }).headEmail).toBeTruthy();
  });
});

describe("toCreatePayload", () => {
  it("trims the name", () => {
    expect(toCreatePayload({ name: "  Platform  ", headEmail: "", isActive: true })).toEqual({
      name: "Platform",
    });
  });

  it("omits a blank head email rather than sending an empty string", () => {
    const payload = toCreatePayload({ name: "Platform", headEmail: "   ", isActive: true });
    expect("headEmail" in payload).toBe(false);
  });

  it("includes a head email when given", () => {
    expect(
      toCreatePayload({ name: "Platform", headEmail: " lead@wso2.com ", isActive: true }),
    ).toEqual({ name: "Platform", headEmail: "lead@wso2.com" });
  });
});

describe("toUpdatePayload", () => {
  it("sends nothing when nothing changed", () => {
    const e = entity();
    expect(toUpdatePayload(initialFormState(e), e)).toEqual({});
  });

  it("sends only the field that changed", () => {
    const e = entity();
    // A rename must not re-assert isActive: doing so can fail with a 400 if
    // the entity gained employees since the dialog opened, for an edit that
    // never touched activation.
    const payload = toUpdatePayload({ ...initialFormState(e), name: "Platform Eng" }, e);
    expect(payload).toEqual({ name: "Platform Eng" });
  });

  it("sends an empty string to clear the head email", () => {
    // "" is the value that removes a head; omitting the key would instead
    // mean "leave it alone", so clearing would silently do nothing.
    const e = entity({ headEmail: "lead@wso2.com" });
    expect(toUpdatePayload({ ...initialFormState(e), headEmail: "" }, e)).toEqual({
      headEmail: "",
    });
  });

  it("treats a whitespace-only edit as no change", () => {
    const e = entity({ name: "Platform" });
    expect(toUpdatePayload({ ...initialFormState(e), name: "  Platform  " }, e)).toEqual({});
  });

  it("sends the deactivation on its own", () => {
    const e = entity();
    expect(toUpdatePayload({ ...initialFormState(e), isActive: false }, e)).toEqual({
      isActive: false,
    });
  });
});

describe("isDirty", () => {
  it("needs a name before a new entity can be created", () => {
    expect(isDirty({ name: "", headEmail: "", isActive: true }, null)).toBe(false);
    expect(isDirty({ name: "  ", headEmail: "", isActive: true }, null)).toBe(false);
    expect(isDirty({ name: "New team", headEmail: "", isActive: true }, null)).toBe(true);
  });

  it("is false for an untouched edit", () => {
    const e = entity();
    expect(isDirty(initialFormState(e), e)).toBe(false);
  });

  it("is true once any field differs", () => {
    const e = entity();
    expect(isDirty({ ...initialFormState(e), headEmail: "other@wso2.com" }, e)).toBe(true);
  });
});

describe("deactivationBlockedReason", () => {
  it("allows deactivating an entity with nobody assigned", () => {
    expect(deactivationBlockedReason(entity({ activeEmployeeCount: 0 }))).toBeNull();
  });

  it("explains the block and agrees with itself on plurals", () => {
    expect(deactivationBlockedReason(entity({ activeEmployeeCount: 1 }))).toContain(
      "1 active employee ",
    );
    expect(deactivationBlockedReason(entity({ activeEmployeeCount: 4 }))).toContain(
      "4 active employees ",
    );
  });
});

describe("filterOrgEntities", () => {
  const rows = [
    entity({ id: 1, name: "Platform", headEmail: "ada@wso2.com" }),
    entity({ id: 2, name: "Security", headEmail: "grace@wso2.com", isActive: false }),
    entity({ id: 3, name: "Data", headEmail: "" }),
  ];

  it("shows only active entities by default", () => {
    expect(filterOrgEntities(rows, "", "active").map((r) => r.id)).toEqual([1, 3]);
  });

  it("can show only the archived ones", () => {
    expect(filterOrgEntities(rows, "", "inactive").map((r) => r.id)).toEqual([2]);
  });

  it("matches on head email as well as name", () => {
    // "who runs this?" and "what does this person run?" are both real
    // questions; matching only the name answers one of them.
    expect(filterOrgEntities(rows, "grace", "all").map((r) => r.id)).toEqual([2]);
    expect(filterOrgEntities(rows, "platform", "all").map((r) => r.id)).toEqual([1]);
  });

  it("ignores case and surrounding whitespace", () => {
    expect(filterOrgEntities(rows, "  PLATform ", "all").map((r) => r.id)).toEqual([1]);
  });

  it("combines the search with the status filter", () => {
    // Security matches the text but is inactive, so the active filter wins.
    expect(filterOrgEntities(rows, "security", "active")).toEqual([]);
  });

  it("survives an entity with no head email", () => {
    expect(filterOrgEntities(rows, "wso2.com", "all").map((r) => r.id)).toEqual([1, 2]);
  });
});
