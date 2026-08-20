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
import {
  Box,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from "@wso2/oxygen-ui";
import { useNavigate } from "react-router";
import { PIN_KIND_META } from "@features/pinned/pinKinds";
import { usePinnedEntries } from "@features/pinned/usePinned";

interface AskNoveraPaletteProps {
  onClose: () => void;
}

// The ⌘K palette. Two things live here:
//
//  - The pinned working set, which is real and usable today.
//  - Novera's "coming soon" state. Named openly rather than hidden behind
//    generic "search" copy — the assistant is a committed part of the product,
//    and stating that it is still coming is honest in a way the earlier
//    prototype's pre-filled query and canned response were not.
//
// As live search and then the assistant land, they slot in above and below the
// pinned group without the surface changing shape.
export default function AskNoveraPalette({ onClose }: AskNoveraPaletteProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const pinned = usePinnedEntries();
  const hasFocusableContent = pinned.length > 0;

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
      } else if (e.key === "Tab" && !hasFocusableContent) {
        // Nothing inside to reach — keep focus pinned to the panel instead of
        // letting Tab/Shift+Tab escape to the background.
        //
        // Conditional now: with pinned entries listed, the panel DOES have
        // focusable content, and trapping Tab here would make those rows
        // keyboard-unreachable. This is the assumption the pinned list broke.
        e.preventDefault();
        panelRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      previouslyFocused?.focus();
    };
  }, [onClose, hasFocusableContent]);

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
          <Typography sx={{ flex: 1, fontSize: 15, fontWeight: 600 }}>
            Ask Novera
          </Typography>
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

        {/* The pinned working set. The header strip shows the same entries but
            caps out at the visible width, so this is where the full set stays
            reachable — and it is the seam this palette grows along: live search
            and, eventually, Novera itself slot in above and below. */}
        {pinned.length > 0 && (
          <Box sx={{ py: 1 }}>
            <Typography
              variant="overline"
              color="text.secondary"
              component="h2"
              sx={{ display: "block", px: 2.25, pb: 0.5 }}
            >
              Pinned
            </Typography>
            <List disablePadding>
              {pinned.map((entry) => {
                const Icon = PIN_KIND_META[entry.kind].icon;
                return (
                  <ListItemButton
                    key={`${entry.kind}-${entry.id}`}
                    onClick={() => {
                      navigate(entry.href);
                      onClose();
                    }}
                    sx={{ px: 2.25, py: 0.875 }}
                  >
                    <ListItemIcon sx={{ minWidth: 0, mr: 1.5 }}>
                      <Icon size={16} />
                    </ListItemIcon>
                    <ListItemText primary={entry.label} />
                  </ListItemButton>
                );
              })}
            </List>
          </Box>
        )}

        <Box sx={{ p: "28px 22px", textAlign: "center" }}>
          <Typography sx={{ fontWeight: 600, mb: 0.75 }}>Coming soon</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360, mx: "auto" }}>
            Hi! I&apos;m Novera, WSO2&apos;s internal AI agent. Soon you&apos;ll be able to ask me
            things and get answers.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
