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

import { useState } from "react";
import { Outlet } from "react-router";
import { Box } from "@wso2/oxygen-ui";
import TopBar from "@components/top-bar/TopBar";
import SideRail from "@components/side-rail/SideRail";
import WaffleOverlay from "@components/waffle/WaffleOverlay";
import AskNoveraPalette from "@components/ask-novera/AskNoveraPalette";
import AppFooter from "@components/footer/AppFooter";
import AuthDebugPanel from "@features/debug/AuthDebugPanel";

// The persistent shell — the top bar and rail stay put; the canvas swaps
// with the active perspective (Outlet). Waffle and Ask Novera are overlays
// that mount into the same layout root.
export default function AppLayout() {
  const [waffleOpen, setWaffleOpen] = useState(false);
  const [askOpen, setAskOpen] = useState(false);

  return (
    <Box sx={{ display: "grid", gridTemplateRows: "56px 1fr", height: "100vh" }}>
      <TopBar
        onOpenWaffle={() => setWaffleOpen(true)}
        onOpenAsk={() => setAskOpen(true)}
      />
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "260px 1fr",
          minHeight: 0,
        }}
      >
        <SideRail />
        <Box sx={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
          <Box
            component="main"
            sx={{
              overflowY: "auto",
              px: 3,
              py: 3,
              flex: 1,
              backgroundColor: "background.default",
            }}
          >
            <Outlet />
          </Box>
          <AppFooter />
        </Box>
      </Box>
      {waffleOpen && <WaffleOverlay onClose={() => setWaffleOpen(false)} />}
      {askOpen && <AskNoveraPalette onClose={() => setAskOpen(false)} />}
      <AuthDebugPanel />
    </Box>
  );
}
