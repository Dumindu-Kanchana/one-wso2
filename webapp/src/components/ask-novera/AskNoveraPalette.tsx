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

interface AskNoveraPaletteProps {
  onClose: () => void;
}

// The ⌘K palette. Ask Novera isn't shipping anytime soon, so this is an
// honest "coming soon" state — the earlier prototype's pre-filled query +
// canned response looked functional but did nothing real when used.
export default function AskNoveraPalette({ onClose }: AskNoveraPaletteProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // There's no input to autofocus anymore (the placeholder has no
    // interactive content at all), so focus the panel itself — otherwise a
    // keyboard user opening this gets no focus change at all and Tab falls
    // straight through to the page behind the overlay. Restore focus to
    // whatever triggered the palette (the ⌘K/Ask Novera control) on close.
    const previouslyFocused = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "Tab") {
        // No focusable content inside — keep focus pinned to the panel
        // instead of letting Tab/Shift+Tab escape to the background.
        e.preventDefault();
        panelRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      previouslyFocused?.focus();
    };
  }, [onClose]);

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
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Ask Novera"
        onClick={(e) => e.stopPropagation()}
        sx={{
          position: "absolute",
          top: 78,
          left: "50%",
          transform: "translateX(-50%)",
          width: 520,
          maxWidth: "92vw",
          bgcolor: "background.paper",
          border: 1,
          borderColor: "divider",
          borderRadius: 2,
          boxShadow: 8,
          overflow: "hidden",
          // Suppress the browser's default focus ring on the panel itself —
          // it's focused programmatically as a dialog container, not as an
          // interactive control.
          "&:focus": { outline: "none" },
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            p: "15px 18px",
            borderBottom: 1,
            borderColor: "divider",
          }}
        >
          <Box
            sx={{
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: (t) => `linear-gradient(135deg, ${t.palette.primary.main}, #ff9a6e)`,
              flexShrink: 0,
            }}
          />
          <Typography sx={{ flex: 1, fontSize: 15, fontWeight: 600 }}>Ask Novera</Typography>
          <Box
            sx={{
              fontSize: 11,
              border: 1,
              borderColor: "divider",
              borderRadius: 0.75,
              px: 0.875,
              py: 0.375,
              color: "text.secondary",
            }}
          >
            esc
          </Box>
        </Box>

        <Box sx={{ p: "28px 22px", textAlign: "center" }}>
          <Typography sx={{ fontSize: 15, fontWeight: 700, mb: 0.75 }}>Coming soon</Typography>
          <Typography sx={{ fontSize: 13, color: "text.secondary", maxWidth: 360, mx: "auto" }}>
            Hi! I'm Novera, WSO2's internal AI agent. Soon you'll be able to ask me things in plain
            English and get answers scoped to what you're working on.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
