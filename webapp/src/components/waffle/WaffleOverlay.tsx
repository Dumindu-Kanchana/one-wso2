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

import { useEffect, useRef } from "react";
import { Box, Typography } from "@wso2/oxygen-ui";
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

// The 9-dots perspective switcher. Grid of tiles: functional (persona) on
// top, cross (My / Requests) below. Locked tiles show a padlock and don't
// navigate.
//
// Keyboard support: Escape dismisses; tiles are real <button> elements so
// Tab moves between them and Enter/Space activates. Focus lands on the
// first accessible tile when the overlay opens so a keyboard user isn't
// stranded outside the modal.
export default function WaffleOverlay({ onClose }: WaffleOverlayProps) {
  const navigate = useNavigate();
  const active = useActivePerspective();
  const firstTileRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    firstTileRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const pick = (p: PerspectiveDef) => {
    if (!p.access || !p.path) return;
    navigate(p.path);
    onClose();
  };

  return (
    <Box
      onClick={onClose}
      sx={{
        position: "fixed",
        inset: 0,
        bgcolor: "rgba(10,10,11,.4)",
        backdropFilter: "blur(3px)",
        zIndex: 1300,
      }}
    >
      <Box
        onClick={(e) => e.stopPropagation()}
        sx={{
          position: "absolute",
          top: 54,
          right: 120,
          width: 340,
          bgcolor: "background.paper",
          border: 1,
          borderColor: "divider",
          borderRadius: 2,
          boxShadow: 8,
          p: 1.75,
        }}
      >
        <WaffleGroup
          title="Apps"
          items={FUNCTIONAL_PERSPECTIVES}
          activeKey={active.key}
          onPick={pick}
          firstTileRef={firstTileRef}
        />
        <WaffleGroup
          title="For you"
          items={CROSS_PERSPECTIVES}
          activeKey={active.key}
          onPick={pick}
        />
      </Box>
    </Box>
  );
}

interface WaffleGroupProps {
  title: string;
  items: readonly PerspectiveDef[];
  activeKey: string;
  onPick: (p: PerspectiveDef) => void;
  firstTileRef?: React.RefObject<HTMLButtonElement | null>;
}

function WaffleGroup({ title, items, activeKey, onPick, firstTileRef }: WaffleGroupProps) {
  let firstAccessibleIndex = items.findIndex((p) => p.access);
  if (firstAccessibleIndex < 0) firstAccessibleIndex = 0;
  return (
    <>
      <Typography
        sx={{
          fontSize: 10.5,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "text.disabled",
          fontWeight: 600,
          m: "10px 4px 8px",
        }}
      >
        {title}
      </Typography>
      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1 }}>
        {items.map((p, i) => (
          <Box
            key={p.key}
            component="button"
            type="button"
            ref={firstTileRef && i === firstAccessibleIndex ? firstTileRef : undefined}
            onClick={() => onPick(p)}
            disabled={!p.access}
            aria-label={p.access ? `Switch to ${p.label}` : `${p.label} (locked)`}
            aria-current={p.key === activeKey ? "page" : undefined}
            sx={{
              all: "unset",
              boxSizing: "border-box",
              aspectRatio: "1",
              border: 1,
              borderStyle: "solid",
              borderColor: p.key === activeKey ? "primary.main" : "divider",
              borderRadius: 1.375,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 0.75,
              fontSize: 11,
              fontWeight: 600,
              color: p.access ? "text.primary" : "text.disabled",
              opacity: p.access ? 1 : 0.4,
              cursor: p.access ? "pointer" : "not-allowed",
              bgcolor: p.key === activeKey ? "primary.light" : "transparent",
              transition: "border-color .15s, background-color .15s",
              "&:hover:not(:disabled)": {
                borderColor: "primary.main",
                color: "primary.main",
                bgcolor: "primary.light",
              },
              "&:focus-visible": {
                outline: 2,
                outlineStyle: "solid",
                outlineColor: "primary.main",
                outlineOffset: 2,
              },
              px: 0.75,
              py: 0.75,
              textAlign: "center",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
              <p.icon size={20} />
            </Box>
            {p.label}
            {!p.access && (
              <Box sx={{ display: "flex", alignItems: "center" }}>
                <LockIcon size={11} />
              </Box>
            )}
          </Box>
        ))}
      </Box>
    </>
  );
}
