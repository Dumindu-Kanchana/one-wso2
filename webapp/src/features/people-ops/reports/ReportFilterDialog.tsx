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
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { XIcon } from "@wso2/oxygen-ui-icons-react";
import { EMPLOYEE_GENDERS, EmployeeStatus } from "../api/peopleOpsTypes";
import type { Filters, OrgOption } from "../api/peopleOpsTypes";
import type { OrgMasterData } from "../api/useOrgMasterData";

// The report's filter panel. People App calls this a "drawer" and renders it
// as a centred dialog; kept as a dialog here for the same reason — it holds
// three columns of controls that a side sheet would force into a long scroll.
//
// Everything is edited as a DRAFT and committed on Apply. Live-applying each
// control would refire the search (and the count) on every keystroke of an
// autocomplete, which is both wasteful and visually unstable.

export interface ReportFilterDialogProps {
  open: boolean;
  onClose: () => void;
  /** Currently applied filters — reseeds the draft each time the dialog opens. */
  applied: Filters;
  /** Commit. Receives the complete filter set, not a patch. */
  onApply: (next: Filters) => void;
  /** Reset to the report's baseline (its fixed status + default toggles). */
  onClearAll: () => void;
  masterData: OrgMasterData;
  /** Manager work-emails for the "Manager email" picker. */
  managerEmails: string[];
  /** Status is fixed by the report itself, so it is hidden by default. */
  showEmployeeStatusFilter?: boolean;
  showExcludeFutureFilter?: boolean;
  showIncludeMarkedLeaversFilter?: boolean;
}

// One id-valued dropdown. Options arrive pre-sorted and normalised to
// {id, label} by useOrgMasterData, so every org filter is identical apart
// from its label and which key it writes.
//
// Defined at module scope, not inside ReportFilterDialog: a component
// declared during render is a new type on every render, so React unmounts and
// remounts it — which in an Autocomplete means losing focus and the open
// listbox on each keystroke.
function OrgSelect({
  label,
  options,
  value,
  loading,
  onChange,
}: {
  label: string;
  options: OrgOption[];
  value: number | undefined;
  loading: boolean;
  onChange: (id: number | undefined) => void;
}) {
  return (
    <Autocomplete<OrgOption, false, false, false>
      options={options}
      getOptionLabel={(o) => o.label}
      isOptionEqualToValue={(opt, val) => opt.id === val.id}
      value={options.find((o) => o.id === value) ?? null}
      onChange={(_, selected) => onChange(selected?.id)}
      loading={loading}
      autoHighlight
      size="small"
      slotProps={{ listbox: { style: { maxHeight: 240 } } }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          slotProps={{
            input: {
              ...params.InputProps,
              endAdornment: (
                <>
                  {loading ? <CircularProgress size={14} /> : null}
                  {params.InputProps.endAdornment}
                </>
              ),
            },
          }}
        />
      )}
    />
  );
}

// Mounts the body only while open, so the draft is seeded from `applied` by
// useState on mount and thrown away on close. Same wrapper pattern as
// CcEditDialog — it replaces reseeding via an effect, which both lints as a
// cascading render and leaves a stale draft on screen for one frame.
export default function ReportFilterDialog(props: ReportFilterDialogProps) {
  return props.open ? <ReportFilterDialogBody {...props} /> : null;
}

