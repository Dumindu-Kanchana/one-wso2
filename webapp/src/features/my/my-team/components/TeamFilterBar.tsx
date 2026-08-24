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
  Badge,
  Box,
  Button,
  Chip,
  FormControlLabel,
  InputAdornment,
  OutlinedInput,
  Skeleton,
  Switch,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { FilterIcon, SearchIcon, XIcon } from "@wso2/oxygen-ui-icons-react";
import type { OrgOption, OrgReference } from "../../api/orgTypes";
import {
  DEFAULT_FILTERS,
  activeFilterCount,
  type AppliedFilters,
  type SearchInputProblem,
} from "../util/teamSearch";

// The toolbar above the table: search, the direct-reports switch, the Filters
// button, and a chip for each applied filter.
//
// The chip row is DERIVED from the applied filters, so it is right on the first
// paint and after a deep link. The source app hid the entire row until the user
// had opened its dialog and pressed Apply at least once.

/** Human labels for the chips, keyed by filter. */
function describeChips(filters: AppliedFilters, reference: OrgReference): {
  key: keyof AppliedFilters;
  label: string;
}[] {
  const byId = (options: OrgOption[], id: number | null) =>
    options.find((o) => o.id === id)?.label ?? String(id);

  const chips: { key: keyof AppliedFilters; label: string }[] = [];
  const add = (key: keyof AppliedFilters, label: string) => chips.push({ key, label });

  if (filters.businessUnitId !== null)
    add("businessUnitId", `Business Unit: ${byId(reference.businessUnits, filters.businessUnitId)}`);
  if (filters.teamId !== null) add("teamId", `Team: ${byId(reference.teams, filters.teamId)}`);
  if (filters.subTeamId !== null)
    add("subTeamId", `Sub Team: ${byId(reference.subTeams, filters.subTeamId)}`);
  if (filters.unitId !== null) add("unitId", `Unit: ${byId(reference.units, filters.unitId)}`);
  if (filters.careerFunctionId !== null)
    add(
      "careerFunctionId",
      `Career Function: ${byId(reference.careerFunctions, filters.careerFunctionId)}`,
    );
  if (filters.designationId !== null)
    add("designationId", `Designation: ${byId(reference.designations, filters.designationId)}`);
  if (filters.companyId !== null)
    add("companyId", `Company: ${byId(reference.companies, filters.companyId)}`);
  if (filters.officeId !== null) add("officeId", `Office: ${byId(reference.offices, filters.officeId)}`);
  if (filters.employmentTypeId !== null)
    add(
      "employmentTypeId",
      `Employment Type: ${byId(reference.employmentTypes, filters.employmentTypeId)}`,
    );
  if (filters.managerEmail !== null) add("managerEmail", `Manager: ${filters.managerEmail}`);
  if (filters.gender !== null) add("gender", `Gender: ${filters.gender}`);

  // Only when it differs from the default, so the everyday case shows no chip.
  const statuses = filters.employeeStatuses;
  const defaults = DEFAULT_FILTERS.employeeStatuses;
  const sameStatuses =
    statuses.length === defaults.length && [...statuses].sort().every((s, i) => s === [...defaults].sort()[i]);
  if (!sameStatuses) {
    add("employeeStatuses", statuses.length ? `Status: ${statuses.join(", ")}` : "Status: any");
  }
  if (filters.directReports) add("directReports", "Direct reports only");
  // Shown when turned OFF, because off is the non-default. In the source app
  // this filter changed the result while appearing inactive.
  if (!filters.excludeFutureStartDate) add("excludeFutureStartDate", "Including future joiners");

  return chips;
}

export default function TeamFilterBar({
  filters,
  reference,
  search,
  searchProblem,
  total,
  filtered,
  isTotalLoading,
  onSearchChange,
  onToggleDirectReports,
  onOpenFilters,
  onRemoveChip,
  onClearFilters,
}: {
  filters: AppliedFilters;
  reference: OrgReference;
  search: string;
  searchProblem: SearchInputProblem;
  total: number | undefined;
  filtered: number | undefined;
  isTotalLoading: boolean;
  onSearchChange: (value: string) => void;
  onToggleDirectReports: (value: boolean) => void;
  onOpenFilters: () => void;
  onRemoveChip: (key: keyof AppliedFilters) => void;
  onClearFilters: () => void;
}) {
  const count = activeFilterCount(filters);
  const chips = describeChips(filters, reference);

  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1.5 }}>
        <Box>
          <OutlinedInput
            size="small"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search your team"
            startAdornment={
              <InputAdornment position="start">
                <SearchIcon size={15} />
              </InputAdornment>
            }
            endAdornment={
              search ? (
                <InputAdornment position="end">
                  <Box
                    component="button"
                    type="button"
                    aria-label="Clear search"
                    onClick={() => onSearchChange("")}
                    sx={{
                      border: 0,
                      bgcolor: "transparent",
                      cursor: "pointer",
                      display: "inline-flex",
                      color: "text.secondary",
                      p: 0,
                    }}
                  >
                    <XIcon size={13} />
                  </Box>
                </InputAdornment>
              ) : undefined
            }
            error={searchProblem !== null}
            sx={{ height: 36, fontSize: 13, width: { xs: "100%", sm: 300 } }}
          />
          {searchProblem && (
            <Typography variant="caption" color="error" sx={{ display: "block", mt: 0.25 }}>
              {searchProblem === "length"
                ? "Search is limited to 100 characters."
                : "Letters, numbers, spaces and @ . _ - ' + only."}
            </Typography>
          )}
        </Box>

        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={filters.directReports}
              onChange={(e) => onToggleDirectReports(e.target.checked)}
            />
          }
          label={<Typography variant="body2">Direct reports only</Typography>}
        />

        <Tooltip title={count === 0 ? "Open filters" : `${count} filter${count > 1 ? "s" : ""} active`}>
          <Badge badgeContent={count} color="primary">
            <Button
              size="small"
              variant="outlined"
              startIcon={<FilterIcon size={15} />}
              onClick={onOpenFilters}
              sx={{ textTransform: "none", fontWeight: 600 }}
            >
              Filters
            </Button>
          </Badge>
        </Tooltip>

        <Box sx={{ flex: 1 }} />

        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Total
          </Typography>
          {isTotalLoading ? (
            <Skeleton variant="rounded" width={24} height={14} />
          ) : (
            <Chip label={total ?? "—"} size="small" color="primary" variant="outlined" sx={{ height: 20 }} />
          )}
          {filtered !== undefined && (
            <>
              <Typography variant="caption" color="text.secondary">
                Filtered
              </Typography>
              <Chip label={filtered} size="small" variant="outlined" sx={{ height: 20 }} />
            </>
          )}
        </Box>
      </Box>

      {chips.length > 0 && (
        <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0.75, mt: 1.5 }}>
          {chips.map((c) => (
            <Chip
              key={String(c.key)}
              label={c.label}
              size="small"
              variant="outlined"
              onDelete={() => onRemoveChip(c.key)}
              sx={{ height: 22, fontSize: 11 }}
            />
          ))}
          <Button size="small" onClick={onClearFilters} sx={{ textTransform: "none", fontSize: 12 }}>
            Clear filters
          </Button>
        </Box>
      )}
    </Box>
  );
}
