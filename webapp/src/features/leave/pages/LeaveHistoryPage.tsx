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

import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { describeError } from "../util/leaveError";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { StatusChip } from "../components/LeaveChips";
import {
  GENERAL_LEAVE_TYPES,
  LEAVE_TYPE_ICON,
  LEAVE_TYPE_ICON_FALLBACK,
  LEAVE_TYPE_LABEL,
  type DatabaseLeave,
  type LeaveType,
} from "../api/leaveTypes";
import { useLeaveUserInfo, useLeaves } from "../api/useLeaveData";
import { useCancelLeave } from "../api/useLeaveMutations";
import {
  dayNumber,
  daysAgo,
  endOfYearIso,
  formatNice,
  monthAbbr,
  parseIso,
  startOfYearIso,
} from "../util/leaveDates";
import { CANCEL_CONFIRMATION, SnackMessage, noLeaveHistoryFor } from "../util/leaveCopy";

// A leave whose start is more than this many days in the past can't be
// cancelled from here (matches leave-app's allowedDaysToCancelLeave default).
const CANCEL_WINDOW_DAYS = 30;

// The two tabs of My History (route.ts:112-127). Both are the same screen with
// a different category filter, which is how the source shares one LeaveHistory
// component between GeneralLeaveHistory and SabbaticalLeaveHistory.
export default function GeneralHistoryTab() {
  return <HistoryBody leaveCategory={GENERAL_LEAVE_TYPES} />;
}

export function SabbaticalHistoryTab() {
  return <HistoryBody leaveCategory={["sabbatical"]} />;
}

// The body is shared by the general history page and the Sabbatical tab, the
// way the source shares one LeaveHistory component between GeneralLeaveHistory
// and SabbaticalLeaveHistory — same year selector, same cards, same 30-day
// cancel rule, only the category filter differs.
export function HistoryBody({ leaveCategory }: { leaveCategory: LeaveType[] }) {
  const userInfo = useLeaveUserInfo();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [target, setTarget] = useState<DatabaseLeave | null>(null);

  const workEmail = userInfo.data?.workEmail ?? undefined;
  const leaves = useLeaves(
    {
      email: workEmail,
      startDate: startOfYearIso(year),
      endDate: endOfYearIso(year),
      statuses: ["APPROVED", "PENDING"],
      orderBy: "DESC",
      leaveCategory,
    },
    Boolean(workEmail),
  );

  const years = useMemo(() => {
    const startYear = parseIso(userInfo.data?.employmentStartDate)?.getFullYear() ?? currentYear;
    const out: number[] = [];
    for (let y = currentYear; y >= startYear; y--) out.push(y);
    return out.length ? out : [currentYear];
  }, [userInfo.data?.employmentStartDate, currentYear]);

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
        <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>Year</Typography>
        <FormControl size="small">
          <Select value={year} onChange={(e) => setYear(Number(e.target.value))} sx={{ minWidth: 110 }}>
            {years.map((y) => (
              <MenuItem key={y} value={y}>
                {y}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      {userInfo.isLoading || leaves.isLoading ? (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(3, 1fr)" }, gap: 1.5 }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} variant="rectangular" height={96} sx={{ borderRadius: 1.5 }} />
          ))}
        </Box>
      ) : leaves.isError ? (
        <Alert severity="error">Couldn't load your leave. {describeError(leaves.error)}</Alert>
      ) : (leaves.data?.leaves.length ?? 0) === 0 ? (
        <Typography sx={{ fontSize: 13, color: "text.secondary", py: 3 }}>
          {noLeaveHistoryFor(year)}
        </Typography>
      ) : (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(3, 1fr)" }, gap: 1.5 }}>
          {leaves.data!.leaves.map((lv) => (
            <LeaveCard key={lv.id} leave={lv} onCancel={() => setTarget(lv)} />
          ))}
        </Box>
      )}

      <CancelDialog leave={target} onClose={() => setTarget(null)} />
    </Box>
  );
}

