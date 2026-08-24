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
  availableEntities,
  nodeRank,
  nodeStatusNote,
  sortBusinessUnits,
  sortNodes,
} from "@features/people-ops/masterdata/hierarchyLogic";
import type { OrgChartEntity, OrgChartNode } from "@features/people-ops/api/peopleOpsTypes";

function entity(over: Partial<OrgChartEntity> = {}): OrgChartEntity {
  return {
    id: 1,
    name: "Platform",
    headEmail: "",
    isActive: true,
    activeEmployeeCount: 0,
    ...over,
  };
}

function node(over: Partial<OrgChartNode> = {}): OrgChartNode {
  return {
    id: 1,
    name: "Platform",
    headEmail: "",
    isActive: true,
    mappingId: 100,
    mappingHeadEmail: "",
    mappingIsActive: true,
    ...over,
  };
}

describe("availableEntities", () => {
  const all = [
    entity({ id: 1, name: "Platform" }),
    entity({ id: 2, name: "Security" }),
    entity({ id: 3, name: "Retired", isActive: false }),
  ];

  it("offers active entities not already placed here", () => {
    expect(availableEntities(all, []).map((e) => e.id)).toEqual([1, 2]);
  });

  it("excludes entities already under this parent", () => {
    // The backend rejects a duplicate mapping, so offering one turns a
    // reasonable click into an error.
    expect(availableEntities(all, [{ id: 1 }]).map((e) => e.id)).toEqual([2]);
  });

  it("never offers a deactivated entity", () => {
    // Placing a dead team under a business unit builds a branch nobody can
    // use. Id 3 is absent whether or not anything is assigned.
    expect(availableEntities(all, []).some((e) => e.id === 3)).toBe(false);
  });

  it("compares on entity id, not mapping id", () => {
    // The assigned list holds NODES, whose `id` is the entity and whose
    // `mappingId` is the placement. Matching on the wrong one would let the
    // same team be added twice.
    const assigned = [node({ id: 2, mappingId: 999 })];
    expect(availableEntities(all, assigned).map((e) => e.id)).toEqual([1]);
  });

  it("returns everything assignable when nothing is placed yet", () => {
    expect(availableEntities(all, []).length).toBe(2);
  });
});

describe("nodeRank", () => {
  it("ranks a live placement highest", () => {
    expect(nodeRank(node({ isActive: true, mappingIsActive: true }))).toBe(2);
  });

  it("ranks a retired placement above a dead entity", () => {
    // A placement turned off here is a local decision; a deactivated entity
    // is gone everywhere and belongs at the bottom.
    const retiredHere = nodeRank(node({ isActive: true, mappingIsActive: false }));
    const deadEntity = nodeRank(node({ isActive: false, mappingIsActive: true }));
    expect(retiredHere).toBeGreaterThan(deadEntity);
  });

  it("ranks a dead entity lowest whatever its placement says", () => {
    expect(nodeRank(node({ isActive: false, mappingIsActive: true }))).toBe(0);
    expect(nodeRank(node({ isActive: false, mappingIsActive: false }))).toBe(0);
  });
});

describe("sortNodes", () => {
  it("orders live, then retired-here, then deactivated", () => {
    const nodes = [
      node({ mappingId: 1, isActive: false, mappingIsActive: true }),
      node({ mappingId: 2, isActive: true, mappingIsActive: false }),
      node({ mappingId: 3, isActive: true, mappingIsActive: true }),
    ];
    expect(sortNodes(nodes).map((n) => n.mappingId)).toEqual([3, 2, 1]);
  });

  it("keeps the backend's order within a rank", () => {
    const nodes = [
      node({ mappingId: 1, name: "Alpha" }),
      node({ mappingId: 2, name: "Bravo" }),
      node({ mappingId: 3, name: "Charlie" }),
    ];
    expect(sortNodes(nodes).map((n) => n.name)).toEqual(["Alpha", "Bravo", "Charlie"]);
  });

  it("does not reorder the caller's array", () => {
    // These come straight from the query cache; .sort() is in-place, so
    // sorting the original would corrupt what every other reader sees.
    const nodes = [
      node({ mappingId: 1, mappingIsActive: false }),
      node({ mappingId: 2 }),
    ];
    const before = [...nodes];
    sortNodes(nodes);
    expect(nodes).toEqual(before);
  });
});

describe("sortBusinessUnits", () => {
  it("puts active business units first, order otherwise preserved", () => {
    const units = [
      { id: 1, name: "Alpha", isActive: false },
      { id: 2, name: "Bravo", isActive: true },
      { id: 3, name: "Charlie", isActive: true },
    ];
    expect(sortBusinessUnits(units).map((u) => u.id)).toEqual([2, 3, 1]);
  });

  it("does not mutate its input", () => {
    const units = [{ isActive: false }, { isActive: true }];
    const before = [...units];
    sortBusinessUnits(units);
    expect(units).toEqual(before);
  });
});

describe("nodeStatusNote", () => {
  it("says nothing about a fully live node", () => {
    expect(nodeStatusNote(node())).toBeNull();
  });

  it("distinguishes a local removal from a global one", () => {
    expect(nodeStatusNote(node({ mappingIsActive: false }))).toBe("Not active here");
    expect(nodeStatusNote(node({ isActive: false }))).toBe("Deactivated");
  });

  it("reports the entity being dead ahead of the placement", () => {
    // Both are false here. "Not active here" would imply moving it fixes
    // things, when the entity itself has to be reactivated first.
    expect(nodeStatusNote(node({ isActive: false, mappingIsActive: false }))).toBe(
      "Deactivated",
    );
  });
});
