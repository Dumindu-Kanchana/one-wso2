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
  FormControlLabel,
  Skeleton,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { describeError } from "../util/leaveError";
import VirtualizedListbox from "@components/virtualized-listbox/VirtualizedListbox";
import LeaveShell from "../components/LeaveShell";
import { LeaveTypeChip } from "../components/LeaveChips";
import type { EmployeeStatus, LeaveFilter } from "../api/leaveTypes";
import { useLeaveEmployees, useLeaveUserInfo, useLeaves } from "../api/useLeaveData";
import { useLeaveGate } from "../api/useLeaveGate";
import { formatNice, startOfYearIso, todayIso } from "../util/leaveDates";

const PERIOD_LABEL: Record<string, string> = {
  multiple: "Multiple days",
  one: "Full day",
  half: "Half day",
};

// Matches leave-app's Toolbar.tsx EMPLOYEE_STATUS_OPTIONS — People Ops can
// filter by all three; "Left" defaults off since most reports care about
// current/exiting staff, not departed ones.
const EMPLOYEE_STATUS_OPTIONS: EmployeeStatus[] = ["Active", "Marked leaver", "Left"];
const DEFAULT_EMPLOYEE_STATUSES: EmployeeStatus[] = ["Active", "Marked leaver"];

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
  // One source of truth with the rail, so the menu and the page cannot
  // disagree about who gets in. Previously this also accepted `isLead === true`
  // and `subordinateCount > 0`, granting the report to people the source never
  // grants it to — it checks the privilege number alone.
  const { isPeopleOps, isLead } = useLeaveGate();

  const employees = useLeaveEmployees(isPeopleOps);

  // Draft filter (edited in the toolbar) vs applied filter (drives the query).
  const [fromDate, setFromDate] = useState(startOfYearIso(new Date().getFullYear()));
  const [toDate, setToDate] = useState(todayIso());
  const [employee, setEmployee] = useState<string | null>(null);
  // People-Ops-only: default to org-wide, matching leave-app's LeadReportTab
  // default (showAllEmployees=true for People Ops). Leads-without-People-Ops
  // never see this toggle — they're always scoped to their subordinates,
  // same as before.
  const [showAllEmployees, setShowAllEmployees] = useState(true);
  const [employeeStatuses, setEmployeeStatuses] = useState<EmployeeStatus[]>(DEFAULT_EMPLOYEE_STATUSES);
  const [applied, setApplied] = useState({
    from: fromDate,
    to: toDate,
    email: null as string | null,
    showAllEmployees: true,
    employeeStatuses: DEFAULT_EMPLOYEE_STATUSES,
  });

  // Bound the fetch — for People Ops this is otherwise an org-wide, un-paged
  // pull rendered into a non-virtualised table. If we hit the cap the totals
  // below only cover what came back, so the UI says so.
  const REPORT_LIMIT = 1000;

  const workEmail = userInfo.data?.workEmail ?? null;
  // Whether *this* applied filter needs approverEmail scoping — plain leads
  // always do; People Ops only once they've narrowed to "Subordinates only".
  const needsApproverScope = isPeopleOps ? !applied.showAllEmployees : true;
  // If scoping is needed but workEmail is unavailable, the request must NOT
  // silently fall through to an unscoped (org-wide) report — that would
  // show far more than the user asked for. Block the query entirely
  // instead of ever letting approverEmail end up undefined.
  const canScopeToApprover = !needsApproverScope || Boolean(workEmail);

  const filter: LeaveFilter = useMemo(() => {
    const base: LeaveFilter = {
      startDate: applied.from,
      endDate: applied.to,
      statuses: ["APPROVED"],
      orderBy: "DESC",
      limit: REPORT_LIMIT,
    };
    // Sent for everyone, not only People Ops. The running app spreads it
    // unconditionally (LeadReportTab.tsx:46,61) even though only People Ops can
    // edit the control — its state defaults to [Active, Marked leaver] and goes
    // out on every request, including a plain lead's.
    //
    // It is not a display filter: it changes which rows the backend returns, so
    // withholding it for leads gave them a different report from the one they
    // get in the app that is live today. Reproducing what ships is the whole
    // point; the mechanism behind it is the backend's business.
    if (applied.employeeStatuses.length > 0) base.employeeStatuses = applied.employeeStatuses;

    if (isPeopleOps) {
      if (applied.email) base.email = applied.email;
      // Matches leave-app's "Subordinates only" toggle — People Ops default
      // to org-wide, but can narrow to their own reports like a plain lead.
      if (!applied.showAllEmployees && workEmail) base.approverEmail = workEmail;
    } else if (workEmail) {
      // Lead: scope to their subordinates via approverEmail.
      base.approverEmail = workEmail;
    }
    return base;
  }, [applied, isPeopleOps, workEmail]);

  const allowed = isPeopleOps || isLead;
  const leaves = useLeaves(filter, Boolean(userInfo.data) && allowed && canScopeToApprover);

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
  if (!canScopeToApprover) {
    return (
      <Alert severity="error">
        Couldn't resolve your work email, please try again later.
      </Alert>
    );
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
            onClick={() =>
              setApplied({ from: fromDate, to: toDate, email: employee, showAllEmployees, employeeStatuses })
            }
            disabled={leaves.isFetching}
            sx={{ fontWeight: 600 }}
          >
            {leaves.isFetching ? "Loading…" : "Fetch report"}
          </Button>
        </Box>

        {isPeopleOps && (
          <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 2, mt: 1.5 }}>
            <Tooltip title={workEmail ? "" : "Your work email couldn't be resolved."}>
              {/* span wrapper so the tooltip still fires when the control is disabled */}
              <span>
                <FormControlLabel
                  disabled={!workEmail}
                  control={
                    <Switch
                      size="small"
                      checked={!showAllEmployees}
                      onChange={(e) => setShowAllEmployees(!e.target.checked)}
                    />
                  }
                  label={
                    <Typography
                      sx={{
                        fontSize: 12.5,
                        fontWeight: showAllEmployees ? 400 : 600,
                        color: showAllEmployees ? "text.secondary" : "text.primary",
                      }}
                    >
                      Subordinates only
                    </Typography>
                  }
                />
              </span>
            </Tooltip>
            <Box sx={{ minWidth: 260 }}>
              <Autocomplete
                multiple
                size="small"
                disableCloseOnSelect
                options={EMPLOYEE_STATUS_OPTIONS}
                value={employeeStatuses}
                onChange={(_e, v) => setEmployeeStatuses(v as EmployeeStatus[])}
                renderInput={(params) => <TextField {...params} label="Employee status" />}
              />
            </Box>
          </Box>
        )}
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
