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

import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  Alert,
  Badge,
  Box,
  Button,
  Chip,
  CircularProgress,
  Skeleton,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { Columns3Icon, DownloadIcon, FilterIcon, InboxIcon } from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import { EmployeeStatus } from "../api/peopleOpsTypes";
import type { Employee, Filters } from "../api/peopleOpsTypes";
import {
  saveCsv,
  useEmployeeReportDownload,
  useEmployeeSearch,
  useManagers,
} from "../api/useEmployeeReport";
import { useOrgMasterData } from "../api/useOrgMasterData";
import ColumnSelectorDialog from "./ColumnSelectorDialog";
import ReportFilterDialog from "./ReportFilterDialog";
import { COLUMN_WIDTHS, cellText } from "./reportCells";
import { getAllKeys, getColumnsForStatus } from "./reportColumns";

// Rows fetched for the on-screen preview. The point of this screen is the
// CSV: the table is a "did I filter this right?" check, so it stays small
// and the full dataset is only ever materialised server-side.
const PREVIEW_LIMIT = 10;

// Columns rendered before the table starts appending a "+N more" marker.
// Selecting all 26 would produce a table nobody can read horizontally; the
// export still contains every selected column.
const PREVIEW_COL_LIMIT = 6;

// Filters that are structural rather than user choices, so they never count
// toward the "N filters active" badge: employeeStatus is fixed by the report
// itself, and directReports is not offered on these screens at all.
const BASELINE_FILTER_KEYS: (keyof Filters)[] = ["employeeStatus", "directReports"];

export interface EmployeeReportTableProps {
  /** Which report this is. Also selects the extra resignation columns. */
  employeeStatus: EmployeeStatus;
  previewAlertText: ReactNode;
  countChipLabel: string;
  /** Base name for the download; the run date is appended. */
  downloadFilenamePrefix: string;
  showExcludeFutureFilter?: boolean;
  showIncludeMarkedLeaversFilter?: boolean;
}

