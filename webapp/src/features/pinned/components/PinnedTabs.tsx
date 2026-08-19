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

import { Box, Chip, Tooltip } from "@wso2/oxygen-ui";
import type { JSX } from "react";
import { useAsgardeo } from "@asgardeo/react";
import { useLocation, useNavigate } from "react-router";
import { PIN_KIND_META } from "@features/pinned/pinKinds";
import { togglePin } from "@features/pinned/pinnedStore";
import { usePinnedEntries } from "@features/pinned/usePinned";
import type { PinnedEntry } from "@features/pinned/pinnedStore";

/**
 * Compact chip label. Registry labels are qualified for global uniqueness
 * ("OPD Claims · Claim History"), which is right in a list but too long for a
 * chip — so the chip shows the leaf and the tooltip carries the full path.
 */
function shortLabel(entry: PinnedEntry): string {
  const parts = entry.label.split(" · ");
  return parts[parts.length - 1] || entry.label;
}

/**
 * The pinned working set as persistent chips in the top bar.
 *
 * Pins are global, not per-perspective, and that is the point: the rail only
 * shows the ACTIVE perspective's sections, so without this there is no way to
 * keep a Leave or OPD screen one click away while working in People Ops.
 *
 * Occupies the header's flexible middle region, collapsing to a plain spacer
 * when nothing is pinned so the layout is identical either way.
 */
export default function PinnedTabs(): JSX.Element {
  const { isSignedIn } = useAsgardeo();
  const navigate = useNavigate();
  const location = useLocation();
  const pinned = usePinnedEntries();

  if (!isSignedIn || pinned.length === 0) {
    return <Box sx={{ flexGrow: 1 }} />;
  }

  const currentHref = location.pathname + location.search;

  return (
    <Box
      sx={{
        flexGrow: 1,
        minWidth: 0,
        display: "flex",
        alignItems: "center",
        gap: 0.75,
        overflowX: "auto",
        // Quiet scrollbar — the strip should read as content, not a control.
        "&::-webkit-scrollbar": { height: 6 },
        "&::-webkit-scrollbar-thumb": { bgcolor: "action.disabled", borderRadius: 3 },
      }}
    >
      {pinned.map((entry) => {
        const Icon = PIN_KIND_META[entry.kind].icon;
        // A "search" pin is path + query, so it has to match the whole href.
        // Matching on path alone would light up every filtered pin of the same
        // route at once.
        const active =
          entry.kind === "search"
            ? currentHref === entry.href
            : location.pathname === entry.href.split("?")[0];

        return (
          <Tooltip key={`${entry.kind}-${entry.id}`} title={entry.label}>
            <Chip
              size="small"
              icon={<Icon size={14} />}
              label={shortLabel(entry)}
              variant={active ? "filled" : "outlined"}
              onClick={() => navigate(entry.href)}
              onDelete={() => togglePin(entry)}
              aria-label={`${entry.label} — pinned`}
              aria-current={active ? "page" : undefined}
              sx={{
                flexShrink: 0,
                maxWidth: 200,
                cursor: "pointer",
                // Same "you are here" language as the rail: a selected wash plus
                // weight, never brand orange behind small text (white-on-orange
                // at this size fails AA).
                ...(active ? { bgcolor: "action.selected", fontWeight: 600 } : {}),
              }}
            />
          </Tooltip>
        );
      })}
    </Box>
  );
}
