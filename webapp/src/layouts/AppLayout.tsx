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

import { useEffect, useRef, useState, type JSX } from "react";
import { Outlet, useLocation } from "react-router";
import { Box, useAppShell } from "@wso2/oxygen-ui";
import TopBar from "@components/top-bar/TopBar";
import SideRail from "@components/side-rail/SideRail";
import WaffleOverlay from "@components/waffle/WaffleOverlay";
import AskNoveraPalette from "@components/ask-novera/AskNoveraPalette";
import AppFooter from "@components/footer/AppFooter";
import AuthDebugPanel from "@features/debug/AuthDebugPanel";
import AppShellLayout from "@layouts/AppShellLayout";
import { useIdleLogout } from "@hooks/useIdleLogout";

const SIDEBAR_COLLAPSED_KEY = "one-wso2.sidebar.collapsed";

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
  } catch {
    /* ignore — a blocked localStorage just means the choice isn't remembered */
  }
}

// The persistent shell — top bar and rail stay put; the canvas swaps with the
// active perspective (Outlet). Waffle and Ask Novera are overlays.
//
// NOTE: the content scroller deliberately sets no background. It used to paint
// `background.default`, which covered the <body> entirely and made any
// canvas-level treatment (Oxygen's radial wash, or ours) invisible in the
// content area. csm-portal sets no background on its layout boxes either —
// that's precisely why its wash reaches the content.
export default function AppLayout(): JSX.Element {
  const [waffleOpen, setWaffleOpen] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const location = useLocation();
  const mainRef = useRef<HTMLDivElement>(null);

  // Sign out after 20 min idle (< 30 min) and purge the cache (ONEWSO2-R1).
  useIdleLogout(20);

  const { state: shellState, actions: shellActions } = useAppShell({
    initialCollapsed: readCollapsed(),
  });

  useEffect(() => {
    writeCollapsed(shellState.sidebarCollapsed);
  }, [shellState.sidebarCollapsed]);

  // A new page should start at the top rather than inheriting the previous
  // page's scroll offset — the shell scrolls, not the window.
  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0;
  }, [location.pathname]);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
        overflow: "hidden",
      }}
    >
      <AppShellLayout
        header={
          <TopBar
            collapsed={shellState.sidebarCollapsed}
            onToggleSidebar={shellActions.toggleSidebar}
            onOpenWaffle={() => setWaffleOpen(true)}
            onOpenAsk={() => setAskOpen(true)}
          />
        }
        sidebar={<SideRail collapsed={shellState.sidebarCollapsed} />}
      >
        <Box
          ref={mainRef}
          sx={{
            flex: 1,
            minHeight: 0,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            overflow: "auto",
          }}
        >
          <Box sx={{ flex: 1, p: 3 }}>
            <Outlet />
          </Box>
          <AppFooter />
        </Box>
      </AppShellLayout>

      {waffleOpen && <WaffleOverlay onClose={() => setWaffleOpen(false)} />}
      {askOpen && <AskNoveraPalette onClose={() => setAskOpen(false)} />}
      <AuthDebugPanel />
    </Box>
  );
}
