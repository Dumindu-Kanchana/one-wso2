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


import { Box, Stack, Typography } from "@wso2/oxygen-ui";
import type { JSX, ReactNode } from "react";

// A titled, bordered block. PAR's screens are a stack of these, and they need
// to look alike.
//
// Written here rather than imported from another feature's UI file: the shared
// `Panel` lives inside a Marketing Ops screen, and reaching across for four
// lines of Box would couple two unrelated features together.
export default function ParSection({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  /** Right-aligned control on the header row — a button, a chip, a status. */
  action?: ReactNode;
  children: ReactNode;
}): JSX.Element {
  return (
    <Box
      sx={{
        border: 1,
        borderColor: "divider",
        borderRadius: 1.5,
        p: 2.25,
        mb: 2.25,
        bgcolor: "background.paper",
      }}
    >
      <Stack
        direction="row"
        sx={{ alignItems: "flex-start", justifyContent: "space-between", gap: 2, mb: 1.5 }}
      >
        <Box sx={{ minWidth: 0 }}>
          {/* h2 under the shell's h1, so heading order holds for anyone
              navigating by headings. */}
          <Typography component="h2" variant="subtitle1" sx={{ fontWeight: 700 }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, maxWidth: "72ch" }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        {action && <Box sx={{ flexShrink: 0 }}>{action}</Box>}
      </Stack>
      {children}
    </Box>
  );
}
