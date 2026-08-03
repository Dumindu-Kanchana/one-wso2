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
import { describeError } from "../util/leaveError";
import { useNotifications } from "@context/notifications/NotificationsContext";
import LeaveShell from "../components/LeaveShell";
import { StatusChip } from "../components/LeaveChips";
import { LEAVE_PRIVILEGE, type DatabaseLeave } from "../api/leaveTypes";
import { useLeaveUserInfo, useLeaves } from "../api/useLeaveData";
import { useApproveLeave } from "../api/useLeaveMutations";
import { formatNice } from "../util/leaveDates";

export default function LeaveApprovePage() {
  return (
    <LeaveShell
      title="Approve sabbatical leave"
      subtitle="Review your team's pending sabbatical requests and your past decisions. General leave doesn't need approval."
    >
      <ApproveBody />
    </LeaveShell>
  );
}

function ApproveBody() {
  const userInfo = useLeaveUserInfo();
  const [action, setAction] = useState<{ leave: DatabaseLeave; kind: "approve" | "reject" } | null>(null);

  const isLead =
    userInfo.data?.isLead === true ||
    (userInfo.data?.privileges ?? []).includes(LEAVE_PRIVILEGE.LEAD) ||
    (userInfo.data?.subordinateCount ?? 0) > 0;

  const pending = useLeaves(
    { subordinatesLeaves: true, leaveCategory: ["sabbatical"], statuses: ["PENDING"], orderBy: "DESC" },
    Boolean(userInfo.data) && isLead,
  );
  const history = useLeaves(
    { subordinatesLeaves: true, leaveCategory: ["sabbatical"], statuses: ["APPROVED", "REJECTED"], orderBy: "DESC" },
    Boolean(userInfo.data) && isLead,
  );

  if (userInfo.isLoading) {
    return <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 1.5 }} />;
  }
  if (userInfo.isError) {
    return <Alert severity="error">Couldn't load your leave profile. {describeError(userInfo.error)}</Alert>;
  }
  if (!isLead) {
    return (
      <Alert severity="info">
        You don't have anyone reporting to you, so there's nothing to approve here.
      </Alert>
    );
  }

  const pendingRows = pending.data?.leaves ?? [];
  const historyRows = history.data?.leaves ?? [];

  return (
    <Stack spacing={2.5}>
      <Box>
        <SectionTitle>Pending requests</SectionTitle>
        {pending.isLoading ? (
          <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 1.5 }} />
        ) : pending.isError ? (
          <Alert severity="error">{describeError(pending.error)}</Alert>
        ) : pendingRows.length === 0 ? (
          <EmptyRow>No pending sabbatical requests.</EmptyRow>
        ) : (
          <LeaveTable
            rows={pendingRows}
            actions={(lv) => (
              <Stack direction="row" spacing={0.75} justifyContent="flex-end">
                <Button size="small" variant="contained" onClick={() => setAction({ leave: lv, kind: "approve" })}>
                  Approve
                </Button>
                <Button size="small" variant="outlined" color="error" onClick={() => setAction({ leave: lv, kind: "reject" })}>
                  Reject
                </Button>
              </Stack>
            )}
          />
        )}
      </Box>

      <Box>
        <SectionTitle>Past decisions</SectionTitle>
        {history.isLoading ? (
          <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 1.5 }} />
        ) : history.isError ? (
          <Alert severity="error">{describeError(history.error)}</Alert>
        ) : historyRows.length === 0 ? (
          <EmptyRow>No past decisions yet.</EmptyRow>
        ) : (
          <LeaveTable rows={historyRows} status />
        )}
      </Box>

      <ActionDialog action={action} onClose={() => setAction(null)} />
    </Stack>
  );
}

function LeaveTable({
  rows,
  actions,
  status,
}: {
  rows: DatabaseLeave[];
  actions?: (lv: DatabaseLeave) => React.ReactNode;
  status?: boolean;
}) {
  return (
    <Card variant="outlined" sx={{ overflowX: "auto" }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <HeadCell>Employee</HeadCell>
            <HeadCell>Start</HeadCell>
            <HeadCell>End</HeadCell>
            <HeadCell align="right">Days</HeadCell>
            {status && <HeadCell>Status</HeadCell>}
            {actions && <HeadCell align="right">Action</HeadCell>}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((lv) => (
            <TableRow key={lv.id} hover>
              <TableCell sx={{ fontSize: 12.5 }}>{lv.email}</TableCell>
              <TableCell sx={{ fontSize: 12.5, fontVariantNumeric: "tabular-nums" }}>{formatNice(lv.startDate)}</TableCell>
              <TableCell sx={{ fontSize: 12.5, fontVariantNumeric: "tabular-nums" }}>{formatNice(lv.endDate)}</TableCell>
              <TableCell align="right" sx={{ fontSize: 12.5, fontVariantNumeric: "tabular-nums" }}>{lv.numberOfDays ?? "—"}</TableCell>
              {status && (
                <TableCell>
                  <StatusChip status={lv.status} />
                </TableCell>
              )}
              {actions && <TableCell align="right">{actions(lv)}</TableCell>}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function ActionDialog({
  action,
  onClose,
}: {
  action: { leave: DatabaseLeave; kind: "approve" | "reject" } | null;
  onClose: () => void;
}) {
  const approve = useApproveLeave();
  const { showSuccess, showError } = useNotifications();

  const handleConfirm = () => {
    if (!action) return;
    approve.mutate(
      { id: action.leave.id, action: action.kind },
      {
        onSuccess: () => {
          showSuccess(action.kind === "approve" ? "Sabbatical approved" : "Sabbatical rejected");
          onClose();
        },
        onError: (err) => showError(describeError(err)),
      },
    );
  };

  const isApprove = action?.kind === "approve";
  return (
    <Dialog open={!!action} onClose={approve.isPending ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontSize: 17, fontWeight: 700 }}>
        {isApprove ? "Approve sabbatical?" : "Reject sabbatical?"}
      </DialogTitle>
      <DialogContent dividers>
        <Typography sx={{ fontSize: 13.5 }}>
          {isApprove ? "Approve" : "Reject"} <b>{action?.leave.email}</b>'s sabbatical from{" "}
          <b>{formatNice(action?.leave.startDate)}</b> to <b>{formatNice(action?.leave.endDate)}</b>?
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button size="small" onClick={onClose} disabled={approve.isPending}>
          Cancel
        </Button>
        <Button
          size="small"
          variant="contained"
          color={isApprove ? "primary" : "error"}
          onClick={handleConfirm}
          disabled={approve.isPending}
        >
          {approve.isPending ? "Working…" : isApprove ? "Approve" : "Reject"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Typography sx={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "text.secondary", fontWeight: 700, mb: 1 }}>
      {children}
    </Typography>
  );
}

function HeadCell({ children, align }: { children: React.ReactNode; align?: "right" }) {
  return (
    <TableCell align={align} sx={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "text.disabled" }}>
      {children}
    </TableCell>
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return (
    <Typography sx={{ fontSize: 12.5, color: "text.secondary", py: 1.5 }}>{children}</Typography>
  );
}
