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

import { useEffect, useRef, type JSX } from "react";
import { Box, Paper, Tooltip, Typography } from "@wso2/oxygen-ui";
// Oxygen 0.6.0 re-exports neither of these (checked against its dist), and
// @mui/material is already a direct dependency that the theme files import from.
import ClickAwayListener from "@mui/material/ClickAwayListener";
import Popper from "@mui/material/Popper";
import { LockIcon } from "@wso2/oxygen-ui-icons-react";
import { useNavigate } from "react-router";
import {
  FUNCTIONAL_PERSPECTIVES,
  CROSS_PERSPECTIVES,
  type PerspectiveDef,
} from "@constants/perspectives";
import { useActivePerspective } from "@context/perspective/PerspectiveContext";
import { perspectiveHue } from "@config/perspectiveHues";

interface WaffleOverlayProps {
  /** The launcher button. The panel hangs off it and closes back onto it. */
  anchorEl: HTMLElement;
  onClose: () => void;
}

// The app switcher: a panel hanging off the launcher button, functional
// (persona) apps on top, cross (Me / Service Requests) below. Locked tiles show
// a padlock and don't navigate.
//
// Deliberately NOT modal, which is the whole point of the `Popper`. A launcher
// is a place you glance at, so the page behind it stays scrollable and
// clickable and nothing is dimmed. That trade is real and worth naming: a modal
// would give focus containment and hide the background from assistive tech for
// free, and this gives up both. What replaces them:
//
//  - Escape closes, and a click outside closes (ClickAwayListener).
//  - Focus moves into the panel on open and returns to the button on close.
//  - Tab is free to leave the panel, which is correct here — trapping focus in
//    a surface the user can click straight past would strand them.
//  - `role="dialog"` WITHOUT `aria-modal`. Claiming aria-modal on a non-modal
//    surface tells a screen reader the rest of the page is inert when it isn't.
export default function WaffleOverlay({ anchorEl, onClose }: WaffleOverlayProps): JSX.Element {
  const navigate = useNavigate();
  const active = useActivePerspective();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Captured at setup, not read in the cleanup: by teardown the ref may
    // already be detached, which would silently skip the focus restore below.
    const panel = panelRef.current;
    // Focus the panel rather than the first tile: landing on "People Ops"
    // would read as though it were selected.
    panel?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      // Only pull focus back if it is still inside the panel. If the user
      // clicked into the page behind, yanking focus to the button would undo
      // the very interaction this panel exists to allow.
      if (panel?.contains(document.activeElement)) {
        anchorEl.focus();
      }
    };
  }, [onClose, anchorEl]);

  const pick = (p: PerspectiveDef) => {
    if (!p.access || !p.path) return;
    navigate(p.path);
    onClose();
  };

  return (
    <ClickAwayListener
      onClickAway={(event) => {
        // The button owns its own toggle. Without this, clicking it while open
        // would close here and immediately reopen there.
        if (anchorEl.contains(event.target as Node)) return;
        onClose();
      }}
    >
      <Popper
        open
        anchorEl={anchorEl}
        placement="bottom-start"
        // Keep it beside the button rather than sliding along the viewport, and
        // let it flip above if the window is short.
        modifiers={[
          { name: "offset", options: { offset: [0, 8] } },
          { name: "preventOverflow", options: { padding: 8 } },
        ]}
        sx={{ zIndex: (theme) => theme.zIndex.modal }}
      >
        <Paper
          ref={panelRef}
          tabIndex={-1}
          role="dialog"
          aria-label="All apps"
          elevation={8}
          sx={{
            width: 336,
            maxWidth: "calc(100vw - 16px)",
            p: 1.5,
            border: 1,
            borderColor: "divider",
            borderRadius: 2,
            "&:focus": { outline: "none" },
          }}
        >
          <Typography variant="overline" color="text.secondary" component="h2">
            Apps
          </Typography>
          <WaffleGroup items={FUNCTIONAL_PERSPECTIVES} activeKey={active.key} onPick={pick} />

          <Typography
            variant="overline"
            color="text.secondary"
            component="h2"
            sx={{ display: "block", mt: 1.5 }}
          >
            For you
          </Typography>
          <WaffleGroup items={CROSS_PERSPECTIVES} activeKey={active.key} onPick={pick} />
        </Paper>
      </Popper>
    </ClickAwayListener>
  );
}