function ReportFilterDialogBody({
  open,
  onClose,
  applied,
  onApply,
  onClearAll,
  masterData,
  managerEmails,
  showEmployeeStatusFilter = false,
  showExcludeFutureFilter = true,
  showIncludeMarkedLeaversFilter = false,
}: ReportFilterDialogProps) {
  const [draft, setDraft] = useState<Filters>(applied);

  const set = (patch: Partial<Filters>) => setDraft((prev) => ({ ...prev, ...patch }));

  const switchSx = { mr: 0 };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle
        sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1 }}
      >
        <Typography component="span" variant="h6">
          Filters
        </Typography>
        <IconButton size="small" onClick={onClose} aria-label="Close">
          <XIcon size={18} />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {masterData.isError && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Some filter options couldn't be loaded. The filters below still
            work; a dropdown with no options is one that failed to load.
          </Typography>
        )}

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
            gap: 3,
            alignItems: "start",
          }}
        >
          {/* Column 1 — Organisation. Four independent levels, not a cascade:
              the backend filters on whichever are set, and pre-filtering the
              child lists client-side would need a hierarchy the flat master
              data endpoints don't return. */}
          <Stack spacing={2}>
            <Typography variant="overline" color="text.secondary">
              Organisation
            </Typography>
            <OrgSelect
              label="Business unit"
              options={masterData.businessUnits}
              value={draft.businessUnitId}
              loading={masterData.isLoading}
              onChange={(id) => set({ businessUnitId: id })}
            />
            <OrgSelect
              label="Team"
              options={masterData.teams}
              value={draft.teamId}
              loading={masterData.isLoading}
              onChange={(id) => set({ teamId: id })}
            />
            <OrgSelect
              label="Sub team"
              options={masterData.subTeams}
              value={draft.subTeamId}
              loading={masterData.isLoading}
              onChange={(id) => set({ subTeamId: id })}
            />
            <OrgSelect
              label="Unit"
              options={masterData.units}
              value={draft.unitId}
              loading={masterData.isLoading}
              onChange={(id) => set({ unitId: id })}
            />
          </Stack>

          {/* Column 2 — Career & Location */}
          <Stack spacing={2}>
            <Typography variant="overline" color="text.secondary">
              Career
            </Typography>
            <OrgSelect
              label="Career function"
              options={masterData.careerFunctions}
              value={draft.careerFunctionId}
              loading={masterData.isLoading}
              onChange={(id) => set({ careerFunctionId: id })}
            />
            <OrgSelect
              label="Job role"
              options={masterData.designations}
              value={draft.designationId}
              loading={masterData.isLoading}
              onChange={(id) => set({ designationId: id })}
            />
            <Typography variant="overline" color="text.secondary" sx={{ pt: 1 }}>
              Location
            </Typography>
            <OrgSelect
              label="Company"
              options={masterData.companies}
              value={draft.companyId}
              loading={masterData.isLoading}
              onChange={(id) => set({ companyId: id })}
            />
            <OrgSelect
              label="Office"
              options={masterData.offices}
              value={draft.officeId}
              loading={masterData.isLoading}
              onChange={(id) => set({ officeId: id })}
            />
          </Stack>

          {/* Column 3 — Everything else */}
          <Stack spacing={2}>
            <Typography variant="overline" color="text.secondary">
              Other
            </Typography>
            <OrgSelect
              label="Employment type"
              options={masterData.employmentTypes}
              value={draft.employmentTypeId}
              loading={masterData.isLoading}
              onChange={(id) =>
                // Clear the plural sibling: the backend treats
                // employmentTypeId and employmentTypeIds as alternatives, and
                // sending both is undefined behaviour.
                set({ employmentTypeId: id, employmentTypeIds: undefined })
              }
            />

            <Autocomplete<string, false, false, false>
              options={managerEmails}
              value={managerEmails.find((e) => e === draft.managerEmail) ?? null}
              onChange={(_, selected) => set({ managerEmail: selected ?? undefined })}
              autoHighlight
              size="small"
              slotProps={{ listbox: { style: { maxHeight: 240 } } }}
              renderInput={(params) => <TextField {...params} label="Manager email" />}
            />

            <Autocomplete<string, false, false, false>
              options={[...EMPLOYEE_GENDERS]}
              value={EMPLOYEE_GENDERS.find((g) => g === draft.gender) ?? null}
              onChange={(_, selected) => set({ gender: selected ?? undefined })}
              autoHighlight
              size="small"
              renderInput={(params) => <TextField {...params} label="Gender" />}
            />

            {showEmployeeStatusFilter && (
              <Autocomplete<EmployeeStatus, false, false, false>
                options={Object.values(EmployeeStatus)}
                value={
                  Object.values(EmployeeStatus).find((s) => s === draft.employeeStatus) ?? null
                }
                onChange={(_, selected) =>
                  set({ employeeStatus: selected ?? undefined, employeeStatuses: undefined })
                }
                autoHighlight
                size="small"
                renderInput={(params) => <TextField {...params} label="Employee status" />}
              />
            )}

            {showExcludeFutureFilter && (
              <FormControlLabel
                sx={switchSx}
                control={
                  <Switch
                    checked={draft.excludeFutureStartDate === true}
                    onChange={(e) =>
                      // undefined rather than false when off: an absent key
                      // means "don't filter", and it keeps the active-filter
                      // badge from counting a switch that isn't doing anything.
                      set({ excludeFutureStartDate: e.target.checked ? true : undefined })
                    }
                  />
                }
                label={<Typography variant="body2">Exclude future joiners</Typography>}
              />
            )}

            {showIncludeMarkedLeaversFilter && (
              <FormControlLabel
                sx={switchSx}
                control={
                  <Switch
                    // Defaults ON: people serving notice are still active, so
                    // only an explicit `false` excludes them.
                    checked={draft.includeMarkedLeavers !== false}
                    onChange={(e) => set({ includeMarkedLeavers: e.target.checked })}
                  />
                }
                label={<Typography variant="body2">Include marked leavers</Typography>}
              />
            )}
          </Stack>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button variant="text" color="inherit" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="outlined"
          onClick={() => {
            onClearAll();
            onClose();
          }}
        >
          Clear all
        </Button>
        <Button
          variant="contained"
          onClick={() => {
            onApply(draft);
            onClose();
          }}
        >
          Apply
        </Button>
      </DialogActions>
    </Dialog>
  );
}
