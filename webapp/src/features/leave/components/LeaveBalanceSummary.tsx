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
  LEAVE_TYPE_ICON,
  LEAVE_TYPE_POLICY_KEY,
  LEAVE_TYPE_TOOLTIP,
  type LeaveEntitlement,
  type LeaveType,
} from "../api/leaveTypes";
import { entitlementPeriodLabel } from "../util/leaveDates";
import { leaveTypeLabel } from "../util/leaveCopy";

// Entitled/consumed/remaining per quota-tracked leave type — ported from
// leave-app's LeaveBalanceSummary.tsx. The caller is responsible for only
// rendering this for locations with quota-tracked types (France/Spain
// today — see quotaTrackedTypesForLocation) and passing that location's
// type list in as `types`; this component doesn't re-decide any of that.
export default function LeaveBalanceSummary({
  types,
  entitlement,
  rttEntitlement,
  location,
  isLoading,
}: {
  types: LeaveType[];
  entitlement: LeaveEntitlement | undefined;
  /**
   * France's separate calendar-year record. The RTT row reads from this one —
   * `LeaveBalanceSummary.tsx:145`. Undefined elsewhere, and then RTT falls back
   * to the default record rather than rendering nothing.
   */
  rttEntitlement?: LeaveEntitlement | undefined;
  location: string | null | undefined;
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
        // RTT comes from the calendar-year record where we have one; everything
        // else from the default. `LeaveBalanceSummary.tsx:143-147`.
        const record = t === "rtt" && rttEntitlement ? rttEntitlement : entitlement;
        const entitled = record.leavePolicy[policyKey] ?? null;
        const consumed = record.policyAdjustedLeave[policyKey] ?? 0;
        // RTT and sick are reported over the calendar year regardless of the
        // entitlement's own window. `LeaveBalanceSummary.tsx:148-152`.
        const periodLabel = entitlementPeriodLabel(
          t === "rtt" || t === "sick",
          entitlement.periodStart,
          entitlement.periodEnd,
        );
        const isUnlimited = entitled === null;
        const remaining = isUnlimited ? null : Math.max(entitled - consumed, 0);
        const progress = !isUnlimited && entitled > 0 ? Math.min((consumed / entitled) * 100, 100) : 0;
        const isOverLimit = !isUnlimited && entitled > 0 && consumed > entitled;
        const tooltip = LEAVE_TYPE_TOOLTIP[t];
        const TypeIcon = LEAVE_TYPE_ICON[t];

        return (
          <Box key={t} sx={{ border: 1, borderColor: "divider", borderRadius: 1.5, p: 1.5 }}>
            <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 0.75 }}>
              <TypeIcon size={13} style={{ flexShrink: 0 }} />
              <Typography sx={{ fontSize: 12.5, fontWeight: 600 }}>
                {leaveTypeLabel(location, t)}
              </Typography>
              {tooltip && (
                <Tooltip title={tooltip}>
                  <Box component="span" sx={{ fontSize: 11, color: "text.disabled", cursor: "help" }}>
                    ⓘ
                  </Box>
                </Tooltip>
              )}
              {periodLabel && (
                <Typography
                  sx={{ ml: "auto", fontSize: 10.5, color: "text.disabled", whiteSpace: "nowrap" }}
                >
                  {periodLabel}
                </Typography>
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
