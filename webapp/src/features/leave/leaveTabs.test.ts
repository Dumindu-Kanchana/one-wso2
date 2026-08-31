/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { describe, expect, it } from "vitest";
import { LEAVE_GROUPS } from "./leaveTabs";
import { ME_APPS } from "@constants/meApps";

const railItems = ME_APPS.find((a) => a.key === "leave")!.items;
const railFor = (id: string) => railItems.find((i) => i.id === id);

// There are two kinds of leave, and the source calls them General and
// Sabbatical (route.ts:67,74; GeneralLeave.tsx:244-252 heads its screen
// "General Leave Submission"). The rail entry for the general one was labelled
// "Leave", which under the "Leave" app group read as "Leave > Leave" and left
// the two categories named inconsistently.
describe("what the two kinds of leave are called", () => {
  it("is General and Sabbatical, in that order", () => {
    expect(LEAVE_GROUPS.map((g) => g.title)).toEqual(["General", "Sabbatical"]);
  });

  it("names the category in the rail, not the app", () => {
    for (const group of LEAVE_GROUPS) {
      const item = railFor(group.id);
      expect(item, `no rail entry for ${group.id}`).toBeDefined();
      expect(item!.label).not.toBe("Leave");
    }
  });

  it("gives the rail and the page the same name for a category", () => {
    for (const group of LEAVE_GROUPS) {
      expect(railFor(group.id)!.label).toBe(group.title);
    }
  });

  it("points the rail at the path the group serves", () => {
    for (const group of LEAVE_GROUPS) {
      expect(railFor(group.id)!.path).toBe(group.path);
    }
  });

  it("has a rail entry for every group and no orphans", () => {
    expect(railItems.map((i) => i.id).sort()).toEqual(
      LEAVE_GROUPS.map((g) => g.id).sort(),
    );
  });
});

// The structure moved twice; these are the URLs and tab names it settled on.
describe("what each category holds", () => {
  it("gives General the three things you do with it", () => {
    const general = LEAVE_GROUPS[0];
    expect(general.path).toBe("/me/leave/general");
    expect(general.tabs.map((t) => [t.segment, t.label])).toEqual([
      ["apply", "Apply"],
      ["history", "My history"],
      ["reports", "Reports"],
    ]);
  });

  // Approve and Approval history live here and nowhere else: the source's
  // Approve route has only sabbatical children (route.ts:80-103).
  it("gives Sabbatical the five, approval included", () => {
    const sabbatical = LEAVE_GROUPS[1];
    expect(sabbatical.path).toBe("/me/leave/sabbatical");
    expect(sabbatical.tabs.map((t) => [t.segment, t.label])).toEqual([
      ["apply", "Apply"],
      ["history", "My history"],
      ["approve", "Approve"],
      ["approval-history", "Approval history"],
      ["report", "Report"],
    ]);
  });

  it("keeps every segment unique within its group", () => {
    for (const group of LEAVE_GROUPS) {
      const segments = group.tabs.map((t) => t.segment);
      expect(new Set(segments).size).toBe(segments.length);
    }
  });
});