function LeaveCard({ leave, onCancel }: { leave: DatabaseLeave; onCancel: () => void }) {
  const t = (leave.leaveType as LeaveType | null) ?? null;
  const typeLabel = t && t in LEAVE_TYPE_LABEL ? LEAVE_TYPE_LABEL[t] : (leave.leaveType ?? "Leave");
  const TypeIcon = t && t in LEAVE_TYPE_ICON ? LEAVE_TYPE_ICON[t] : LEAVE_TYPE_ICON_FALLBACK;
  const cancellable = daysAgo(leave.startDate) <= CANCEL_WINDOW_DAYS;

  return (
    <Card variant="outlined" sx={{ p: 1.75, display: "flex", gap: 1.5, alignItems: "flex-start" }}>
      {/* Mini calendar */}
      <Box
        sx={{
          width: 44,
          flexShrink: 0,
          textAlign: "center",
          border: 1,
          borderColor: "divider",
          borderRadius: 1,
          overflow: "hidden",
        }}
      >
        <Box sx={{ bgcolor: "primary.main", color: "primary.contrastText", fontSize: 9, fontWeight: 700, py: 0.25, letterSpacing: "0.04em" }}>
          {monthAbbr(leave.startDate)}
        </Box>
        <Box sx={{ fontSize: 18, fontWeight: 700, py: 0.25, fontVariantNumeric: "tabular-nums" }}>
          {dayNumber(leave.startDate)}
        </Box>
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.25 }}>
          <TypeIcon size={14} style={{ flexShrink: 0 }} />
          <Typography sx={{ fontSize: 13.5, fontWeight: 600, flex: 1, minWidth: 0 }} noWrap>
            {typeLabel}
          </Typography>
          <StatusChip status={leave.status} />
        </Stack>
        <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
          {formatNice(leave.startDate)} → {formatNice(leave.endDate)}
        </Typography>
        <Typography sx={{ fontSize: 11.5, color: "text.disabled", fontVariantNumeric: "tabular-nums" }}>
          {leave.numberOfDays ?? "—"} day{leave.numberOfDays === 1 ? "" : "s"}
        </Typography>
      </Box>

      <Tooltip title={cancellable ? "Cancel this leave" : "Past the 30-day cancellation window"}>
        <span>
          <IconButton
            size="small"
            aria-label="Cancel leave"
            disabled={!cancellable}
            onClick={onCancel}
            sx={{
              width: 26,
              height: 26,
              border: 1,
              borderColor: "divider",
              borderRadius: 0.75,
              color: "text.secondary",
              "&:hover": { color: "error.main", borderColor: "error.main" },
            }}
          >
            <TrashIcon />
          </IconButton>
        </span>
      </Tooltip>
    </Card>
  );
}

function CancelDialog({ leave, onClose }: { leave: DatabaseLeave | null; onClose: () => void }) {
  const cancel = useCancelLeave();
  const { showSuccess, showError } = useNotifications();
  // The same name the row shows. The source builds "${Capitalised} Leave" here,
  // which renders "Conges_payes Leave"; we keep the row's label instead.
  const cancelType = leave?.leaveType as LeaveType | undefined;
  const cancelLeaveLabel =
    cancelType && cancelType in LEAVE_TYPE_LABEL ? LEAVE_TYPE_LABEL[cancelType] : "leave";

  const handleConfirm = () => {
    if (!leave) return;
    cancel.mutate(leave.id, {
      onSuccess: () => {
        showSuccess(SnackMessage.success.cancelLeaveMessage);
        onClose();
      },
      onError: (err) => showError(describeError(err)),
    });
  };

  return (
    <Dialog open={!!leave} onClose={cancel.isPending ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontSize: 17, fontWeight: 700 }}>{CANCEL_CONFIRMATION.title}</DialogTitle>
      <DialogContent dividers>
        {/* The source names the leave and its dates and says the action is
            final — LeaveCard.tsx:50-57. It makes no claim about who gets
            told, so neither do we. */}
        <Typography sx={{ fontSize: 13.5 }}>
          {CANCEL_CONFIRMATION.body({
            leaveLabel: cancelLeaveLabel,
            startDate: formatNice(leave?.startDate),
            endDate: formatNice(leave?.endDate),
          })}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button size="small" onClick={onClose} disabled={cancel.isPending}>
          {CANCEL_CONFIRMATION.dismiss}
        </Button>
        <Button size="small" color="error" variant="contained" onClick={handleConfirm} disabled={cancel.isPending}>
          {cancel.isPending ? "Cancelling…" : CANCEL_CONFIRMATION.confirm}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function TrashIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a2 2 0 012-2h2a2 2 0 012 2v2" />
    </svg>
  );
}
