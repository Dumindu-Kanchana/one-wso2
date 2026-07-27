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
import type { ReactNode } from "react";

// 4-column responsive read-only field grid used by General + Personal
// info blocks — matches the people-app profile layout.
export interface FieldDef {
  label: string;
  value: ReactNode;
  chip?: { label: string; color: "primary" | "success" };
  span?: 1 | 2;
}

export default function FieldGrid({ fields }: { fields: FieldDef[] }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" },
        gap: "14px 22px",
      }}
    >
      {fields.map((f) => (
        <Box
          key={f.label}
          sx={{ minWidth: 0, gridColumn: f.span === 2 ? "span 2" : undefined }}
        >
          <Typography
            sx={{
              fontSize: 10.5,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "text.disabled",
              fontWeight: 600,
              mb: 0.375,
            }}
          >
            {f.label}
          </Typography>
          {f.chip ? (
            <Chip
              label={f.chip.label}
              color={f.chip.color}
              size="small"
              variant="outlined"
              sx={{
                height: 26,
                fontSize: 12,
                fontWeight: 600,
                borderWidth: 1.5,
                px: 0.5,
                // MUI collapses the "px" on Chip through the label span, so
                // widen it explicitly for the roomier pill look.
                "& .MuiChip-label": { px: 1.25 },
              }}
            />
          ) : (
            <Typography sx={{ fontSize: 13.5, fontWeight: 500, lineHeight: 1.35, wordWrap: "break-word" }}>
              {f.value}
            </Typography>
          )}
        </Box>
      ))}
    </Box>
  );
}
