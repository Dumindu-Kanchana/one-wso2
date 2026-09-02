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

/**
 * The cached answer must belong to whoever gave it.
 *
 * The provider caches the decision so answering takes effect without a storage
 * round trip. Cached bare, that decision outlived the person who made it: if the
 * signed-in subject changed while the provider stayed mounted, the previous
 * user's "seen" suppressed the new user's offer entirely.
 *
 * Its own file because the subject has to change between renders, which means a
 * mutable mock the other suites should not inherit.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TourProvider } from "./TourProvider";
import TourPrompt from "./TourPrompt";

let currentSub = "user-a";

vi.mock("@hooks/useAsgardeoSub", () => ({
  useAsgardeoSub: () => ({ state: { status: "ready", sub: currentSub }, retry: () => {} }),
}));

beforeEach(() => {
  localStorage.clear();
  currentSub = "user-a";
});

const offer = () => screen.queryByRole("region", { name: "Introductory tour" });

describe("the cached answer is scoped to its subject", () => {
  /**
   * The answer has to be given IN SESSION for this to mean anything. Setting the
   * stored flag directly leaves the in-memory cache empty, so the bug — a cached
   * decision outliving its owner — never surfaces. A first version of this test
   * did exactly that and passed against the broken code.
   */
  it("offers the tour to a second user after the first one declined here", async () => {
    const { rerender } = render(
      <TourProvider>
        <TourPrompt />
      </TourProvider>,
    );
    expect(offer(), "user A should have been offered it").not.toBeNull();

    // Declining populates the cache for user A.
    await userEvent.click(screen.getByRole("button", { name: "No thanks" }));
    expect(offer()).toBeNull();

    // Someone else signs in without the provider remounting.
    currentSub = "user-b";
    rerender(
      <TourProvider>
        <TourPrompt />
      </TourProvider>,
    );
    expect(offer(), "user B inherited user A's answer").not.toBeNull();
  });

  it("does not re-offer it to the first user on the way back", async () => {
    const { rerender } = render(
      <TourProvider>
        <TourPrompt />
      </TourProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "No thanks" }));

    currentSub = "user-b";
    rerender(
      <TourProvider>
        <TourPrompt />
      </TourProvider>,
    );
    expect(offer()).not.toBeNull();

    currentSub = "user-a";
    rerender(
      <TourProvider>
        <TourPrompt />
      </TourProvider>,
    );
    expect(offer(), "user A's recorded answer was forgotten").toBeNull();
  });
});
