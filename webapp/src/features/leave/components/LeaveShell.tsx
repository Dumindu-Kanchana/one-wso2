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
import { Alert, Box, Chip, Typography } from "@wso2/oxygen-ui";
import { isLeaveBackendConfigured } from "@config/apiConfig";

// Shared page frame for the four Leave screens: the "Leave" eyebrow, a
// title + subtitle, and a single place that renders the "backend not
// configured" state so every screen behaves the same when
// ONE_WSO2_LEAVE_BACKEND_URL isn't set.
export default function LeaveShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const configured = isLeaveBackendConfigured();
  return (
    <Box>
      <Chip
        label="🌴 Leave"
        color="primary"
        size="small"
        sx={{ mb: 0.5, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}
      />
      <Typography sx={{ fontSize: 23, fontWeight: 700, letterSpacing: "-0.02em", mb: 0.5 }}>
        {title}
      </Typography>
      {subtitle && (
        <Typography sx={{ fontSize: 13, color: "text.secondary", mb: 2.25, maxWidth: "70ch" }}>
          {subtitle}
        </Typography>
      )}

      {configured ? (
        children
      ) : (
        <Alert severity="info" sx={{ mt: 1.5 }}>
          Leave isn't connected yet. Set <code>ONE_WSO2_LEAVE_BACKEND_URL</code> in{" "}
          <code>public/config.js</code> (the leave-app backend URL) and reload.
        </Alert>
      )}
    </Box>
  );
}