interface WaffleGroupProps {
  items: readonly PerspectiveDef[];
  activeKey: string;
  onPick: (p: PerspectiveDef) => void;
}

function WaffleGroup({ items, activeKey, onPick }: WaffleGroupProps): JSX.Element {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 1,
        mt: 1,
      }}
    >
      {items.map((p) => {
        const isActive = p.key === activeKey;
        // Undefined for a perspective with no hue yet, which degrades to the
        // neutral treatment rather than breaking the grid.
        const tint = perspectiveHue(p.key);
        const tile = (
          <Box
            component="button"
            type="button"
            onClick={() => onPick(p)}
            disabled={!p.access}
            aria-label={p.access ? `Switch to ${p.label}` : `${p.label} — not available yet`}
            aria-current={isActive ? "page" : undefined}
            sx={{
              all: "unset",
              boxSizing: "border-box",
              // `all: unset` leaves the button shrink-to-fit, so without an
              // explicit width every tile sized to its own label — measured
              // 38.7px for "CSM" against 90.6px for "Marketing Ops" — and
              // `aspectRatio` then derived a different height for each.
              width: "100%",
              borderRadius: 1.5,
              position: "relative",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "flex-start",
              gap: 0.75,
              px: 0.75,
              py: 1,
              textAlign: "center",
              color: "text.primary",
              // No border and no fill on the tile itself: the coloured badge below
              // is the object, and a grid of outlined boxes reads as a form rather
              // than a set of apps.
              cursor: p.access ? "pointer" : "not-allowed",
              transition: "background-color .15s",
              "&:hover:not(:disabled)": { bgcolor: "action.hover" },
              "&:focus-visible": {
                outline: 2,
                outlineStyle: "solid",
                outlineColor: "primary.main",
                outlineOffset: 2,
              },
              // Locked tiles desaturate rather than fade. `opacity` composites the
              // glyph and its wash toward the page together, which measured 1.82:1
              // and fails WCAG 1.4.11; removing the hue holds at 4.63:1.
              ...(p.access ? {} : { filter: "grayscale(1) contrast(0.9)" }),
            }}
          >
            {/* Every tile must have identical internal geometry, or the badges
                sit at different heights across the grid. Three rules do that:
                the badge never shrinks; the label always occupies exactly two
                lines whether or not it wraps ("Leave" vs "Marketing Ops"); and
                the padlock is taken out of flow so a locked tile doesn't have
                an extra flex child to centre around. */}
            <Box
              sx={(theme) => ({
                width: 48,
                height: 48,
                flexShrink: 0,
                borderRadius: "30%",
                display: "grid",
                placeItems: "center",
                // The rounded container is what makes a line glyph read as an app
                // icon rather than a toolbar button — lucide ships no filled set,
                // so the wash supplies the visual mass instead.
                bgcolor: tint?.light.bg ?? "action.hover",
                color: tint?.light.fg ?? "text.primary",
                ...theme.applyStyles("dark", {
                  bgcolor: tint?.dark.bg ?? theme.palette.action.hover,
                  color: tint?.dark.fg ?? theme.palette.text.primary,
                }),
                // Selection is a neutral ring, never the brand accent: an orange
                // ring around Me's orange wash measures 3.00:1 and disappears.
                // Ink against the washes holds at 12.9-14.5:1.
                ...(isActive && {
                  outline: "2px solid",
                  outlineColor: "text.primary",
                  outlineOffset: 2,
                }),
              })}
            >
              <p.icon size={24} />
            </Box>
            <Typography
              variant="caption"
              sx={{
                fontWeight: isActive ? 600 : 400,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                lineHeight: 1.25,
                height: "2.5em",
                width: "100%",
              }}
            >
              {p.label}
            </Typography>
            {!p.access && (
              <LockIcon
                size={11}
                aria-hidden
                style={{ position: "absolute", top: 6, right: 6 }}
              />
            )}
          </Box>
        );

        // A disabled button emits no pointer events, so the tooltip needs a
        // wrapper to hang off.
        return p.access ? (
          <Box key={p.key}>{tile}</Box>
        ) : (
          <Tooltip key={p.key} title={`${p.label} isn't available yet`}>
            <Box sx={{ display: "block" }}>{tile}</Box>
          </Tooltip>
        );
      })}
    </Box>
  );
}
