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

import type { JSX } from "react";
import { Box, Dialog, DialogContent, Tooltip, Typography } from "@wso2/oxygen-ui";
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
  onClose: () => void;
}

// The app switcher. Grid of tiles: functional (persona) on top, cross
// (Me / Service Requests) below. Locked tiles show a padlock and don't navigate.
//
// Now a real MUI `Dialog` rather than a hand-rolled `position: fixed` div, so
// focus trapping, focus restore on close, Escape handling, scroll lock, and
// `aria-modal` all come from the library instead of being partially
// reimplemented here.
export default function WaffleOverlay({ onClose }: WaffleOverlayProps): JSX.Element {
  const navigate = useNavigate();
  const active = useActivePerspective();

  const pick = (p: PerspectiveDef) => {
    if (!p.access || !p.path) return;
    navigate(p.path);
    onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      aria-labelledby="waffle-title"
    >
      <DialogContent>
        <Typography id="waffle-title" variant="overline" color="text.secondary" component="h2">
          Apps
        </Typography>
        <WaffleGroup items={FUNCTIONAL_PERSPECTIVES} activeKey={active.key} onPick={pick} />

        <Typography
          variant="overline"
          color="text.secondary"
          component="h2"
          sx={{ display: "block", mt: 2 }}
        >
          For you
        </Typography>
        <WaffleGroup items={CROSS_PERSPECTIVES} activeKey={active.key} onPick={pick} />
      </DialogContent>
    </Dialog>
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
