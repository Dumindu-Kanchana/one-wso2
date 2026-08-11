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
  Autocomplete,
  Box,
  Button,
  Card,
  Chip,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { describeError } from "../util/leaveError";
import VirtualizedListbox from "@components/virtualized-listbox/VirtualizedListbox";
import LeaveShell from "../components/LeaveShell";
import { LeaveTypeChip } from "../components/LeaveChips";
import { LEAVE_PRIVILEGE, type LeaveFilter } from "../api/leaveTypes";
import { useLeaveEmployees, useLeaveUserInfo, useLeaves } from "../api/useLeaveData";
import { formatNice, startOfYearIso, todayIso } from "../util/leaveDates";

const PERIOD_LABEL: Record<string, string> = {
  multiple: "Multiple days",
  one: "Full day",
  half: "Half day",
};

export default function LeaveReportsPage() {
  return (
    <LeaveShell
      title="Leave reports"
      subtitle="Approved leave across your team (leads) or the organisation (People Ops), filtered by date range."
    >
      <ReportsBody />
    </LeaveShell>
  );
}

function ReportsBody() {
  const userInfo = useLeaveUserInfo();
  const privileges = userInfo.data?.privileges ?? [];
  const isPeopleOps = privileges.includes(LEAVE_PRIVILEGE.PEOPLE_OPS_TEAM);
  const isLead =
    userInfo.data?.isLead === true ||
    privileges.includes(LEAVE_PRIVILEGE.LEAD) ||
    (userInfo.data?.subordinateCount ?? 0) > 0;

  const employees = useLeaveEmployees(isPeopleOps);

  // Draft filter (edited in the toolbar) vs applied filter (drives the query).
  const [fromDate, setFromDate] = useState(startOfYearIso(new Date().getFullYear()));
  const [toDate, setToDate] = useState(todayIso());
  const [employee, setEmployee] = useState<string | null>(null);
  const [applied, setApplied] = useState({ from: fromDate, to: toDate, email: null as string | null });

  // Bound the fetch — for People Ops this is otherwise an org-wide, un-paged
  // pull rendered into a non-virtualised table. If we hit the cap the totals
  // below only cover what came back, so the UI says so.
  const REPORT_LIMIT = 1000;

  const filter: LeaveFilter = useMemo(() => {
    const base: LeaveFilter = {
      startDate: applied.from,
      endDate: applied.to,
      statuses: ["APPROVED"],
      orderBy: "DESC",
      limit: REPORT_LIMIT,
    };
    if (isPeopleOps) {
      if (applied.email) base.email = applied.email;
      base.employeeStatuses = ["Active", "Marked leaver"];
    } else {
      // Lead: scope to their subordinates via approverEmail.
      base.approverEmail = userInfo.data?.workEmail ?? undefined;
    }
    return base;
  }, [applied, isPeopleOps, userInfo.data?.workEmail]);

  const allowed = isPeopleOps || isLead;
  const leaves = useLeaves(filter, Boolean(userInfo.data) && allowed);

  const employeeOptions = useMemo(
    () => (employees.data ?? []).map((e) => e.workEmail).filter(Boolean),
    [employees.data],
  );

  if (userInfo.isLoading) {
    return <Skeleton variant="rectangular" height={220} sx={{ borderRadius: 1.5 }} />;
  }
  if (userInfo.isError) {
    return <Alert severity="error">Couldn't load your leave profile. {describeError(userInfo.error)}</Alert>;
  }
  if (!allowed) {
    return <Alert severity="info">Leave reports are available to leads and People Ops.</Alert>;
  }

  const rows = leaves.data?.leaves ?? [];
  const totalDays = rows.reduce((sum, r) => sum + (r.numberOfDays ?? 0), 0);
  // We asked for at most REPORT_LIMIT rows; if we got exactly that many there
  // may be more, and the total below under-reports. Surface that caveat.
  const capped = rows.length >= REPORT_LIMIT;

  return (
    <Box>
      {/* Toolbar */}
      <Card variant="outlined" sx={{ p: 1.75, mb: 2 }}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "auto auto 1fr auto" }, gap: 1.5, alignItems: "end" }}>
          <DateField label="From" value={fromDate} onChange={setFromDate} />
          <DateField label="To" value={toDate} min={fromDate} onChange={setToDate} />
          {isPeopleOps ? (
            <Box>
              <Typography sx={{ fontSize: 11, color: "text.secondary", mb: 0.375 }}>Employee</Typography>
              <Autocomplete
                size="small"
                options={employeeOptions}
                value={employee}
                onChange={(_e, v) => setEmployee(v as string | null)}
                loading={employees.isLoading}
                loadingText="Loading employees…"
                noOptionsText={employees.isError ? "Couldn't load employees" : "No employees found"}
                disableListWrap
                ListboxComponent={VirtualizedListbox}
                renderInput={(params) => <TextField {...params} placeholder="All employees" />}
              />
            </Box>
          ) : (
            <Box />
          )}
          <Button
            variant="contained"
            onClick={() => setApplied({ from: fromDate, to: toDate, email: employee })}
            disabled={leaves.isFetching}
            sx={{ fontWeight: 600 }}
          >
            {leaves.isFetching ? "Loading…" : "Fetch report"}
          </Button>
        </Box>
      </Card>

      {leaves.isLoading ? (
        <Skeleton variant="rectangular" height={220} sx={{ borderRadius: 1.5 }} />
      ) : leaves.isError ? (
        <Alert severity="error">{describeError(leaves.error)}</Alert>
      ) : rows.length === 0 ? (
        <Typography sx={{ fontSize: 13, color: "text.secondary", py: 3 }}>
          No approved leave in this range.
        </Typography>
      ) : (
        <>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1, flexWrap: "wrap" }}>
            <Chip label={`${rows.length}${capped ? "+" : ""} record${rows.length === 1 ? "" : "s"}`} size="small" variant="outlined" sx={{ height: 22, fontSize: 11, fontWeight: 600 }} />
            <Chip label={`${totalDays} day${totalDays === 1 ? "" : "s"} total`} size="small" color="primary" variant="outlined" sx={{ height: 22, fontSize: 11, fontWeight: 600 }} />
            {capped && (
              <Typography sx={{ fontSize: 11, color: "warning.main" }}>
                Showing the first {REPORT_LIMIT} — narrow the date range for a complete total.
              </Typography>
            )}
          </Stack>
          <Card variant="outlined" sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <HeadCell>Employee</HeadCell>
                  <HeadCell>Leave type</HeadCell>
                  <HeadCell>Start</HeadCell>
                  <HeadCell>End</HeadCell>
                  <HeadCell align="right">Days</HeadCell>
                  <HeadCell>Period</HeadCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} hover>
                    <TableCell sx={{ fontSize: 12.5 }}>{r.email}</TableCell>
                    <TableCell>
                      <LeaveTypeChip leaveType={r.leaveType} />
                    </TableCell>
                    <TableCell sx={{ fontSize: 12.5, fontVariantNumeric: "tabular-nums" }}>{formatNice(r.startDate)}</TableCell>
                    <TableCell sx={{ fontSize: 12.5, fontVariantNumeric: "tabular-nums" }}>{formatNice(r.endDate)}</TableCell>
                    <TableCell align="right" sx={{ fontSize: 12.5, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{r.numberOfDays ?? "—"}</TableCell>
                    <TableCell sx={{ fontSize: 12, color: "text.secondary" }}>
                      {PERIOD_LABEL[r.periodType ?? ""] ?? r.periodType ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </Box>
  );
}

function DateField({
  label,
  value,
  min,
  onChange,
}: {
  label: string;
  value: string;
  min?: string;
  onChange: (v: string) => void;
}) {
  return (
    <Box>
      <Typography sx={{ fontSize: 11, color: "text.secondary", mb: 0.375 }}>{label}</Typography>
      <TextField
        type="date"
        size="small"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputProps={{ min }}
      />
    </Box>
  );
}

function HeadCell({ children, align }: { children: React.ReactNode; align?: "right" }) {
  return (
    <TableCell align={align} sx={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "text.disabled" }}>
      {children}
    </TableCell>
  );
}
