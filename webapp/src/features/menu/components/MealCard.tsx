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
import { Box, Card, Stack, Typography } from "@wso2/oxygen-ui";
import type { LucideIcon } from "@wso2/oxygen-ui-icons-react";
import type { Meal } from "../api/menuTypes";

// One meal slot. Presentational: what varies between the lunch card and the
// snack card is entirely what gets passed in, including whether there is an
// action. The standalone app branched on the meal type inside the card and
// rendered a permanently invisible feedback button on the other four.
export default function MealCard({
  label,
  icon: Icon,
  timeRange,
  meal,
  action,
}: {
  label: string;
  icon: LucideIcon;
  timeRange: string;
  meal: Meal;
  action?: ReactNode;
}) {
  return (
    <Card variant="outlined" sx={{ p: 1.75, display: "flex", flexDirection: "column", gap: 0.75 }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Box component="span" sx={{ color: "text.secondary", display: "inline-flex" }}>
          <Icon size={20} />
        </Box>
        <Typography sx={{ fontSize: 13.5, fontWeight: 600, flex: 1, minWidth: 0 }}>{label}</Typography>
        {/* A serving-time label, not a rule. Only the two windows gate anything. */}
        <Typography sx={{ fontSize: 11, color: "text.disabled", fontVariantNumeric: "tabular-nums" }}>
          {timeRange}
        </Typography>
      </Stack>

      {meal.description && (
        <Typography sx={{ fontSize: 12.5, color: "text.secondary", lineHeight: 1.45 }}>
          {meal.description}
        </Typography>
      )}
      <Typography sx={{ fontSize: 12, color: "text.disabled" }}>Supplier: {meal.title}</Typography>

      {action && <Box sx={{ mt: 0.5 }}>{action}</Box>}
    </Card>
  );
}
