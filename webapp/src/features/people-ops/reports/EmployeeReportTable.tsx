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

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Alert,
  Badge,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  MenuItem,
  Select,
  Skeleton,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  Columns3Icon,
  DownloadIcon,
  FilterIcon,
  InboxIcon,
  SearchIcon,
  XIcon,
} from "@wso2/oxygen-ui-icons-react";
import { Link as RouterLink, useNavigate } from "react-router";
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
import { employeeDetailPath } from "./reportRoutes";
import { pageView } from "./reportPaging";
import { baselineFiltersFor } from "./reportBaseline";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { localIsoDate } from "@utils/localDate";

const PAGE_SIZE_OPTIONS = [10, 25, 50];

// How long typing pauses before the search fires. Long enough that a normal
// typing burst is one request rather than one per character; short enough
// that it still feels immediate.
const SEARCH_DEBOUNCE_MS = 300;

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
  /**
   * Whether "include marked leavers" starts on. Separate from showing it,
   * because the two reports want opposite defaults: on Active, people
   * serving notice are still staff and belong in the headcount; on
   * Resignations, defaulting it on would silently widen "who has left" to
   * include people who haven't left yet.
   */
  defaultIncludeMarkedLeavers?: boolean;
  /** Wording for that toggle; see ReportFilterDialog for why it varies. */
  markedLeaversLabel?: string;
}

