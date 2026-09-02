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
 * The running tour: a card anchored to one control at a time, over a dimmed page.
 *
 * The dim is a single huge spread shadow on the highlight ring rather than four
 * masking panels — one element, no seams, and it follows the target's own box so
 * nothing has to be measured twice.
 *
 * Anchoring is recomputed on scroll and resize because the target is a live
 * element in a live app, not a fixed coordinate. A step whose target vanishes
 * mid-step ends the tour rather than leaving a card pointing at nothing.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { placeCard, type Rect } from "./tourPlacement";
import { Box, Button, Paper, Typography } from "@wso2/oxygen-ui";
import { useTour } from "./tourContext";

const PAD = 6;
const CARD_W = 320;

export default function TourGuide() {
  const tour = useTour();
  const [rect, setRect] = useState<Rect | null>(null);
  // What the card must not cover: the target, plus any panel opened for it.
  const [avoid, setAvoid] = useState<Rect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const measure = useCallback(() => {
    const selector = tour.step?.selector;
    if (!selector) {
      setRect(null);
      setAvoid(null);
      return;
    }
    const el = document.querySelector(selector);
    if (!el) {
      setRect(null);
      setAvoid(null);
      return;
    }
    // Bring it into view first: the rail scrolls, and a target below the fold
    // would otherwise be ringed off-screen.
    el.scrollIntoView({ block: "nearest", inline: "nearest" });
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) {
      setRect(null);
      return;
    }
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });

    // What the card must stay clear of. For a step that opens the launcher this
    // is the panel as well as the button — a corner behind the open panel is not
    // a usable corner.
    const panel = tour.wantsLauncher
      ? document.querySelector('[aria-label="All apps"]')
      : null;
    const pr = panel?.getBoundingClientRect();
    setAvoid(
      pr && pr.width > 0
        ? {
            top: Math.min(r.top, pr.top),
            left: Math.min(r.left, pr.left),
            width: Math.max(r.right, pr.right) - Math.min(r.left, pr.left),
            height: Math.max(r.bottom, pr.bottom) - Math.min(r.top, pr.top),
          }
        : { top: r.top, left: r.left, width: r.width, height: r.height },
    );
  }, [tour.step, tour.wantsLauncher]);

  useEffect(() => {
    if (!tour.running) return;
    // A frame's grace so the launcher this step may have opened is laid out
    // before its star is measured.
    const id = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [tour.running, tour.index, measure]);

  // Escape ends it, as it does for every other overlay in the app.
  useEffect(() => {
    if (!tour.running) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") tour.finish();
      if (e.key === "ArrowRight") tour.next();
      if (e.key === "ArrowLeft") tour.back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tour]);

  /**
   * Measure the card, then position it by writing to its style directly.
   *
   * Not via state: the size can only be read after the card has rendered, so
   * setting state here would queue a second render for every step — the
   * cascading-render pattern the lint rule warns about. Writing the style inside
   * a layout effect lands before paint, so there is nothing to see either way.
   *
   * The height is measured rather than assumed. The copy differs per step, and
   * guessing it is what leaves a card hanging off the bottom of the screen.
   */
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!tour.running || !card) return;
    const box = card.getBoundingClientRect();
    const at = placeCard(
      // A step with no target still docks, rather than jumping to the middle of
      // the screen and back again on the next step.
      avoid ?? { top: 0, left: 0, width: 0, height: 0 },
      { w: box.width, h: box.height },
      { width: window.innerWidth, height: window.innerHeight },
      tour.step?.prefer,
    );
    // "none", not "": an empty string drops the inline override and lets the
    // sx transform below take effect again, which moved every card half its own
    // width and height off the position just computed for it.
    card.style.transform = "none";
    card.style.bottom = "";
    card.style.right = "";
    card.style.top = `${at.top}px`;
    card.style.left = `${at.left}px`;
  }, [tour.running, tour.index, avoid, tour.step?.prefer]);

  // Focus the card on each step so a keyboard user follows the tour rather than
  // being left behind on whatever had focus before it started.
  useEffect(() => {
    if (tour.running) cardRef.current?.focus();
  }, [tour.running, tour.index]);

  if (!tour.running || !tour.step) return null;

  const isLast = tour.index === tour.total - 1;
  // Centred before the layout effect measures it, which is where it settles for
  // every step this tour has — so the first paint of a step does not jump.
  const cardStyle = { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };

  return (
    <>
      {/*
        Nothing underneath is clickable while the tour runs.

        Not only to stop someone wandering off mid-step: it makes the tour the
        sole owner of what is open. Every step measures a layout the tour itself
        arranged, so a position that is right once is right every time — rather
        than depending on whatever state a stray click left behind.

        Transparent, and below the ring, so the spotlight look comes from the
        ring's own shadow and the highlighted control stays bright. It does NOT
        replace TourDriver's launcher hold: MUI's ClickAwayListener listens on
        the document, so a click on the tour card still reaches it and would
        close the launcher regardless of anything blocking the app tree.
      */}
      <Box
        aria-hidden
        data-tour-blocker=""
        onPointerDownCapture={(e) => e.stopPropagation()}
        onClickCapture={(e) => e.stopPropagation()}
        sx={{
          position: "fixed",
          inset: 0,
          cursor: "default",
          zIndex: (t) => t.zIndex.modal + 1,
        }}
      />

      {/* The ring, and the dim it casts over everything else. */}
      {rect ? (
        <Box
          aria-hidden
          sx={{
            position: "fixed",
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            borderRadius: 1.5,
            border: "2px solid",
            borderColor: "primary.main",
            boxShadow: "0 0 0 9999px rgba(9, 12, 17, 0.45)",
            pointerEvents: "none",
            zIndex: (t) => t.zIndex.modal + 2,
          }}
        />
      ) : (
        <Box
          aria-hidden
          sx={{
            position: "fixed",
            inset: 0,
            bgcolor: "rgba(9, 12, 17, 0.45)",
            zIndex: (t) => t.zIndex.modal + 2,
          }}
        />
      )}

      <Paper
        ref={cardRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="false"
        aria-label={`Tour: ${tour.step.title}`}
        elevation={12}
        sx={{
          position: "fixed",
          width: CARD_W,
          maxWidth: "calc(100vw - 24px)",
          p: 2,
          borderRadius: 2,
          zIndex: (t) => t.zIndex.modal + 3,
          outline: "none",
          ...cardStyle,
        }}
      >
        <Typography
          variant="overline"
          color="text.secondary"
          sx={{ display: "block", lineHeight: 1.6 }}
        >
          Step {tour.index + 1} of {tour.total}
        </Typography>
        <Typography sx={{ fontWeight: 600, mb: 0.5 }}>{tour.step.title}</Typography>
        <Typography variant="body2" color="text.secondary" aria-live="polite">
          {tour.step.body}
        </Typography>
        <Box sx={{ display: "flex", gap: 1, mt: 1.75, justifyContent: "flex-end" }}>
          {/* Not on the last step: there, End tour and Done are the same action,
              and offering the same outcome twice just asks the reader to pick. */}
          {!isLast && (
            <Button size="small" color="inherit" onClick={tour.finish}>
              End tour
            </Button>
          )}
          {tour.index > 0 && (
            <Button size="small" color="inherit" onClick={tour.back}>
              Back
            </Button>
          )}
          <Button
            size="small"
            variant="contained"
            onClick={isLast ? tour.finish : tour.next}
          >
            {isLast ? "Done" : "Next"}
          </Button>
        </Box>
      </Paper>
    </>
  );
}
