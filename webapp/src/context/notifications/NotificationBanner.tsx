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

import { Alert, Box } from "@wso2/oxygen-ui";

export type NotificationSeverity = "success" | "error" | "info" | "warning";

// Fixed banner rendered by the NotificationsProvider. Sits below the top
// bar in the right corner — mirrors cs-tools/apps/customer-portal's
// SuccessBanner/ErrorBanner layout (top-right, elevation 6, closable).
export default function NotificationBanner({
  severity,
  message,
  onClose,
}: {
  severity: NotificationSeverity;
  message: string;
  onClose: () => void;
}) {
  return (
    <Box
      sx={{
        position: "fixed",
        // Sit clear of the app's ~56px TopBar without pinning to a hard
        // pixel value — the top bar could grow.
        top: 72,
        right: 24,
        width: { xs: "calc(100vw - 48px)", sm: 420 },
        zIndex: 1500,
      }}
    >
      <Alert severity={severity} onClose={onClose} elevation={6} sx={{ width: "100%" }}>
        {message}
      </Alert>
    </Box>
  );
}
