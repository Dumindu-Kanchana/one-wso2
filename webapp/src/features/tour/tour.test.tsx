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
 * The tour end to end, through the provider rather than around it: the offer,
 * the stepping, the skip-a-missing-target rule, and the fact that every exit
 * records an answer.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TourProvider } from "./TourProvider";
import TourPrompt from "./TourPrompt";
import TourGuide from "./TourGuide";
import { hasSeenTour, markTourSeen } from "./tourStore";
import { useTour } from "./tourContext";

vi.mock("@hooks/useAsgardeoSub", () => ({
  useAsgardeoSub: () => ({ state: { status: "ready", sub: "user-under-test" }, retry: () => {} }),
}));

beforeEach(() => localStorage.clear());

/**
 * A stand-in for the chrome the steps point at.
 *
 * The rail is an `aside > nav` rather than another marked button, because that
 * is what the real step matches — Oxygen's Sidebar drops `data-*`, so the rail
 * step targets its structure instead. A harness that marked it like the others
 * would let a broken rail selector pass here.
 */
function Targets({ omit = [] as string[] }) {
  const marked = ["app-menu", "favourite", "pin", "theme", "settings"];
  return (
    <>
      {marked
        .filter((t) => !omit.includes(t))
        .map((t) => (
          <button key={t} data-tour={t}>
            {t}
          </button>
        ))}
      {!omit.includes("rail") && (
        <aside>
          <nav>rail</nav>
        </aside>
      )}
    </>
  );
}

function Harness({ omit }: { omit?: string[] }) {
  return (
    <TourProvider>
      <Targets omit={omit} />
      <TourPrompt />
      <TourGuide />
    </TourProvider>
  );
}

const nextBtn = () => screen.getByRole("button", { name: "Next" });

describe("the tour offer", () => {
  it("offers itself to someone who has never been asked", () => {
    render(<Harness />);
    expect(screen.getByRole("region", { name: "Introductory tour" })).toBeTruthy();
  });

  it("says nothing to someone who has already answered", () => {
    markTourSeen("user-under-test");
    render(<Harness />);
    expect(screen.queryByRole("region", { name: "Introductory tour" })).toBeNull();
  });

  /** Declining is an answer. It must not come back tomorrow. */
  it("records an answer when declined, and withdraws the offer", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "No thanks" }));
    expect(hasSeenTour("user-under-test")).toBe(true);
    expect(screen.queryByRole("region", { name: "Introductory tour" })).toBeNull();
  });

  it("starts the tour when accepted, and drops the offer", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Take the tour" }));
    expect(screen.getByRole("dialog", { name: /^Tour:/ })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Introductory tour" })).toBeNull();
  });
});

describe("running the tour", () => {
  async function start() {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Take the tour" }));
  }

  it("opens on the first step and counts them", async () => {
    await start();
    expect(screen.getByText("Step 1 of 8")).toBeTruthy();
  });

  it("advances and goes back", async () => {
    await start();
    await userEvent.click(nextBtn());
    expect(screen.getByText("Step 2 of 8")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByText("Step 1 of 8")).toBeTruthy();
  });

  /** The first step has no Back, so there is nothing to fall out of. */
  it("offers no way back from the first step", async () => {
    await start();
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
  });

  it("records an answer when ended part way", async () => {
    await start();
    await userEvent.click(nextBtn());
    await userEvent.click(screen.getByRole("button", { name: "End tour" }));
    expect(screen.queryByRole("dialog", { name: /^Tour:/ })).toBeNull();
    expect(hasSeenTour("user-under-test")).toBe(true);
  });

  it("ends on Done rather than Next", async () => {
    await start();
    for (let i = 0; i < 7; i++) await userEvent.click(nextBtn());
    expect(screen.getByText("Step 8 of 8")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("dialog", { name: /^Tour:/ })).toBeNull();
    expect(hasSeenTour("user-under-test")).toBe(true);
  });

  /**
   * On the last step, End tour and Done are the same action. Offering both asks
   * the reader to choose between two identical outcomes, so only Done is there.
   */
  it("offers no End tour on the last step, where it would duplicate Done", async () => {
    await start();
    expect(screen.getByRole("button", { name: "End tour" })).toBeTruthy();
    for (let i = 0; i < 7; i++) await userEvent.click(nextBtn());
    expect(screen.getByText("Step 8 of 8")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "End tour" })).toBeNull();
    expect(screen.getByRole("button", { name: "Done" })).toBeTruthy();
  });

  it("closes on Escape, and counts that as answered", async () => {
    await start();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: /^Tour:/ })).toBeNull();
    expect(hasSeenTour("user-under-test")).toBe(true);
  });

  /**
   * The rule that keeps a tour honest on a narrow screen: a step whose control
   * is not on the page is passed over, not anchored to nothing.
   */
  it("skips a step whose target is not on the page", async () => {
    render(<Harness omit={["pin"]} />);
    await userEvent.click(screen.getByRole("button", { name: "Take the tour" }));
    const seen: string[] = [];
    for (let i = 0; i < 8; i++) {
      const d = screen.queryByRole("dialog", { name: /^Tour:/ });
      if (!d) break;
      seen.push(d.getAttribute("aria-label") ?? "");
      const next = screen.queryByRole("button", { name: "Next" });
      if (!next) break;
      await userEvent.click(next);
    }
    expect(seen.some((t) => t.includes("Keep a page to hand"))).toBe(false);
    // and the step after it is still reached
    expect(seen.some((t) => t.includes("easier on the eyes"))).toBe(true);
  });
});

