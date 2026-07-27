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

// The "Novera — insights" card that opens each perspective. Orange-tinted
// gradient overlay to signal it's AI-authored context, not a stat.
export default function InsightCard({
  text,
  source,
}: {
  text: string;
  source: string;
}) {
  return (
    <Box
      sx={{
        position: "relative",
        bgcolor: "background.paper",
        border: 1,
        borderColor: "divider",
        borderRadius: 1.5,
        p: "16px 18px",
        mb: 2,
        overflow: "hidden",
        // CSS var, not t.palette.primary.light — same reason as
        // ProfileHero: under CssVarsProvider a callback resolves the
        // palette accessor to the light scheme's frozen literal and
        // washes the card out in dark mode. See themeConfig.ts.
        "&::before": {
          content: '""',
          position: "absolute",
          inset: 0,
          background: "radial-gradient(560px 110px at 0 0, var(--oxygen-palette-primary-light), transparent 60%)",
          pointerEvents: "none",
        },
      }}
    >
      <Typography
        sx={{
          position: "relative",
          fontSize: 11,
          fontWeight: 700,
          color: "primary.main",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          display: "flex",
          alignItems: "center",
          gap: 0.75,
          mb: 0.875,
        }}
      >
        ✦ Novera — insights
      </Typography>
      <Typography
        component="p"
        sx={{
          position: "relative",
          fontSize: 14,
          lineHeight: 1.55,
          color: "text.secondary",
          maxWidth: 780,
        }}
      >
        {text}
      </Typography>
      <Typography
        sx={{
          position: "relative",
          mt: 1,
          fontSize: 12,
          color: "text.disabled",
        }}
      >
        {source}
      </Typography>
    </Box>
  );
}
