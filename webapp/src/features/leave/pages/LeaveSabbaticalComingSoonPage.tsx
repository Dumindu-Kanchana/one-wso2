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

import { Box, Button, Card, Chip, Tooltip, Typography } from "@wso2/oxygen-ui";
import { TreePalmIcon } from "@wso2/oxygen-ui-icons-react";
import { isLeaveWebAppConfigured, leaveAppUrls } from "@config/apiConfig";

// Placeholder for the Sabbatical category — sabbatical-leave use cases
// (apply/approve/report) are on hold for this iteration. Doesn't use
// LeaveShell: this page needs no leave-backend connection at all, just a
// link out, so it shouldn't gate on ONE_WSO2_LEAVE_BACKEND_URL like the
// four native screens do.
export default function LeaveSabbaticalComingSoonPage() {
  return (
    <Box>
      <Chip
        icon={<TreePalmIcon size={14} />}
        label="Leave"
        color="primary"
        size="small"
        variant="outlined"
        sx={{ mb: 0.5 }}
      />
      <Typography variant="h5" sx={{ mb: 0.5 }}>
        Sabbatical
      </Typography>
      <Typography sx={{ fontSize: 13, color: "text.secondary", mb: 2.25, maxWidth: "70ch" }}>
        Apply, approve, and report on Sabbatical leave in the Leave app.
      </Typography>

      <Card variant="outlined" sx={{ p: 3, maxWidth: 480 }}>
        <Typography sx={{ fontSize: 15, fontWeight: 700, mb: 0.75 }}>Coming soon</Typography>
        <Typography sx={{ fontSize: 13, color: "text.secondary", mb: 2 }}>
          Head to the Leave app to submit or manage a sabbatical request.
        </Typography>
        {isLeaveWebAppConfigured() ? (
          <Box sx={{ display: "flex", gap: 1.5 }}>
            <Button
              component="a"
              href={leaveAppUrls.applySabbatical}
              target="_blank"
              rel="noopener noreferrer"
              variant="outlined"
              size="small"
              sx={{ fontWeight: 600 }}
            >
              Apply in Leave app ↗
            </Button>
            <Button
              component="a"
              href={leaveAppUrls.approveSabbatical}
              target="_blank"
              rel="noopener noreferrer"
              variant="outlined"
              size="small"
              sx={{ fontWeight: 600 }}
            >
              Approve in Leave app ↗
            </Button>
          </Box>
        ) : (
          <Tooltip title="Set ONE_WSO2_LEAVE_WEB_APP_URL to enable this." placement="top">
            <Typography sx={{ fontSize: 12.5, color: "text.disabled", fontStyle: "italic", cursor: "help" }}>
              Leave app link not configured.
            </Typography>
          </Tooltip>
        )}
      </Card>
    </Box>
  );
}