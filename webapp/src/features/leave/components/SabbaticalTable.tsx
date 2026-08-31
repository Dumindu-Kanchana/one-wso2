/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import {
  Alert,
  Card,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@wso2/oxygen-ui";
import type { DatabaseLeave, LeaveStatus } from "../api/leaveTypes";
import { StatusChip } from "./LeaveChips";
import { SABBATICAL } from "../util/leaveCopy";
import { describeError } from "../util/leaveError";
import { isoDay } from "../util/leaveDates";

export function HeadCell({
  children,
  align,
}: {
  children: React.ReactNode;
  align?: "right";
}) {
  return (
    <TableCell
      align={align}
      sx={{
        fontSize: 10.5,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        color: "text.disabled",
      }}
    >
      {children}
    </TableCell>
  );
}

/**
 * Employee / Start Date / End Date / Day Count / Lead / Status — the columns of
 * ApprovalHistoryTable.tsx:25-127, shared by the lead's Approval history and the
 * sabbatical Report exactly as the source shares that component between
 * ApproveHistoryTab and AdminSabbaticalTab.
 */
export default function SabbaticalHistoryTable({
  rows,
  isLoading,
  error,
  emptyMessage,
}: {
  rows: DatabaseLeave[];
  isLoading: boolean;
  error: Error | null;
  emptyMessage: string;
}) {
  if (isLoading) {
    return <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 1.5 }} />;
  }
  if (error) {
    return <Alert severity="error">{describeError(error)}</Alert>;
  }
  if (rows.length === 0) {
    return (
      <Typography sx={{ fontSize: 13, color: "text.secondary", py: 3 }}>{emptyMessage}</Typography>
    );
  }

  return (
    <Card variant="outlined" sx={{ overflowX: "auto" }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <HeadCell>{SABBATICAL.columns.employee}</HeadCell>
            <HeadCell>{SABBATICAL.columns.startDate}</HeadCell>
            <HeadCell>{SABBATICAL.columns.endDate}</HeadCell>
            <HeadCell>{SABBATICAL.columns.dayCount}</HeadCell>
            <HeadCell>{SABBATICAL.columns.lead}</HeadCell>
            <HeadCell>{SABBATICAL.columns.status}</HeadCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((lv) => (
            <TableRow key={lv.id} hover>
              <TableCell sx={{ fontSize: 12.5 }}>{lv.email}</TableCell>
              <TableCell sx={{ fontSize: 12.5, fontVariantNumeric: "tabular-nums" }}>
                {isoDay(lv.startDate)}
              </TableCell>
              <TableCell sx={{ fontSize: 12.5, fontVariantNumeric: "tabular-nums" }}>
                {isoDay(lv.endDate)}
              </TableCell>
              <TableCell sx={{ fontSize: 12.5, fontVariantNumeric: "tabular-nums" }}>
                {lv.numberOfDays ?? "—"}
              </TableCell>
              {/* :62 — a request nobody has been assigned to reads "N/A". */}
              <TableCell sx={{ fontSize: 12.5 }}>
                {lv.approverEmail || SABBATICAL.columns.noLead}
              </TableCell>
              <TableCell>
                {/* :74 — a row with no status reads "Unknown" here, not Pending. */}
                <StatusChip status={(lv.status as LeaveStatus | null) ?? null} unknownWhenMissing />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
