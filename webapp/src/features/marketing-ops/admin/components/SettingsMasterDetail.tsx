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

import type { ReactNode } from "react";
import { Box, MenuItem, Select, Typography } from "@wso2/oxygen-ui";

// Master–detail layout for a Marketing Admin panel: a sticky left nav of the
// panel's lists (optionally grouped, with an unsaved-changes dot) plus a right
// pane showing the one selected editor.
//
// Why not just stack every list vertically: these panels hold a dozen-plus
// lists, and the thing you need while editing "Salesforce Campaign · Target
// Region" is to still see WHICH asset type you're editing. Stacked, that context
// scrolls off the top the moment you start work.
export interface NavItem {
  key: string;
  label: string;
  dirty?: boolean;
}
export interface NavGroup {
  label?: string;
  items: NavItem[];
}

export default function SettingsMasterDetail({
  groups,
  selected,
  onSelect,
  children,
}: {
  groups: NavGroup[];
  selected: string;
  onSelect: (key: string) => void;
  children: ReactNode;
}) {
  return (
    <Box
      sx={{
        display: "flex",
        // Column on narrow screens: 210px of sticky nav beside a two-column row
        // editor doesn't fit, so the nav becomes a select stacked above instead.
        flexDirection: { xs: "column", md: "row" },
        gap: 2.5,
        alignItems: { xs: "stretch", md: "flex-start" },
      }}
    >
      <Box
        component="nav"
        aria-label="Settings lists"
        sx={{
          width: 210,
          flexShrink: 0,
          position: "sticky",
          top: 12,
          maxHeight: "calc(100vh - 130px)",
          overflowY: "auto",
          // Collapse to a full-width block above the editor on narrow screens —
          // 210px of sticky nav next to a two-column row editor doesn't fit.
          display: { xs: "none", md: "block" },
        }}
      >
        {groups.map((g, gi) => (
          <Box key={g.label ?? gi} sx={{ mb: 1.5 }}>
            {g.label && (
              <Typography
                sx={{
                  fontSize: 9.5,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  color: "text.disabled",
                  px: 1,
                  mb: 0.5,
                }}
              >
                {g.label}
              </Typography>
            )}
            {g.items.map((it) => {
              const on = it.key === selected;
              return (
                <Box
                  key={it.key}
                  component="button"
                  type="button"
                  aria-current={on ? "true" : undefined}
                  onClick={() => onSelect(it.key)}
                  sx={{
                    width: "100%",
                    textAlign: "left",
                    border: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    px: 1,
                    py: 0.65,
                    mb: 0.25,
                    borderRadius: 1,
                    cursor: "pointer",
                    fontSize: 12.5,
                    fontFamily: "inherit",
                    fontWeight: on ? 700 : 500,
                    color: on ? "primary.main" : "text.secondary",
                    bgcolor: on ? "action.selected" : "transparent",
                    transition: "background-color .12s, color .12s",
                    "&:hover": { bgcolor: "action.hover", color: "primary.main" },
                  }}
                >
                  <Box
                    component="span"
                    sx={{
                      flex: 1,
                      minWidth: 0,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {it.label}
                  </Box>
                  {it.dirty && <UnsavedDot />}
                </Box>
              );
            })}
          </Box>
        ))}
      </Box>

      {/* Narrow-screen fallback for the same nav. The dirty marker becomes a
          "•" suffix in the label — a select option can't hold a child element. */}
      <Box sx={{ display: { xs: "block", md: "none" } }}>
        <Select
          fullWidth
          size="small"
          aria-label="Settings list"
          value={selected}
          onChange={(e) => onSelect(String(e.target.value))}
          sx={{ fontSize: 13 }}
        >
          {groups.flatMap((g) =>
            g.items.map((it) => (
              <MenuItem key={it.key} value={it.key} sx={{ fontSize: 13 }}>
                {g.label ? `${g.label} · ${it.label}` : it.label}
                {it.dirty ? " •" : ""}
              </MenuItem>
            )),
          )}
        </Select>
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>{children}</Box>
    </Box>
  );
}

// Unsaved-changes marker. `title` rather than a Tooltip: it sits inside a
// clickable nav row, and a Tooltip wrapper here would swallow the row's click
// target on touch.
function UnsavedDot() {
  return (
    <Box
      title="Unsaved changes"
      aria-label="Unsaved changes"
      sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "primary.main", flexShrink: 0 }}
    />
  );
}
