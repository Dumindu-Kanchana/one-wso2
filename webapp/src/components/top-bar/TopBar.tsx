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

import { useEffect, type JSX } from "react";
import {
  Box,
  ColorSchemeImage,
  ColorSchemeToggle,
  Header,
  IconButton,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { LayoutGridIcon, SearchIcon } from "@wso2/oxygen-ui-icons-react";
import UserProfileMenu from "./UserProfileMenu";

interface TopBarProps {
  collapsed: boolean;
  onToggleSidebar: () => void;
  onOpenWaffle: () => void;
  onOpenAsk: () => void;
}

// The persistent top bar, on Oxygen's compound `Header`. Child order follows
// csm-portal: Toggle → Brand → (switcher/search) → Spacer → Actions.
//
// Oxygen supplies the bar's height, background, border, and brand-title
// typography, so nothing here sets those. The rail-width-matching `width: 260`
// the old hand-rolled bar used is gone with it — Oxygen's Sidebar is 250/64 and
// the header no longer needs to align to it.
export default function TopBar({
  collapsed,
  onToggleSidebar,
  onOpenWaffle,
  onOpenAsk,
}: TopBarProps): JSX.Element {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenAsk();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onOpenAsk]);

  return (
    <Header>
      <Header.Toggle collapsed={collapsed} onToggle={onToggleSidebar} />

      <Header.Brand sx={{ flexShrink: 0 }}>
        <Header.BrandTitle sx={{ whiteSpace: "nowrap" }}>One</Header.BrandTitle>
        <Header.BrandLogo>
          {/* Oxygen swaps the source on the resolved colour scheme, so the app
              no longer needs its own light/dark mode context just for this. */}
          <ColorSchemeImage
            src={{ light: "/wso2-logo-black.svg", dark: "/wso2-logo-white.svg" }}
            alt="WSO2"
            height={26}
            width="auto"
          />
        </Header.BrandLogo>
      </Header.Brand>

      {/* Ask Novera trigger. Kept as a click target rather than a real input:
          it opens the palette, which owns the actual query field. */}
      <Box
        role="button"
        tabIndex={0}
        onClick={onOpenAsk}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpenAsk();
          }
        }}
        sx={{
          flex: 1,
          minWidth: 0,
          maxWidth: 680,
          mx: "auto",
          display: "flex",
          alignItems: "center",
          gap: 1.25,
          bgcolor: "action.hover",
          border: 1,
          borderColor: "divider",
          borderRadius: 1.5,
          px: 1.75,
          py: 0.75,
          color: "text.secondary",
          cursor: "text",
          transition: "border-color .15s",
          "&:hover": { borderColor: "text.disabled" },
          "&:focus-visible": { outline: 2, outlineStyle: "solid", outlineColor: "primary.main" },
        }}
      >
        <SearchIcon size={16} style={{ flexShrink: 0 }} />
        <Typography variant="body2" noWrap>
          Ask Novera or search…
        </Typography>
        <Box
          sx={{
            ml: "auto",
            display: { xs: "none", sm: "block" },
            bgcolor: "background.paper",
            border: 1,
            borderColor: "divider",
            borderRadius: 0.75,
            px: 0.75,
            flexShrink: 0,
          }}
        >
          <Typography variant="caption">⌘K</Typography>
        </Box>
      </Box>

      <Header.Actions>
        <Tooltip title="Switch app">
          <IconButton onClick={onOpenWaffle} size="small" aria-label="Switch app">
            <LayoutGridIcon size={20} />
          </IconButton>
        </Tooltip>
        {/* Oxygen's own 3-state cycle: light → dark → system. */}
        <ColorSchemeToggle size="small" />
        <UserProfileMenu />
      </Header.Actions>
    </Header>
  );
}
