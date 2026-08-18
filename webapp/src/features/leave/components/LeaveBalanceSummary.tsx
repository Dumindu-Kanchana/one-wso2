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

import { Box, LinearProgress, Skeleton, Stack, Tooltip, Typography } from "@wso2/oxygen-ui";
import {
  LEAVE_TYPE_EMOJI,
  LEAVE_TYPE_LABEL,
  LEAVE_TYPE_POLICY_KEY,
  LEAVE_TYPE_TOOLTIP,
  type LeaveEntitlement,
  type LeaveType,
} from "../api/leaveTypes";

// Entitled/consumed/remaining per quota-tracked leave type — ported from
// leave-app's LeaveBalanceSummary.tsx. The caller is responsible for only
// rendering this for locations with quota-tracked types (France/Spain
// today — see quotaTrackedTypesForLocation) and passing that location's
// type list in as `types`; this component doesn't re-decide any of that.
export default function LeaveBalanceSummary({
  types,
  entitlement,
  isLoading,
}: {
  types: LeaveType[];
  entitlement: LeaveEntitlement | undefined;
  isLoading: boolean;
}) {
  if (types.length === 0) return null;

  if (isLoading) {
    return (
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: `repeat(${types.length}, 1fr)` }, gap: 1.5 }}>
        {types.map((t) => (
          <Skeleton key={t} variant="rectangular" height={64} sx={{ borderRadius: 1.5 }} />
        ))}
      </Box>
    );
  }
  if (!entitlement) return null;

  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: `repeat(${types.length}, 1fr)` }, gap: 1.5 }}>
      {types.map((t) => {
        const policyKey = LEAVE_TYPE_POLICY_KEY[t];
        if (!policyKey) return null;
        const entitled = entitlement.leavePolicy[policyKey] ?? null;
        const consumed = entitlement.policyAdjustedLeave[policyKey] ?? 0;
        const isUnlimited = entitled === null;
        const remaining = isUnlimited ? null : Math.max(entitled - consumed, 0);
        const progress = !isUnlimited && entitled > 0 ? Math.min((consumed / entitled) * 100, 100) : 0;
        const isOverLimit = !isUnlimited && entitled > 0 && consumed > entitled;
        const tooltip = LEAVE_TYPE_TOOLTIP[t];

        return (
          <Box key={t} sx={{ border: 1, borderColor: "divider", borderRadius: 1.5, p: 1.5 }}>
            <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 0.75 }}>
              <Typography sx={{ fontSize: 12.5, fontWeight: 600 }}>
                {LEAVE_TYPE_EMOJI[t]} {LEAVE_TYPE_LABEL[t]}
              </Typography>
              {tooltip && (
                <Tooltip title={tooltip}>
                  <Box component="span" sx={{ fontSize: 11, color: "text.disabled", cursor: "help" }}>
                    ⓘ
                  </Box>
                </Tooltip>
              )}
            </Stack>
            {!isUnlimited && (
              <LinearProgress
                variant="determinate"
                value={progress}
                color={isOverLimit ? "error" : progress > 80 ? "warning" : "primary"}
                sx={{ height: 6, borderRadius: 3, mb: 0.75 }}
              />
            )}
            <Typography
              sx={{ fontSize: 11.5, color: isOverLimit ? "error.main" : "text.secondary", fontWeight: 500 }}
            >
              {isUnlimited
                ? `${consumed} used · Unlimited`
                : `${consumed} / ${entitled} used${remaining! > 0 ? ` · ${remaining} left` : ""}`}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}
