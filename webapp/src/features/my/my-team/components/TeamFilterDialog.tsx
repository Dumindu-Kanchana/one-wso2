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
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Switch,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { EMPLOYEE_STATUS_FILTERS, type EmployeeStatusFilter } from "../../api/types";
import { GENDER_OPTIONS, type OrgOption, type OrgReference } from "../../api/orgTypes";
import {
  DEFAULT_FILTERS,
  clearDependentFilters,
  type AppliedFilters,
} from "../util/teamSearch";

// The filter dialog.
//
// It owns a DRAFT and nothing else reaches the query until Apply. The draft is
// seeded once, at mount — the parent mounts this only while open and keys it on
// the applied filters, so there is no effect that could re-seed it mid-edit.
// The source app re-seeded whenever the applied filters changed identity, which
// silently discarded work in progress.
//
// One control and one config array replace the source's eleven hand-written
// filter arms and its eleven-case switch.

/** Which draft key each org list feeds, and what it depends on. */
type OrgFilterKey =
  | "businessUnitId"
  | "teamId"
  | "subTeamId"
  | "unitId"
  | "careerFunctionId"
  | "designationId"
  | "companyId"
  | "officeId"
  | "employmentTypeId";

const ORG_FILTERS: readonly {
  key: OrgFilterKey;
  label: string;
  options: (ref: OrgReference) => OrgOption[];
  /** Shown in the help text when the parent narrows this list. */
  narrowedBy?: string;
}[] = [
  { key: "businessUnitId", label: "Business Unit", options: (r) => r.businessUnits },
  { key: "teamId", label: "Team", options: (r) => r.teams, narrowedBy: "Business Unit" },
  { key: "subTeamId", label: "Sub Team", options: (r) => r.subTeams, narrowedBy: "Team" },
  { key: "unitId", label: "Unit", options: (r) => r.units, narrowedBy: "Sub Team" },
  { key: "careerFunctionId", label: "Career Function", options: (r) => r.careerFunctions },
  {
    key: "designationId",
    label: "Designation",
    options: (r) => r.designations,
    narrowedBy: "Career Function",
  },
  { key: "companyId", label: "Company", options: (r) => r.companies },
  { key: "officeId", label: "Office", options: (r) => r.offices, narrowedBy: "Company" },
  { key: "employmentTypeId", label: "Employment Type", options: (r) => r.employmentTypes },
];

export default function TeamFilterDialog({
  initial,
  reference,
  onSelectionChange,
  onApply,
  onClose,
}: {
  initial: AppliedFilters;
  reference: OrgReference;
  /** Lets the parent narrow the option lists as parents are picked. */
  onSelectionChange: (draft: AppliedFilters) => void;
  onApply: (filters: AppliedFilters) => void;
  onClose: () => void;
}) {
  // Seeded once, at mount. See the note above.
  const [draft, setDraft] = useState<AppliedFilters>(initial);

  const update = <K extends keyof AppliedFilters>(key: K, value: AppliedFilters[K]) => {
    const next = clearDependentFilters(draft, key, value);
    setDraft(next);
    onSelectionChange(next);
  };

  const clearAll = () => {
    setDraft(DEFAULT_FILTERS);
    onSelectionChange(DEFAULT_FILTERS);
  };

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontSize: 17, fontWeight: 700 }}>Filters</DialogTitle>
      <DialogContent dividers>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(3, 1fr)" },
            gap: 2,
          }}
        >
          {ORG_FILTERS.map((f) => {
            const options = f.options(reference);
            const selected = options.find((o) => o.id === draft[f.key]) ?? null;
            return (
              <Autocomplete
                key={f.key}
                size="small"
                options={options}
                value={selected}
                getOptionLabel={(o) => o.label}
                isOptionEqualToValue={(a, b) => a.id === b.id}
                onChange={(_, next) => update(f.key, next ? next.id : null)}
                loading={reference.isLoading}
                noOptionsText={
                  f.narrowedBy ? `Nothing under the selected ${f.narrowedBy}` : "No options"
                }
                renderInput={(p) => <TextField {...p} label={f.label} />}
              />
            );
          })}

          {/* Managers are chosen by email — the endpoint returns no names — so
              this one is a string, not an OrgOption. The asymmetry is kept
              visible rather than hidden behind a synthetic id. */}
          <Autocomplete
            size="small"
            options={reference.managers.map((m) => m.email)}
            value={draft.managerEmail}
            onChange={(_, next) => update("managerEmail", next ?? null)}
            loading={reference.isLoading}
            renderInput={(p) => <TextField {...p} label="Manager" />}
          />

          <Autocomplete
            size="small"
            options={[...GENDER_OPTIONS]}
            value={draft.gender}
            onChange={(_, next) => update("gender", next ?? null)}
            renderInput={(p) => <TextField {...p} label="Gender" />}
          />

          <Autocomplete
            multiple
            disableCloseOnSelect
            size="small"
            options={[...EMPLOYEE_STATUS_FILTERS]}
            value={draft.employeeStatuses}
            onChange={(_, next) => update("employeeStatuses", next as EmployeeStatusFilter[])}
            renderInput={(p) => <TextField {...p} label="Employee status" />}
          />
        </Box>

        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 3, mt: 2.5 }}>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={draft.directReports}
                onChange={(e) => update("directReports", e.target.checked)}
              />
            }
            label={<Typography variant="body2">Direct reports only</Typography>}
          />
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={draft.excludeFutureStartDate}
                onChange={(e) => update("excludeFutureStartDate", e.target.checked)}
              />
            }
            label={<Typography variant="body2">Exclude future joiners</Typography>}
          />
        </Box>

        {reference.isError && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Some option lists couldn&apos;t be loaded. The filters that did load still work.
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button size="small" onClick={clearAll}>
          Clear all
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button size="small" onClick={onClose}>
          Cancel
        </Button>
        <Button
          size="small"
          variant="contained"
          onClick={() => onApply(draft)}
          sx={{ fontWeight: 600 }}
        >
          Apply
        </Button>
      </DialogActions>
    </Dialog>
  );
}