describe("demo mode: the app is inert while the tour runs", () => {
  /**
   * Presence, not hit-testing. jsdom has no layout and `userEvent.click`
   * dispatches straight onto its target, so an overlay can never intercept here
   * however correct it is — a test that clicked an underlying button and
   * expected nothing to happen would fail against working code. What is
   * checkable is that a viewport-covering blocker exists exactly while the tour
   * runs, which is the part that could regress by being deleted or mis-scoped.
   *
   * Why it matters beyond politeness: if a stray click can change what is open,
   * the next step measures a layout the tour did not arrange — which is how the
   * launcher came to be shut underneath the step pointing into it.
   */
  const blocker = () => document.querySelector("[data-tour-blocker]");

  it("covers the viewport only while the tour is running", async () => {
    render(<Harness />);
    expect(blocker(), "blocking before the tour started").toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Take the tour" }));
    const el = blocker();
    expect(el, "no blocker while the tour runs").not.toBeNull();
    // Fixed positioning is the checkable half. That it *covers* the viewport is
    // not: jsdom computes no layout, and the `inset` shorthand does not resolve
    // into top/left here, so asserting geometry would only test jsdom.
    expect(getComputedStyle(el as Element).position).toBe("fixed");

    await userEvent.click(screen.getByRole("button", { name: "End tour" }));
    expect(blocker(), "still blocking after the tour ended").toBeNull();
  });

  it("sits above the app but below the tour's own card", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Take the tour" }));
    const z = (el: Element | null) => Number(getComputedStyle(el as Element).zIndex || 0);
    const card = screen.getByRole("dialog", { name: /^Tour:/ });
    expect(z(blocker())).toBeGreaterThan(0);
    expect(z(card), "the card must stay clickable above the blocker").toBeGreaterThan(
      z(blocker()),
    );
  });

  /**
   * The launcher's Popper sits at `theme.zIndex.modal` AND portals to
   * document.body, so at an equal z-index it paints above a blocker rendered in
   * the app tree — which is exactly how the open app menu stayed clickable
   * through the blocker. Strictly greater is the requirement, not equal.
   */
  it("outranks a portalled popper at the modal layer", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Take the tour" }));
    const z = Number(getComputedStyle(blocker() as Element).zIndex || 0);
    // MUI's modal layer, which the waffle popper pins itself to.
    expect(z, "blocker does not outrank the launcher's popper").toBeGreaterThan(1300);
  });

  /**
   * `transform: none`, never an empty string.
   *
   * The card is positioned by writing top/left to its style. Clearing the
   * transform with "" drops the inline override and lets the sx transform
   * (translate(-50%, -50%)) apply again, putting every card half its own width
   * and height away from the position just computed. That is invisible to a
   * jsdom test that checks geometry — there is no layout — so the override
   * itself is what gets pinned.
   */
  it("overrides the centring transform rather than clearing it", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Take the tour" }));
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    const card = screen.getByRole("dialog", { name: /^Tour:/ }) as HTMLElement;
    expect(
      card.style.transform,
      "an empty transform lets the sx centring re-apply and offsets the card",
    ).toBe("none");
  });

  it("still lets its own controls be used", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Take the tour" }));
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Step 2 of 8")).toBeTruthy();
  });
});

describe("what the review found", () => {
  /**
   * Accepting the offer is an answer. Before this, only finishing recorded one,
   * so accepting and then refreshing mid-tour offered it all over again — which
   * contradicts the single guarantee the flag makes.
   */
  it("records the answer as soon as the offer is accepted", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Take the tour" }));
    expect(
      hasSeenTour("user-under-test"),
      "a refresh mid-tour would offer it again",
    ).toBe(true);
  });

  /**
   * Tab must not walk out of the card into an app the reader has been told they
   * cannot use. The pointer blocker never sees a keyboard.
   */
  it("keeps Tab inside the card while the app is blocked", async () => {
    render(
      <TourProvider>
        <button>behind the blocker</button>
        <Targets />
        <TourPrompt />
        <TourGuide />
      </TourProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Take the tour" }));
    const card = screen.getByRole("dialog", { name: /^Tour:/ });

    // Enough tabs to have escaped a card with three or four controls.
    for (let i = 0; i < 8; i++) await userEvent.tab();
    expect(
      card.contains(document.activeElement),
      `focus escaped to <${document.activeElement?.tagName.toLowerCase()}> ` +
        `"${document.activeElement?.textContent?.trim()}"`,
    ).toBe(true);
  });

  it("tells assistive tech the background is unavailable, because it is", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Take the tour" }));
    expect(
      screen.getByRole("dialog", { name: /^Tour:/ }).getAttribute("aria-modal"),
    ).toBe("true");
  });
});

describe("replaying it", () => {
  function Replay() {
    const tour = useTour();
    return <button onClick={tour.start}>Take the tour again</button>;
  }

  it("can be started again after it has been answered", async () => {
    markTourSeen("user-under-test");
    render(
      <TourProvider>
        <Targets />
        <Replay />
        <TourPrompt />
        <TourGuide />
      </TourProvider>,
    );
    expect(screen.queryByRole("region", { name: "Introductory tour" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Take the tour again" }));
    expect(screen.getByRole("dialog", { name: /^Tour:/ })).toBeTruthy();
  });
});
