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
import { Box, Typography } from "@wso2/oxygen-ui";
import { InfoIcon } from "@wso2/oxygen-ui-icons-react";
import { describeWindow, type TimeWindow } from "../util/menuWindows";

// The "available between X and Y" line, shared by the feedback dialog and the
// dinner section. Takes the window rather than a formatted string so the notice
// cannot drift from the rule that is actually being applied — the standalone app
// hard-coded this sentence separately from the check.
export default function WindowNotice({
  window: timeWindow,
  children,
}: {
  window: TimeWindow;
  children?: (range: string) => string;
}) {
  const range = describeWindow(timeWindow);
  return (
    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 0.75, py: 0.5 }}>
      <Box component="span" sx={{ color: "text.secondary", mt: "2px", flexShrink: 0 }}>
        <InfoIcon size={16} />
      </Box>
      <Typography variant="body2" color="text.secondary">
        {children ? children(range) : `Available ${range}.`}
      </Typography>
    </Box>
  );
}
