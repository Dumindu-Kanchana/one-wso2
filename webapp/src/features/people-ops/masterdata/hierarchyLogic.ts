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

// The two pieces of hierarchy logic that are easy to get subtly wrong, pulled
// out of the component so they can be tested without four columns of UI:
// which entities may still be assigned to a parent, and what order nodes
// appear in.

import type { OrgChartEntity, OrgChartNode } from "../api/peopleOpsTypes";

/**
 * Entities that can still be placed under a parent.
 *
 * Excludes two groups. Already-placed ones, because the backend rejects a
 * duplicate mapping and offering it would turn a reasonable click into an
 * error. And inactive ones, because placing a deactivated team under a
 * business unit creates a branch nobody can use.
 *
 * `assigned` is compared on ENTITY id, not mapping id — the question is
 * "is this team already under this parent?", and the mapping id is the
 * answer's identity, not the question's.
 */
export function availableEntities(
  all: OrgChartEntity[],
  assigned: readonly { id: number }[],
): OrgChartEntity[] {
  const taken = new Set(assigned.map((a) => a.id));
  return all.filter((entity) => entity.isActive && !taken.has(entity.id));
}

/**
 * Sort rank for a node in a hierarchy column. Higher sorts first.
 *
 * Three tiers rather than two, because a node can be dimmed for two different
 * reasons and they are not equally severe:
 *
 *   2  live — the entity is active and so is this placement
 *   1  placement retired here, but the entity is fine elsewhere
 *   0  the entity itself is deactivated, so it is dead everywhere
 *
 * Ranking the entity-level problem below the placement-level one puts the
 * things needing attention in the org chart above the things already dealt
 * with on the entity tabs.
 */
export function nodeRank(node: Pick<OrgChartNode, "isActive" | "mappingIsActive">): number {
  if (!node.isActive) return 0;
  return node.mappingIsActive ? 2 : 1;
}

/**
 * Nodes ordered live-first. Stable, so the backend's alphabetical order
 * survives within each rank.
 */
export function sortNodes<T extends Pick<OrgChartNode, "isActive" | "mappingIsActive">>(
  nodes: readonly T[],
): T[] {
  // Copy first: .sort() is in-place, and these arrays come from the query
  // cache, which must not be reordered as a side effect of rendering.
  return [...nodes].sort((a, b) => nodeRank(b) - nodeRank(a));
}

/**
 * Business units, active first. They have no mapping — nothing places a
 * business unit under anything — so this is the two-tier version of the above.
 */
export function sortBusinessUnits<T extends { isActive: boolean }>(
  units: readonly T[],
): T[] {
  return [...units].sort((a, b) => Number(b.isActive) - Number(a.isActive));
}

/** Why a node is dimmed, or null when it is fully live. */
export function nodeStatusNote(
  node: Pick<OrgChartNode, "isActive" | "mappingIsActive">,
): string | null {
  // Entity-level first: if the entity is gone, the placement's own state is
  // beside the point and saying "not placed here" would misdirect.
  if (!node.isActive) return "Deactivated";
  if (!node.mappingIsActive) return "Not active here";
  return null;
}
