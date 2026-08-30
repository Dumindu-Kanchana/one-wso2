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

import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@wso2/oxygen-ui";
import { useNotifications } from "@context/notifications/NotificationsContext";
import type { DatabaseLeave } from "../api/leaveTypes";
import { useLeaveUserInfo, useLeaves } from "../api/useLeaveData";
import { useApproveLeave } from "../api/useLeaveMutations";
import { describeError } from "../util/leaveError";
import { SABBATICAL, SnackMessage } from "../util/leaveCopy";
import { HeadCell } from "./SabbaticalTable";
import { isoDay } from "../util/leaveDates";

// Pending sabbatical requests from the lead's own reports, with approve and
// reject — ported from ApproveLeaveTab.tsx and ApproveLeaveTable.tsx.
export default function SabbaticalApproveTab() {
  const [target, setTarget] = useState<{ leave: DatabaseLeave; approving: boolean } | null>(null);

  // ApproveLeaveTab.tsx:41-48.
  const pending = useLeaves({
    subordinatesLeaves: true,
    leaveCategory: ["sabbatical"],
    statuses: ["PENDING"],
    orderBy: "DESC",
  });

  if (pending.isLoading) {
    return <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 1.5 }} />;
  }
  if (pending.isError) {
    return <Alert severity="error">{describeError(pending.error)}</Alert>;
  }

  const rows = pending.data?.leaves ?? [];
  if (rows.length === 0) {
    return (
      <Typography sx={{ fontSize: 13, color: "text.secondary", py: 3 }}>
        No pending sabbatical requests.
      </Typography>
    );
  }

  return (
    <Box>
      <Card variant="outlined" sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <HeadCell>{SABBATICAL.columns.employee}</HeadCell>
              <HeadCell>{SABBATICAL.columns.startDate}</HeadCell>
              <HeadCell>{SABBATICAL.columns.endDate}</HeadCell>
              <HeadCell>{SABBATICAL.columns.dayCount}</HeadCell>
              <HeadCell align="right">{SABBATICAL.columns.approval}</HeadCell>
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
                <TableCell align="right">
                  <Stack direction="row" spacing={0.75} justifyContent="flex-end">
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => setTarget({ leave: lv, approving: true })}
                    >
                      {SABBATICAL.approve.approve}
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      onClick={() => setTarget({ leave: lv, approving: false })}
                    >
                      {SABBATICAL.approve.reject}
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {target && <DecisionDialog target={target} onClose={() => setTarget(null)} />}
    </Box>
  );
}

function DecisionDialog({
  target,
  onClose,
}: {
  target: { leave: DatabaseLeave; approving: boolean };
  onClose: () => void;
}) {
  const approve = useApproveLeave();
  const userInfo = useLeaveUserInfo();
  const { showSuccess, showError } = useNotifications();
  const { leave, approving } = target;

  const subordinateCount = userInfo.data?.subordinateCount ?? 0;

  // ApproveLeaveTable.tsx:51-65 — how much of this lead's team is already
  // approved to be away over the same dates. Approve only; the reject message
  // never carries it.
  const overlapping = useLeaves(
    {
      startDate: leave.startDate,
      endDate: leave.endDate,
      approverEmail: userInfo.data?.workEmail ?? undefined,
      leaveCategory: ["sabbatical"],
      statuses: ["APPROVED"],
    },
    approving && subordinateCount > 0,
  );

  const teamShare =
    approving && subordinateCount > 0 && overlapping.data
      ? SABBATICAL.approve.teamShare(
          Math.round((overlapping.data.leaves.length / subordinateCount) * 100),
        )
      : "";

  // The source fetches this BEFORE opening the dialog, so the sentence is
  // always on screen when the lead decides. We open straight away and hold the
  // confirm button until it lands, which keeps that guarantee without showing
  // an unexplained pause after the click.
  //
  // `userInfo.isLoading` counts as waiting: until it resolves `subordinateCount`
  // reads 0, which would both skip the query and clear this guard — the pending
  // table does not wait for /user-info, so a row can be clicked before it lands.
  // An *error* deliberately does not wait; the source swallows a failed fetch
  // (ApproveLeaveTable.tsx:65) and approves with no sentence at all.
  const waitingForShare =
    approving && (userInfo.isLoading || (subordinateCount > 0 && overlapping.isLoading));

  const dateRange = `${isoDay(leave.startDate)} – ${isoDay(leave.endDate)}`;

  const handleConfirm = () => {
    approve.mutate(
      { id: leave.id, action: approving ? "approve" : "reject" },
      {
        onSuccess: () => {
          showSuccess(
            approving
              ? SnackMessage.success.approveLeaveMessage
              : SnackMessage.success.rejectLeaveMessage,
          );
          onClose();
        },
        onError: (err) => showError(describeError(err)),
      },
    );
  };

  return (
    <Dialog open onClose={approve.isPending ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontSize: 17, fontWeight: 700 }}>
        {approving
          ? SABBATICAL.approve.confirmApproveTitle
          : SABBATICAL.approve.confirmRejectTitle}
      </DialogTitle>
      <DialogContent dividers>
        <Typography sx={{ fontSize: 13.5 }}>
          {approving
            ? SABBATICAL.approve.confirmApproveBody(leave.email, dateRange, teamShare)
            : SABBATICAL.approve.confirmRejectBody(leave.email, dateRange)}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button size="small" onClick={onClose} disabled={approve.isPending}>
          {SABBATICAL.approve.confirmCancel}
        </Button>
        <Button
          size="small"
          variant="contained"
          color={approving ? "primary" : "error"}
          onClick={handleConfirm}
          disabled={approve.isPending || waitingForShare}
        >
          {approve.isPending
            ? "Working…"
            : approving
              ? SABBATICAL.approve.confirmApproveOk
              : SABBATICAL.approve.confirmRejectOk}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
