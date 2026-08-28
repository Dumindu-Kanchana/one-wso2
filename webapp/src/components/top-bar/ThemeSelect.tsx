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

import {
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
} from "@wso2/oxygen-ui";
import { CheckIcon, PaletteIcon } from "@wso2/oxygen-ui-icons-react";
import { useState, type JSX } from "react";
import { useThemePreference } from "@context/theme/ThemePreferenceContext";

/**
 * Picks the active theme, and persists it (see ThemePreferenceProvider).
 *
 * An icon and menu rather than a visible dropdown: this header already carries
 * the launcher, pin, colour-scheme and user controls, and the pinned strip takes
 * whatever width is left, so a ~130px select would squeeze the strip it sits
 * next to. The trade is discoverability, which the tooltip and the palette glyph
 * carry.
 *
 * Distinct from the colour-scheme toggle beside it: this chooses the palette,
 * that chooses light or dark within it.
 */
export default function ThemeSelect(): JSX.Element {
  const { themeKey, setThemeKey, options } = useThemePreference();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = anchorEl !== null;

  return (
    <>
      <Tooltip title="Change theme">
        <IconButton
          onClick={(e) => setAnchorEl(e.currentTarget)}
          size="small"
          aria-label="Change theme"
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <PaletteIcon size={20} />
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        {options.map((o) => (
          <MenuItem
            key={o.key}
            selected={o.key === themeKey}
            onClick={() => {
              setThemeKey(o.key);
              setAnchorEl(null);
            }}
          >
            {/* The tick occupies its slot on every row, so the labels stay on one
                left edge instead of shifting as the selection moves. */}
            <ListItemIcon sx={{ minWidth: 28 }}>
              {o.key === themeKey ? <CheckIcon size={16} /> : null}
            </ListItemIcon>
            {/* slotProps, not the deprecated primaryTypographyProps — MUI 7
                still accepts that one but warns, and drops it next major. */}
            <ListItemText slotProps={{ primary: { variant: "body2" } }}>
              {o.label}
            </ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