export default function EmployeeReportTable({
  employeeStatus,
  previewAlertText,
  countChipLabel,
  downloadFilenamePrefix,
  showExcludeFutureFilter = true,
  showIncludeMarkedLeaversFilter = false,
  defaultIncludeMarkedLeavers = false,
  markedLeaversLabel,
}: EmployeeReportTableProps) {
  const navigate = useNavigate();
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
  const baselineFilters = useMemo<Filters>(
    () =>
      baselineFiltersFor({
        employeeStatus,
        showExcludeFutureFilter,
        showIncludeMarkedLeaversFilter,
        defaultIncludeMarkedLeavers,
      }),
    [
      employeeStatus,
      showExcludeFutureFilter,
      showIncludeMarkedLeaversFilter,
      defaultIncludeMarkedLeavers,
    ],
  );

  const [appliedFilters, setAppliedFilters] = useState<Filters>(baselineFilters);

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);

  // Two search values: `searchInput` is what's in the box (updates per
  // keystroke), `searchTerm` is what's been sent (updates after the pause).
  // Keeping them apart is what stops every character firing a request.
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const trimmed = searchInput.trim();
    if (trimmed === searchTerm) return;
    const timer = setTimeout(() => setSearchTerm(trimmed), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput, searchTerm]);

  // Any change to what's being searched or filtered invalidates the current
  // page number: page 4 of the old result set is meaningless against a new
  // one, and asking for it returns an empty page that reads as "no matches".
  //
  // Adjusted DURING render rather than in an effect. React's documented
  // pattern for state derived from a prop/state change, and here it also
  // avoids fetching page 4 of the new query and then immediately refetching
  // page 0 — the effect version would have issued both requests.
  const queryIdentity = JSON.stringify([searchTerm, appliedFilters, pageSize]);
  const [lastQueryIdentity, setLastQueryIdentity] = useState(queryIdentity);
  const queryChanged = queryIdentity !== lastQueryIdentity;
  if (queryChanged) {
    setLastQueryIdentity(queryIdentity);
    setPage(0);
  }
  // React re-runs this render before committing, so `page` would be 0 by the
  // time anything below reads it. Spelling that out as its own value keeps
  // the rest of the component from depending on that subtlety.
  const effectivePage = queryChanged ? 0 : page;

  // Memoised because it is part of the query key — a fresh object per render
  // would look like a new query every time the parent re-rendered.
  const searchPayload = useMemo(
    () => ({
      // Omitted entirely when empty: the backend treats an absent
      // searchString differently from an empty one.
      ...(searchTerm ? { searchString: searchTerm } : {}),
      filters: appliedFilters,
      pagination: { limit: pageSize, offset: effectivePage * pageSize },
      sort: { sortField: "employeeId", sortOrder: "ASC" as const },
      leadOnly: false,
    }),
    [appliedFilters, effectivePage, pageSize, searchTerm],
  );

  const search = useEmployeeSearch(searchPayload);
  const masterData = useOrgMasterData(filterDialogOpen);
  const managers = useManagers(filterDialogOpen);
  const download = useEmployeeReportDownload();

  const rows: Employee[] = search.data?.employees ?? [];
  const totalCount = search.data?.totalCount ?? null;

  const { canPrev, canNext, rangeLabel } = pageView({
    page: effectivePage,
    pageSize,
    rowCount: rows.length,
    totalCount,
  });

  // The CSV generator cannot filter by search text — its payload has no
  // searchString field and the backend passes nil internally — so an export
  // taken while searching would quietly contain more rows than the table
  // shows. Say so rather than letting the file surprise someone.
  const searchExcludedFromExport = Boolean(searchTerm);

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
          // The filename dates the export for whoever downloads it, so it has
          // to be their calendar day, not the UTC one.
          saveCsv(csv, `${downloadFilenamePrefix}_${localIsoDate()}.csv`);
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
        <TextField
          size="small"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by name, ID or email"
          aria-label="Search employees"
          sx={{ flex: "1 1 260px", maxWidth: 380 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon size={16} />
                </InputAdornment>
              ),
              endAdornment: searchInput ? (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    aria-label="Clear search"
                    onClick={() => setSearchInput("")}
                  >
                    <XIcon size={14} />
                  </IconButton>
                </InputAdornment>
              ) : null,
            },
          }}
        />

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

      <Alert severity="info" sx={{ mb: 1.5, py: 0.25 }}>
        {previewAlertText}
      </Alert>

      {searchExcludedFromExport && (
        <Alert severity="warning" sx={{ mb: 1.5, py: 0.25 }}>
          Your search only narrows the table below. Export CSV applies your
          filters but not the search text, so the file will contain more rows
          than you can see here.
        </Alert>
      )}

      {/* The preview request failing is worth stating outright — an empty
          table would otherwise read as "no employees match", which is a very
          different thing from "we couldn't ask". */}
      {search.isError && (
        <ErrorNotice
          error={search.error}
          onRetry={() => void search.refetch()}
          sx={{ mb: 1.5 }}
        >
          Couldn't load the report preview.
        </ErrorNotice>
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
              Array.from({ length: pageSize }).map((_, rowIndex) => (
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
                <TableRow
                  key={row.employeeId}
                  hover
                  // The row stays a real <tr>. Making it a RouterLink put an
                  // <a> between <tbody> and <td>, which is invalid HTML —
                  // browsers hoist the anchor out of the table and the layout
                  // collapses. The link lives in the first cell instead (see
                  // below), which keeps keyboard focus and open-in-new-tab
                  // working without the nesting being illegal.
                  // Clicking anywhere on the row navigates; the anchor in the
                  // first cell is what makes it reachable by keyboard and
                  // openable in a new tab.
                  //
                  // Two things this handler must NOT do. It must not fire for
                  // clicks on that anchor, which already navigates — handling
                  // both pushes two history entries for one click. And it must
                  // not hijack a middle-click or ctrl/cmd-click, which the
                  // person meant to open in a new tab or window.
                  onClick={(event) => {
                    if (event.defaultPrevented) return;
                    if (event.button !== 0) return;
                    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                    if ((event.target as HTMLElement).closest("a")) return;
                    navigate(employeeDetailPath(row.employeeId));
                  }}
                  sx={{ cursor: "pointer" }}>
                  {visibleColumnKeys.map((key, columnIndex) => {
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
                            component={columnIndex === 0 ? RouterLink : "span"}
                            {...(columnIndex === 0
                              ? { to: employeeDetailPath(row.employeeId) }
                              : {})}
                            sx={{
                              display: "block",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              color: "inherit",
                              textDecoration: "none",
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

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 1.5,
          mt: 1.5,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Rows per page
          </Typography>
          <Select
            size="small"
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            aria-label="Rows per page"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <MenuItem key={n} value={n}>
                {n}
              </MenuItem>
            ))}
          </Select>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ fontVariantNumeric: "tabular-nums" }}
          >
            {search.isPending ? "Loading…" : (rangeLabel ?? "No results")}
          </Typography>
          <IconButton
            size="small"
            aria-label="Previous page"
            disabled={!canPrev || search.isPending}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            <ChevronLeftIcon size={16} />
          </IconButton>
          <IconButton
            size="small"
            aria-label="Next page"
            disabled={!canNext || search.isPending}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRightIcon size={16} />
          </IconButton>
        </Box>
      </Box>

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
        markedLeaversLabel={markedLeaversLabel}
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
