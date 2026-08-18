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
              aspectRatio: "1",
              border: 1,
              borderStyle: "solid",
              borderColor: isActive ? "primary.main" : "divider",
              borderRadius: 1.5,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 0.75,
              px: 0.75,
              textAlign: "center",
              // Same "you are here" language the rail uses: a selected wash
              // plus weight, never brand orange behind small text.
              bgcolor: isActive ? "action.selected" : "transparent",
              color: "text.primary",
              // csm-portal's treatment for a not-yet-available destination.
              opacity: p.access ? 1 : 0.45,
              cursor: p.access ? "pointer" : "not-allowed",
              transition: "border-color .15s, background-color .15s",
              "&:hover:not(:disabled)": {
                borderColor: "primary.main",
                bgcolor: "action.hover",
              },
              "&:focus-visible": {
                outline: 2,
                outlineStyle: "solid",
                outlineColor: "primary.main",
                outlineOffset: 2,
              },
            }}
          >
            <p.icon size={20} />
            <Typography variant="caption" sx={{ fontWeight: isActive ? 600 : 400 }}>
              {p.label}
            </Typography>
            {!p.access && <LockIcon size={11} aria-hidden />}
          </Box>
        );

        // A disabled button emits no pointer events, so the tooltip needs a
        // wrapper to hang off — same shape csm-portal uses for its WIP nav rows.
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
