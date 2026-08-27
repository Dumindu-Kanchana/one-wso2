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
import { PAR_ITEM_IDS, parItemVisible } from "@features/par/util/parItems";

const NOBODY = { isAdmin: false, isTeamLead: false };
const LEAD = { isAdmin: false, isTeamLead: true };
const ADMIN = { isAdmin: true, isTeamLead: false };

describe("what each role opens", () => {
  it("gives every employee their own PAR and history, holding no role at all", () => {
    expect(parItemVisible("par-my", NOBODY)).toBe(true);
    expect(parItemVisible("par-history", NOBODY)).toBe(true);
  });

  it("keeps the team and admin screens away from a plain employee", () => {
    expect(parItemVisible("par-team", NOBODY)).toBe(false);
    expect(parItemVisible("par-admin", NOBODY)).toBe(false);
    expect(parItemVisible("par-settings", NOBODY)).toBe(false);
  });

  it("opens the team screen for a team lead, but not the admin ones", () => {
    // A lead runs reviews for their own reports. Cycle creation, quotas and
    // org-wide reminders are a different job.
    expect(parItemVisible("par-team", LEAD)).toBe(true);
    expect(parItemVisible("par-admin", LEAD)).toBe(false);
    expect(parItemVisible("par-settings", LEAD)).toBe(false);
  });

  it("opens the admin screens for an admin, and not the lead screen", () => {
    // Being a PAR administrator says nothing about having reports, so the two
    // roles are independent rather than nested.
    expect(parItemVisible("par-admin", ADMIN)).toBe(true);
    expect(parItemVisible("par-settings", ADMIN)).toBe(true);
    expect(parItemVisible("par-team", ADMIN)).toBe(false);
  });

  it("lets one person hold both roles", () => {
    const both = { isAdmin: true, isTeamLead: true };
    for (const id of PAR_ITEM_IDS) {
      expect(parItemVisible(id, both), `"${id}" should be visible`).toBe(true);
    }
  });
});

describe("failing closed", () => {
  it("hides a PAR item that nobody remembered to classify", () => {
    // The failure this guards: a sixth screen gets added to the registry and to
    // PAR_ITEM_IDS, but not to the admin or lead set. Defaulting to visible
    // would show it to the whole company until someone noticed.
    expect(parItemVisible("par-quota-allocation", ADMIN)).toBe(false);
    expect(parItemVisible("par-quota-allocation", NOBODY)).toBe(false);
  });

  it("claims nothing about items belonging to other apps", () => {
    // The rail only consults this gate for ids in PAR_ITEM_IDS; if it ever
    // asked about something else, refusing is the safe answer.
    expect(parItemVisible("opd-history", ADMIN)).toBe(false);
    expect(parItemVisible("", ADMIN)).toBe(false);
  });

  it("does not resolve inherited property names as membership", () => {
    // PAR_ITEM_IDS is a Set, so this is already safe — pinned so a refactor to
    // a plain object literal has to keep it safe.
    for (const name of ["toString", "constructor", "hasOwnProperty"]) {
      expect(parItemVisible(name, ADMIN)).toBe(false);
    }
  });
});

describe("the item set the rail dispatches on", () => {
  it("covers every screen the gate can decide", () => {
    // SideRail routes an id to this gate only if PAR_ITEM_IDS has it. Anything
    // classified as admin- or lead-only but missing from that set would be
    // resolved against people-app capabilities instead — the wrong vocabulary,
    // and the bug this whole gate exists to avoid.
    for (const id of ["par-my", "par-history", "par-team", "par-admin", "par-settings"]) {
      expect(PAR_ITEM_IDS.has(id), `PAR_ITEM_IDS should list "${id}"`).toBe(true);
    }
  });
});
