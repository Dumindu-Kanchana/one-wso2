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

import { Box, Chip, Typography } from "@wso2/oxygen-ui";
import AppMenuBoard from "@components/app-menu/AppMenuBoard";
import { WORKSPACE_APPS } from "@constants/workspaceApps";

// Workspace perspective overview — office-amenity apps that aren't HR-team
// tools (split out of People Ops, starting with the cafeteria Menu app).
// More apps land here over time.
export default function WorkspacePage() {
  return (
    <Box>
      <Chip
        label="✦ Workspace perspective"
        color="primary"
        size="small"
        sx={{ mb: 0.5, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}
      />
      <Typography sx={{ fontSize: 23, fontWeight: 700, letterSpacing: "-0.02em", mb: 0.5 }}>
        Workspace
      </Typography>
      <Typography sx={{ fontSize: 13, color: "text.secondary", mb: 2.25, maxWidth: "68ch" }}>
        Everyday office apps in one place — jump to any app's section from the left rail.
      </Typography>

      <AppMenuBoard apps={WORKSPACE_APPS} />
    </Box>
  );
}
