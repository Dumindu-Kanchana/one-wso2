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
import {
  Box,
  Button,
  Chip,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableSortLabel,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { useNavigate } from "react-router";
import type { JSX, ReactNode } from "react";
// Shared table furniture, currently living in the CRM Upload feature. Hoisting
// it to src/components/ is a separate mechanical change — seven files consume it.
import { Empty, Panel, PagingFooter } from "@features/marketing-ops/crm-upload/components/CrmUi";
import { NUMERIC, TH } from "@features/marketing-ops/crm-upload/components/crmStyles";
import type { Employee, EmployeeSort } from "../../api/types";
import { employeeStatusMeta } from "../util/employeeStatus";
import { formatStartDate, type SortableField } from "../util/teamSearch";
import EmployeeAvatar from "./EmployeeAvatar";

/**
 * A column.
 *
 * `sortField` being OPTIONAL is the whole design: absent means the header is
 * plain text with no click handler and no sort semantics. The source app used a
 * grid that made every column sortable by default and had to opt out, which is
 * how it shipped a header that returns 400.
 */
interface Column {
  key: string;
  label: string;
  /** Present ⇒ sortable, and this is the field the server is given. */
  sortField?: SortableField;
  align?: "center";
  width?: number;
  render: (e: Employee) => ReactNode;
}

const naText = (v: string | null | undefined) => (v && v.trim() ? v : "N/A");

const COLUMNS: readonly Column[] = [
  {
    key: "employeeId",
    label: "Employee ID",
    sortField: "employeeId",
    width: 110,
    render: (e) => <Typography sx={{ fontSize: 12.5, ...NUMERIC }}>{e.employeeId}</Typography>,
  },
  {
    key: "employee",
    label: "Employee",
    // Sorts on the concatenated name, which is what the server offers.
    sortField: "fullName",
    render: (e) => (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
        <EmployeeAvatar employee={e} />
        {/* Deliberately a real <button> with NO handler of its own. It exists to
            give the row a focusable, named target — a bare onClick on the row
            would be unreachable by keyboard and invisible to a screen reader.
            Activating it dispatches a click that bubbles to the row. */}
        <Box
          component="button"
          type="button"
          sx={{
            border: 0,
            p: 0,
            bgcolor: "transparent",
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: 13,
            fontWeight: 600,
            color: "text.primary",
            textAlign: "left",
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            // No link styling: the whole row is the target, so underlining just
            // the name would imply only that text does something. The row's
            // hover wash and pointer cursor carry the affordance instead.
            //
            // The focus ring stays — it is the only thing telling a keyboard
            // user where they are.
            "&:focus-visible": { outline: 2, outlineStyle: "solid", outlineColor: "primary.main" },
          }}
        >
          {`${e.firstName ?? ""} ${e.lastName ?? ""}`.trim() || e.employeeId}
        </Box>
      </Box>
    ),
  },
  {
    key: "workEmail",
    label: "Email",
    sortField: "workEmail",
    render: (e) => <Ellipsis text={e.workEmail} />,
  },
  {
    key: "designation",
    label: "Designation",
    sortField: "designation",
    render: (e) => <Ellipsis text={naText(e.designation)} />,
  },
  {
    key: "externalDesignation",
    label: "External Designation",
    // Deliberately no sortField — the server's allow-list omits it, and the
    // source app leaves this header clickable so clicking it 400s.
    render: (e) => <Ellipsis text={naText(e.externalDesignation)} />,
  },
  {
    key: "employmentType",
    label: "Employment Type",
    sortField: "employmentType",
    render: (e) => <Typography sx={{ fontSize: 12.5 }}>{naText(e.employmentType)}</Typography>,
  },
  {
    key: "startDate",
    label: "Start Date",
    sortField: "startDate",
    width: 120,
    // A missing start date reads "-" while a missing designation reads "N/A".
    // Faithful to the source; the asymmetry is deliberate.
    render: (e) => (
      <Typography sx={{ fontSize: 12.5, ...NUMERIC }}>{formatStartDate(e.startDate)}</Typography>
    ),
  },
  {
    key: "employeeStatus",
    label: "Status",
    sortField: "employeeStatus",
    align: "center",
    width: 130,
    render: (e) => {
      const meta = employeeStatusMeta(e.employeeStatus);
      return (
        <Chip
          label={meta.label}
          color={meta.color}
          size="small"
          variant="outlined"
          sx={{ height: 20, fontSize: 10.5, fontWeight: 600, borderWidth: 1.5 }}
        />
      );
    },
  },
];

/** Truncating text with the full value available on hover. */
function Ellipsis({ text }: { text: string }) {
  return (
    <Tooltip title={text} enterDelay={600}>
      <Typography
        sx={{
          fontSize: 12.5,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          maxWidth: 240,
        }}
      >
        {text}
      </Typography>
    </Tooltip>
  );
}

export default function MyTeamTable({
  employees,
  total,
  page,
  pageSize,
  sort,
  isFetching,
  hasFilters,
  onSort,
  onPageChange,
  onClearFilters,
}: {
  employees: Employee[];
  total: number;
  page: number;
  pageSize: number;
  sort: EmployeeSort;
  isFetching: boolean;
  hasFilters: boolean;
  onSort: (field: SortableField) => void;
  onPageChange: (page: number) => void;
  onClearFilters: () => void;
}): JSX.Element {
  const navigate = useNavigate();
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const open = (e: Employee) =>
    navigate(`/me/my-team/${encodeURIComponent(e.employeeId)}`);

  // Two different nothings. Landing past the end happens when the list shrinks
  // underneath you — a filter change elsewhere, or someone leaving.
  const strandedPastEnd = employees.length === 0 && total > 0;

  return (
    <>
      <Panel>
        {/* Kept rather than replaced by a skeleton: the rows stay put while the
            next page loads, so nothing jumps. */}
        <Box sx={{ height: 2 }}>{isFetching && <LinearProgress sx={{ height: 2 }} />}</Box>
        <Box
          sx={{
            opacity: isFetching ? 0.6 : 1,
            pointerEvents: isFetching ? "none" : "auto",
            transition: "opacity .15s",
          }}
        >
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {COLUMNS.map((col) => {
                    const active = col.sortField !== undefined && sort.sortField === col.sortField;
                    const direction = sort.sortOrder === "DESC" ? "desc" : "asc";
                    return (
                      <TableCell
                        key={col.key}
                        align={col.align}
                        sx={{ ...TH, ...(col.width ? { width: col.width } : {}) }}
                        // Gives aria-sort for free. A non-sortable column gets
                        // `false`, which is the honest answer.
                        sortDirection={active ? direction : false}
                      >
                        {col.sortField ? (
                          <TableSortLabel
                            active={active}
                            direction={active ? direction : "asc"}
                            onClick={() => onSort(col.sortField as SortableField)}
                          >
                            {col.label}
                          </TableSortLabel>
                        ) : (
                          col.label
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              </TableHead>
              <TableBody>
                {employees.map((e) => (
                  // The whole row is the click target. The employee's name inside
                  // it is still a real <button>, which is what makes the row
                  // reachable by keyboard: focusing the name and pressing Enter
                  // fires a click that bubbles up to this handler. So there is one
                  // navigation path, not two, and no need to stop propagation.
                  <TableRow
                    key={e.employeeId}
                    hover
                    onClick={() => open(e)}
                    sx={{ cursor: "pointer" }}
                  >
                    {COLUMNS.map((col) => (
                      <TableCell key={col.key} align={col.align}>
                        {col.render(e)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>

          {employees.length === 0 &&
            (strandedPastEnd ? (
              <Box sx={{ textAlign: "center", py: 4 }}>
                <Typography sx={{ fontSize: 13, color: "text.disabled", mb: 1.5 }}>
                  This page is empty — the list changed while you were on it.
                </Typography>
                <Button size="small" variant="outlined" onClick={() => onPageChange(pageCount)}>
                  Go to the last page
                </Button>
              </Box>
            ) : hasFilters ? (
              <Box sx={{ textAlign: "center", py: 4 }}>
                <Typography sx={{ fontSize: 13, color: "text.disabled", mb: 1.5 }}>
                  No one matches these filters.
                </Typography>
                <Button size="small" variant="outlined" onClick={onClearFilters}>
                  Clear filters
                </Button>
              </Box>
            ) : (
              <Empty>No reports found.</Empty>
            ))}

          </Box>
      </Panel>

      {/* Outside the Panel on purpose: PagingFooter carries its own top margin
          and no horizontal padding, so nested inside a bordered, overflow-hidden
          panel its first character sits flush against the border. The existing
          consumer places it below the panel too. */}
      {total > 0 && (
        <PagingFooter
          page={page}
          pageSize={pageSize}
          total={total}
          pageCount={pageCount}
          onPageChange={onPageChange}
        />
      )}
    </>
  );
}
