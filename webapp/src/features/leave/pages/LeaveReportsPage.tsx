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
  TableSortLabel,
  TextField,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { describeError } from "../util/leaveError";
import VirtualizedListbox from "@components/virtualized-listbox/VirtualizedListbox";
import LeaveShell from "../components/LeaveShell";
import { LeaveTypeChip } from "../components/LeaveChips";
import type { DatabaseLeave, EmployeeStatus, LeaveFilter } from "../api/leaveTypes";
// Shared table furniture, currently living in the CRM Upload feature — the same
// import My Team makes. Hoisting it to src/components/ is a separate change.
import { PagingFooter } from "@features/marketing-ops/crm-upload/components/CrmUi";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { REPORT_VALIDATION_MESSAGE } from "../util/leaveCopy";
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

  // The source pages at 10 (LeadReportTable.tsx:154).
  const [sort, setSort] = useState<{ field: SortField; direction: "asc" | "desc" }>({
    field: "startDate",
    direction: "desc",
  });
  const [page, setPage] = useState(1);
  const toggleSort = (field: SortField) => {
    setSort((s) => (s.field === field ? { field, direction: s.direction === "asc" ? "desc" : "asc" } : { field, direction: "asc" }));
    setPage(1);
  };

  // Checked on Fetch, not left to the To field's `min` — that only constrains
  // the picker, and a typed date goes straight past it (Toolbar.tsx:95-107).
  const { showError } = useNotifications();

  const runReport = () => {
    if (!fromDate || !toDate) {
      showError(REPORT_VALIDATION_MESSAGE.datesRequired);
      return;
    }
    if (toDate < fromDate) {
      showError(REPORT_VALIDATION_MESSAGE.endBeforeStart);
      return;
    }
    setApplied({ from: fromDate, to: toDate, email: employee, showAllEmployees, employeeStatuses });
    setPage(1);
  };

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
      // No orderBy and no limit — the running app sends neither
      // (LeadReportTab.tsx:55-62). The cap existed only because every row was
      // rendered at once; the table pages now, and the totals below cover the
      // whole result rather than the first page of it.
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

  // Memoised: `?? []` hands a fresh array to the sort below on every render,
  // which would defeat its useMemo entirely.
  const all = useMemo(() => leaves.data?.leaves ?? [], [leaves.data]);
  const totalDays = all.reduce((sum, r) => sum + (r.numberOfDays ?? 0), 0);

  // The source's report is a DataGrid, so it arrives sorted-on-click and paged
  // at 10 rows (LeadReportTable.tsx:150-178). The port rendered every row into a
  // plain table in whatever order the backend returned, and capped the fetch at
  // 1000 to keep that survivable — a cap the source has no need for because it
  // never renders more than a page.
  const sorted = useMemo(() => {
    const copy = [...all];
    copy.sort((a, b) => {
      const av = sortValue(a, sort.field);
      const bv = sortValue(b, sort.field);
      if (av === bv) return 0;
      const order = av < bv ? -1 : 1;
      return sort.direction === "asc" ? order : -order;
    });
    return copy;
  }, [all, sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const rows = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // The source shows its total only for a single-employee result
  // (LeadReportTable.tsx:57-59,141) — summing days across a mixed list answers
  // no question anyone asked.
  const oneEmployee = new Set(all.map((r) => r.email)).size === 1;

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
              runReport()
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
            <Chip label={`${sorted.length} record${sorted.length === 1 ? "" : "s"}`} size="small" variant="outlined" sx={{ height: 22, fontSize: 11, fontWeight: 600 }} />
            {oneEmployee && (
              <Chip label={`Total: ${totalDays} day${totalDays === 1 ? "" : "s"}`} size="small" color="primary" variant="outlined" sx={{ height: 22, fontSize: 11, fontWeight: 600 }} />
            )}
          </Stack>
          <Card variant="outlined" sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {REPORT_COLUMNS.map((col) => (
                    <HeadCell key={col.field} align={col.align}>
                      <TableSortLabel
                        active={sort.field === col.field}
                        direction={sort.field === col.field ? sort.direction : "asc"}
                        onClick={() => toggleSort(col.field)}
                      >
                        {col.label}
                      </TableSortLabel>
                    </HeadCell>
                  ))}
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
          {/* Outside the Card: PagingFooter carries its own top margin and no
              horizontal padding, so it sits below rather than inside. */}
          <PagingFooter
            page={safePage}
            pageSize={PAGE_SIZE}
            total={sorted.length}
            pageCount={pageCount}
            onPageChange={setPage}
          />
        </>
      )}
    </Box>
  );
}

/** The six columns, in the source's order (LeadReportTable.tsx:61-137). */
/** LeadReportTable.tsx:154 — the source's initial page size. */
const PAGE_SIZE = 10;

const REPORT_COLUMNS: {
  field: SortField;
  label: string;
  align?: "right";
}[] = [
  { field: "email", label: "Employee" },
  { field: "leaveType", label: "Leave type" },
  { field: "startDate", label: "Start" },
  { field: "endDate", label: "End" },
  { field: "numberOfDays", label: "Days", align: "right" },
  { field: "periodType", label: "Period" },
];

type SortField = "email" | "leaveType" | "startDate" | "endDate" | "numberOfDays" | "periodType";

/**
 * One row's value for a column, normalised so a mixed column still orders.
 *
 * Dates are compared as their ISO prefix rather than parsed — the backend sends
 * timestamps and the first ten characters sort correctly as text, which avoids
 * building a Date per comparison.
 */
function sortValue(row: DatabaseLeave, field: SortField): string | number {
  switch (field) {
    case "numberOfDays":
      return row.numberOfDays ?? -1;
    case "startDate":
    case "endDate":
      return String(row[field] ?? "").substring(0, 10);
    default:
      return String(row[field] ?? "").toLowerCase();
  }
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
