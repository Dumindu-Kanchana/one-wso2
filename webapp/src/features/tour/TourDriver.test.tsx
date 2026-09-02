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
 * The launcher's behaviour across steps, which is where the tour broke in the
 * running app: step 3 showed with the app menu shut and its star unhighlighted.
 *
 * The chain was — step 2 opens the launcher; the tour card renders outside the
 * launcher's popper, so clicking Next counts as a click away and closes it; step
 * 3 also wants it open, so `wantsLauncher` does not change; an effect watching
 * only that flag never re-runs, and the panel stays shut. Both halves are
 * covered here: the reassert, and the hold that stops the close happening at all.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { TourProvider } from "./TourProvider";
import TourDriver from "./TourDriver";
import TourGuide from "./TourGuide";
import { useTour } from "./tourContext";
import { TOUR_STEPS } from "./tourSteps";

vi.mock("@hooks/useAsgardeoSub", () => ({
  useAsgardeoSub: () => ({ state: { status: "ready", sub: "user-under-test" }, retry: () => {} }),
}));

/** Indices of the steps that ask for the launcher — expected to be adjacent. */
const LAUNCHER_STEPS = TOUR_STEPS.reduce<number[]>(
  (acc, s, i) => (s.opensLauncher ? [...acc, i] : acc),
  [],
);

function Harness({ anchors }: { anchors: (el: HTMLElement | null) => void }) {
  const hold = createRef<boolean>() as { current: boolean };
  hold.current = false;
  function Start() {
    const tour = useTour();
    return <button onClick={tour.start}>start</button>;
  }
  return (
    <TourProvider>
      <button data-tour="app-menu">menu</button>
      <button data-tour="favourite">star</button>
      <button data-tour="pin">pin</button>
      <button data-tour="theme">theme</button>
      <button data-tour="settings">settings</button>
      <aside>
        <nav>rail</nav>
      </aside>
      <TourDriver
        sidebarCollapsed={false}
        toggleSidebar={() => {}}
        setWaffleAnchor={anchors}
        holdLauncher={hold}
      />
      <Start />
      <TourGuide />
    </TourProvider>
  );
}

describe("the launcher across launcher steps", () => {
  it("has two adjacent steps that want it, which is what broke", () => {
    expect(LAUNCHER_STEPS.length).toBeGreaterThan(1);
    expect(LAUNCHER_STEPS[1]).toBe(LAUNCHER_STEPS[0] + 1);
  });

  it("keeps the launcher open across both of them", async () => {
    const calls: (string | null)[] = [];
    render(<Harness anchors={(el) => calls.push(el ? el.dataset.tour ?? "el" : null)} />);
    await userEvent.click(screen.getByRole("button", { name: "start" }));

    for (let i = 0; i < LAUNCHER_STEPS[1]; i++) {
      await userEvent.click(screen.getByRole("button", { name: "Next" }));
    }
    // On the second launcher step the anchor must be set, not cleared.
    expect(calls.at(-1), `anchor history: ${JSON.stringify(calls)}`).toBe("app-menu");
  });

  /**
   * The panel being externally shut mid-tour — what the click-away used to do —
   * must not leave the next step pointing at nothing.
   */
  it("reopens it on the next step if something closed it", async () => {
    let last: string | null = "none";
    render(<Harness anchors={(el) => (last = el ? (el.dataset.tour ?? "el") : null)} />);
    await userEvent.click(screen.getByRole("button", { name: "start" }));
    for (let i = 0; i < LAUNCHER_STEPS[0]; i++) {
      await userEvent.click(screen.getByRole("button", { name: "Next" }));
    }
    expect(last).toBe("app-menu");
    last = null; // as if a click-away had closed it
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(last, "the next launcher step did not reopen the panel").toBe("app-menu");
  });

  it("clears the anchor once the tour is over", async () => {
    let last: string | null = "none";
    render(<Harness anchors={(el) => (last = el ? (el.dataset.tour ?? "el") : null)} />);
    await userEvent.click(screen.getByRole("button", { name: "start" }));
    for (let i = 0; i < LAUNCHER_STEPS[0]; i++) {
      await userEvent.click(screen.getByRole("button", { name: "Next" }));
    }
    expect(last).toBe("app-menu");
    await userEvent.click(screen.getByRole("button", { name: "End tour" }));
    expect(last).toBeNull();
  });
});
