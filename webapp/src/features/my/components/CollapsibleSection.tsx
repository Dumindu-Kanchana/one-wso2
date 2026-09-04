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
import { useEffect, useState, type ReactNode } from "react";
import { Box, Collapse, Typography } from "@wso2/oxygen-ui";
import { ChevronDownIcon } from "@wso2/oxygen-ui-icons-react";

// A section header that is also its own disclosure.
//
// Visually it is SectionHeader — same small caps, same hairline rules — so a
// collapsed section reads as part of the same list as an open one rather than
// as a different kind of thing. The whole header is the hit target, not just
// the chevron.
//
// The children are mounted only while open. That is what makes this useful for
// a section whose data is fetched on demand: `onOpen` fires the first time it
// is expanded, and the caller uses it to enable a query. Nothing is requested
// for a section nobody opened.
/**
 * Which sections are open, for as long as the tab is.
 *
 * Deliberately a module variable rather than localStorage or sessionStorage,
 * and the reason is not the size of the value — a boolean is not personal data.
 * It is that anything surviving a reload would reopen the section on arrival,
 * and reopening it fetches and paints someone's NIC, date of birth and home
 * address before they have asked for anything. A section that remembers itself
 * across reloads undoes the change this component exists to make.
 *
 * So: open a section, navigate away, come back — still open. Reload, and every
 * section starts closed again, which is the state a fresh page should be in.
 */
const openSections = new Set<string>();

export default function CollapsibleSection({
  title,
  children,
  onOpen,
  rememberAs,
}: {
  title: string;
  children: ReactNode;
  /**
   * Called whenever this section becomes open, including on mount when it was
   * restored from memory. Must be idempotent.
   */
  onOpen?: () => void;
  /**
   * Remember this section's open state for the life of the tab. Omit for a
   * section that should always start closed.
   */
  rememberAs?: string;
}) {
  const [open, setOpen] = useState(() =>
    rememberAs ? openSections.has(rememberAs) : false,
  );

  // `onOpen` is called here rather than inside the state updater. React calls
  // updaters twice under StrictMode, so a side effect in one runs twice —
  // harmless for a boolean, but it is the kind of thing that stops being
  // harmless when someone later makes onOpen do more.
  // A section restored from memory is open before anything has been clicked, so
  // `onOpen` has to fire here too — otherwise the caller never enables its
  // query and the restored section sits open showing a skeleton forever.
  // `onOpen` is expected to be idempotent, which is why StrictMode running this
  // twice is not a problem.
  useEffect(() => {
    if (open) onOpen?.();
    // Mount only: every later opening goes through `toggle`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = () => {
    if (!open) onOpen?.();
    if (rememberAs) {
      if (open) openSections.delete(rememberAs);
      else openSections.add(rememberAs);
    }
    setOpen((wasOpen) => !wasOpen);
  };

  return (
    <Box>
      <Typography
        component="button"
        type="button"
        onClick={toggle}
        aria-expanded={open}
        sx={{
          // Matches SectionHeader, plus the button reset a Typography-as-button
          // needs: it would otherwise inherit the browser's control styling.
          all: "unset",
          boxSizing: "border-box",
          cursor: "pointer",
          width: "100%",
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "text.disabled",
          fontWeight: 700,
          mt: 3,
          mb: 1.25,
          display: "flex",
          alignItems: "center",
          gap: 1.25,
          "&:hover": { color: "text.secondary" },
          "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 },
          "&::before": { content: '""', width: 14, height: "1px", bgcolor: "divider" },
          "&::after": { content: '""', flex: 1, height: "1px", bgcolor: "divider" },
        }}
      >
        <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
          {title}
          <ChevronDownIcon
            size={13}
            style={{
              transition: "transform .15s",
              transform: open ? "rotate(180deg)" : "none",
            }}
          />
        </Box>
      </Typography>

      <Collapse in={open} unmountOnExit>
        {children}
      </Collapse>
    </Box>
  );
}
