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


// Where you are while drilling down a reporting line.
//
// The trail is a list, and every rule about it is about not losing your place:
// clicking a name pushes, a breadcrumb truncates, and re-entering someone
// already in the trail must not grow it forever. The source held this in
// component state with three separate handlers; as data with pure operations it
// can be tested, and the cycle case is the one that bites — a reporting line
// with a loop in it is a data problem, but the browser should survive it.

export interface ParChainStep {
  email: string;
  /** What to show. Falls back to the email when no name is known. */
  name: string;
}

/** The trail's current position — always the last step. */
export function chainCurrent(trail: readonly ParChainStep[]): ParChainStep | undefined {
  return trail.length > 0 ? trail[trail.length - 1] : undefined;
}

/**
 * Drill into somebody.
 *
 * Re-entering someone already in the trail truncates back to them rather than
 * appending, so a cycle in the reporting data cannot grow the trail without
 * bound.
 */
export function chainPush(
  trail: readonly ParChainStep[],
  step: ParChainStep,
): ParChainStep[] {
  const existing = trail.findIndex((s) => s.email === step.email);
  if (existing >= 0) return trail.slice(0, existing + 1);
  return [...trail, step];
}

/**
 * Jump back to a breadcrumb.
 *
 * An index outside the trail leaves it alone: a stale click after the trail has
 * already shortened should do nothing rather than truncate to somewhere
 * arbitrary.
 */
export function chainTruncate(trail: readonly ParChainStep[], index: number): ParChainStep[] {
  if (!Number.isInteger(index) || index < 0 || index >= trail.length) return [...trail];
  return trail.slice(0, index + 1);
}

/** One step back, or unchanged when already at the root. */
export function chainBack(trail: readonly ParChainStep[]): ParChainStep[] {
  if (trail.length <= 1) return [...trail];
  return trail.slice(0, trail.length - 1);
}
