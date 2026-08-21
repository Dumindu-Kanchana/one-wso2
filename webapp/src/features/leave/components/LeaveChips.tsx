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

import { Chip } from "@wso2/oxygen-ui";
import type { LucideIcon } from "@wso2/oxygen-ui-icons-react";
import {
  LEAVE_TYPE_ICON,
  LEAVE_TYPE_ICON_FALLBACK,
  LEAVE_TYPE_LABEL,
  type LeaveStatus,
  type LeaveType,
} from "../api/leaveTypes";

const STATUS_COLOR: Record<LeaveStatus, "success" | "error" | "warning" | "default"> = {
  APPROVED: "success",
  REJECTED: "error",
  PENDING: "warning",
  CANCELLED: "default",
};

const STATUS_LABEL: Record<LeaveStatus, string> = {
  APPROVED: "Approved",
  REJECTED: "Rejected",
  PENDING: "Pending",
  CANCELLED: "Cancelled",
};

export function StatusChip({ status }: { status: LeaveStatus | null }) {
  const s = status ?? "PENDING";
  return (
    <Chip
      label={STATUS_LABEL[s]}
      color={STATUS_COLOR[s]}
      size="small"
      variant="outlined"
      sx={{ height: 20, fontSize: 10.5, fontWeight: 600, borderWidth: 1.5 }}
    />
  );
}

// Best-effort mapping of a raw leaveType string to a known type; unknown
// values fall through to the raw label.
//
// `hasOwn` rather than `in`: `leaveType` comes from the backend, and `in` also
// matches inherited names such as "toString" — which would resolve `Icon` to a
// function and crash the render rather than fall through to the fallback.
function normalizeType(raw: string | null): { label: string; Icon: LucideIcon } {
  const t = raw as LeaveType | null;
  if (t && Object.hasOwn(LEAVE_TYPE_LABEL, t)) {
    return { label: LEAVE_TYPE_LABEL[t], Icon: LEAVE_TYPE_ICON[t] };
  }
  return { label: raw ?? "—", Icon: LEAVE_TYPE_ICON_FALLBACK };
}

export function LeaveTypeChip({ leaveType }: { leaveType: string | null }) {
  const { label, Icon } = normalizeType(leaveType);
  return (
    <Chip
      // Icon goes in the Chip's own icon slot, not concatenated into the label,
      // so it inherits chip sizing/colour and stays out of the accessible name.
      icon={<Icon size={14} />}
      label={label}
      size="small"
      color="primary"
      variant="outlined"
      sx={{ height: 20, fontSize: 10.5, fontWeight: 600 }}
    />
  );
}