export default function EmployeeReportTable({
  employeeStatus,
  previewAlertText,
  countChipLabel,
  downloadFilenamePrefix,
  showExcludeFutureFilter = true,
  showIncludeMarkedLeaversFilter = false,
}: EmployeeReportTableProps) {
  const isResignation = employeeStatus === EmployeeStatus.Left;

  const allColumns = useMemo(() => getColumnsForStatus(isResignation), [isResignation]);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(() =>
    getAllKeys(isResignation),
  );

  const [columnDialogOpen, setColumnDialogOpen] = useState(false);
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // The report's resting state: its fixed status plus whichever defaults it
  // declares. "Clear all" returns here, not to an empty object — an Active
  // report with no status filter would not be an Active report.
  const baselineFilters = useMemo<Filters>(() => {
    const base: Filters = { employeeStatus };
    if (showExcludeFutureFilter) base.excludeFutureStartDate = true;
    if (showIncludeMarkedLeaversFilter) base.includeMarkedLeavers = true;
    return base;
  }, [employeeStatus, showExcludeFutureFilter, showIncludeMarkedLeaversFilter]);

  const [appliedFilters, setAppliedFilters] = useState<Filters>(baselineFilters);

  // Memoised because it is part of the query key — a fresh object per render
  // would look like a new query every time the parent re-rendered.
  const searchPayload = useMemo(
    () => ({
      filters: appliedFilters,
      pagination: { limit: PREVIEW_LIMIT, offset: 0 },
      sort: { sortField: "employeeId", sortOrder: "ASC" as const },
      leadOnly: false,
    }),
    [appliedFilters],
  );

  const search = useEmployeeSearch(searchPayload);
  const masterData = useOrgMasterData(filterDialogOpen);
  const managers = useManagers(filterDialogOpen);
  const download = useEmployeeReportDownload();

  const rows: Employee[] = search.data?.employees ?? [];
  const totalCount = search.data?.totalCount ?? null;

  const managerEmails = useMemo(
    () => (managers.data ?? []).map((m) => m.workEmail).sort(),
    [managers.data],
  );

  // Any filter the user could have changed. Baseline defaults deliberately
  // count: switching "Exclude future joiners" off is a deviation worth
  // showing on the badge, even though its key is present by default.
  const activeFilterCount = useMemo(
    () =>
      Object.entries(appliedFilters).filter(
        ([key, value]) =>
          value !== undefined && !BASELINE_FILTER_KEYS.includes(key as keyof Filters),
      ).length,
    [appliedFilters],
  );

  const deselectedCount = allColumns.length - selectedColumns.length;
  // Only badge the column button once the selection deviates from "all".
  const columnBadgeCount = deselectedCount > 0 ? selectedColumns.length : 0;

  const visibleColumnKeys = selectedColumns.slice(0, PREVIEW_COL_LIMIT);
  const hiddenColumnCount = Math.max(0, selectedColumns.length - PREVIEW_COL_LIMIT);

  const handleExport = useCallback(() => {
    setDownloadError(null);
    download.mutate(
      { filters: appliedFilters, columns: selectedColumns },
      {
        onSuccess: (csv) => {
          const today = new Date().toISOString().slice(0, 10);
          saveCsv(csv, `${downloadFilenamePrefix}_${today}.csv`);
        },
        onError: (err) => setDownloadError(describeError(err)),
      },
    );
  }, [appliedFilters, download, downloadFilenamePrefix, selectedColumns]);

  const columnTooltip =
    columnBadgeCount > 0
      ? `${selectedColumns.length} of ${allColumns.length} columns selected` +
        (hiddenColumnCount > 0 ? ` · ${hiddenColumnCount} hidden in this preview` : "")
      : "Choose which columns to export";

  return (
    <Box>
      {/* Toolbar */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 1.5,
          mb: 1.5,
        }}
      >
        <Alert severity="info" sx={{ flex: "1 1 320px", py: 0.25 }}>
          {previewAlertText}
        </Alert>

        <Chip
          size="small"
          variant="outlined"
          label={
            <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
              <Box
                component="span"
                sx={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                  color: "text.secondary",
                }}
              >
                {countChipLabel}
              </Box>
              <Box
                component="span"
                sx={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}
              >
                {search.isPending ? (
                  <Skeleton variant="text" width={28} sx={{ display: "inline-block" }} />
                ) : (
                  (totalCount ?? "—")
                )}
              </Box>
            </Box>
          }
          sx={{ height: "auto", "& .MuiChip-label": { px: 1.5, py: 0.75 } }}
        />

        <Tooltip title={columnTooltip}>
          <Badge badgeContent={columnBadgeCount} color="primary">
            <Button
              variant="outlined"
              onClick={() => setColumnDialogOpen(true)}
              startIcon={<Columns3Icon size={16} />}
            >
              Columns
            </Button>
          </Badge>
        </Tooltip>

        <Tooltip
          title={
            activeFilterCount > 0
              ? `${activeFilterCount} filter${activeFilterCount > 1 ? "s" : ""} active`
              : "Open filters"
          }
        >
          <Badge badgeContent={activeFilterCount} color="primary">
            <Button
              variant="outlined"
              onClick={() => setFilterDialogOpen(true)}
              startIcon={<FilterIcon size={16} />}
            >
              Filters
            </Button>
          </Badge>
        </Tooltip>

        <Button
          variant="contained"
          onClick={handleExport}
          disabled={download.isPending || selectedColumns.length === 0}
          startIcon={
            download.isPending ? (
              <CircularProgress size={14} color="inherit" />
            ) : (
              <DownloadIcon size={16} />
            )
          }
        >
          {download.isPending ? "Preparing…" : "Export CSV"}
        </Button>
      </Box>

      {/* The preview request failing is worth stating outright — an empty
          table would otherwise read as "no employees match", which is a very
          different thing from "we couldn't ask". */}
      {search.isError && (
        <Alert
          severity="error"
          sx={{ mb: 1.5 }}
          action={
            <Button color="inherit" size="small" onClick={() => void search.refetch()}>
              Retry
            </Button>
          }
        >
          Couldn't load the report preview. {describeError(search.error)}
        </Alert>
      )}

      <TableContainer sx={{ border: 1, borderColor: "divider", borderRadius: 1 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              {visibleColumnKeys.map((key) => {
                const col = allColumns.find((c) => c.key === key);
                return (
                  <TableCell
                    key={key}
                    sx={{
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                      minWidth: COLUMN_WIDTHS[key] ?? 120,
                    }}
                  >
                    {col?.label ?? key}
                  </TableCell>
                );
              })}
              {hiddenColumnCount > 0 && (
                <TableCell
                  sx={{
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                    color: "text.secondary",
                    borderLeft: 1,
                    borderColor: "divider",
                  }}
                >
                  <Tooltip title="These columns are in the CSV export but not shown here">
                    <Box component="span">+{hiddenColumnCount} more</Box>
                  </Tooltip>
                </TableCell>
              )}
            </TableRow>
          </TableHead>

          <TableBody>
            {search.isPending ? (
              // Skeleton rows at the real row count and column widths, so the
              // table doesn't resize when the data lands.
              Array.from({ length: PREVIEW_LIMIT }).map((_, rowIndex) => (
                <TableRow key={`skeleton-${rowIndex}`}>
                  {visibleColumnKeys.map((key) => (
                    <TableCell key={key}>
                      <Skeleton variant="text" width="75%" />
                    </TableCell>
                  ))}
                  {hiddenColumnCount > 0 && (
                    <TableCell sx={{ borderLeft: 1, borderColor: "divider" }} />
                  )}
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={visibleColumnKeys.length + (hiddenColumnCount > 0 ? 1 : 0)}
                  sx={{ borderBottom: 0 }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 1,
                      py: 5,
                      color: "text.disabled",
                    }}
                  >
                    <InboxIcon size={36} />
                    <Typography variant="body2">
                      {search.isError ? "Couldn't load employees" : "No employees match these filters"}
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.employeeId} hover>
                  {visibleColumnKeys.map((key) => {
                    const text = cellText(row, key);
                    // Status is the one column that reads better as a chip —
                    // it is a small closed set, and the colour carries meaning.
                    if (key === "employeeStatus") {
                      return (
                        <TableCell key={key}>
                          <Chip
                            label={text}
                            size="small"
                            variant="outlined"
                            color={statusColor(row.employeeStatus)}
                            sx={{ fontWeight: 600 }}
                          />
                        </TableCell>
                      );
                    }
                    return (
                      <TableCell
                        key={key}
                        sx={{
                          maxWidth: COLUMN_WIDTHS[key] ?? 120,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {/* Cells are truncated to keep the row height fixed,
                            so the full value has to stay reachable somehow. */}
                        <Tooltip title={text} arrow>
                          <Box
                            component="span"
                            sx={{
                              display: "block",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {text}
                          </Box>
                        </Tooltip>
                      </TableCell>
                    );
                  })}
                  {hiddenColumnCount > 0 && (
                    <TableCell
                      sx={{
                        borderLeft: 1,
                        borderColor: "divider",
                        color: "text.disabled",
                        letterSpacing: 2,
                      }}
                    >
                      ···
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <ColumnSelectorDialog
        open={columnDialogOpen}
        onClose={() => setColumnDialogOpen(false)}
        columns={allColumns}
        selectedKeys={selectedColumns}
        onApply={setSelectedColumns}
      />

      <ReportFilterDialog
        open={filterDialogOpen}
        onClose={() => setFilterDialogOpen(false)}
        applied={appliedFilters}
        // Re-assert the baseline underneath the draft: the status this report
        // is for is not the user's to change from in here.
        onApply={(next) => setAppliedFilters({ ...next, employeeStatus })}
        onClearAll={() => setAppliedFilters(baselineFilters)}
        masterData={masterData}
        managerEmails={managerEmails}
        showExcludeFutureFilter={showExcludeFutureFilter}
        showIncludeMarkedLeaversFilter={showIncludeMarkedLeaversFilter}
      />

      {/* A failed export needs to be visible without disturbing the table —
          the filters are still valid and worth retrying against. */}
      <Snackbar
        open={Boolean(downloadError)}
        autoHideDuration={8000}
        onClose={() => setDownloadError(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="error" onClose={() => setDownloadError(null)}>
          Couldn't export the report. {downloadError}
        </Alert>
      </Snackbar>
    </Box>
  );
}

// Marked leaver is deliberately "warning" rather than "error": someone
// serving notice is still employed, and the row should not read as a problem.
function statusColor(status: EmployeeStatus): "success" | "warning" | "default" {
  if (status === EmployeeStatus.Active) return "success";
  if (status === EmployeeStatus.MarkedLeaver) return "warning";
  return "default";
}
