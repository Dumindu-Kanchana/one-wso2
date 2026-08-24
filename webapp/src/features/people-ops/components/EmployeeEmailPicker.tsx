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

import { useMemo } from "react";
import {
  Autocomplete,
  Avatar,
  Box,
  CircularProgress,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { fullName, initialsOf } from "@features/my/api/derive";
import type { EmployeeBasicInfo } from "../api/peopleOpsTypes";
import { useEmployeesBasicInfo } from "../api/useOrgChartEntities";
import {
  buildPickerOptions,
  findSelectedOption,
  emailKey,
  isSynthetic,
} from "./employeePickerOptions";

// Pick a person by their work email.
//
// The value is the EMAIL, not the employee: that is what every consumer
// stores (an org entity's headEmail is a string column), so the picker
// resolves an email to a person for display and hands an email back.
//
// Options come from GET /employees/basic-info, which returns ACTIVE
// employees only — the backend filters on employee_status itself, so
// somebody who has left cannot be appointed as a head.
//
// One exception to that, and it is the reason for the synthetic-option code
// below: an entity may ALREADY have a head who has since left. Dropping the
// stored value because it is not in the option list would silently blank a
// field just by opening the dialog, so it is kept and marked instead.
//
// This is the first people-picker in One WSO2; it is deliberately generic
// (label, value, onChange) so the manager filter and the hierarchy tab can
// use it rather than growing their own.

export interface EmployeeEmailPickerProps {
  label: string;
  /** The selected work email; "" when none. */
  value: string;
  onChange: (email: string) => void;
  onBlur?: () => void;
  error?: boolean;
  helperText?: React.ReactNode;
  disabled?: boolean;
  /** Defer fetching the roster until the field can actually be used. */
  enabled?: boolean;
}

export default function EmployeeEmailPicker({
  label,
  value,
  onChange,
  onBlur,
  error,
  helperText,
  disabled,
  enabled = true,
}: EmployeeEmailPickerProps) {
  const employees = useEmployeesBasicInfo(enabled);

  const options = useMemo(
    () => buildPickerOptions(employees.data ?? [], value),
    [employees.data, value],
  );

  const selected = useMemo(() => findSelectedOption(options, value), [options, value]);

  return (
    <Autocomplete<EmployeeBasicInfo, false, false, false>
      options={options}
      value={selected}
      onChange={(_, option) => onChange(option?.workEmail ?? "")}
      onBlur={onBlur}
      disabled={disabled}
      loading={employees.isPending}
      autoHighlight
      size="small"
      // Both halves are searchable: people look for a colleague by name and
      // by address, and matching only one of them fails half the time.
      getOptionLabel={(option) =>
        isSynthetic(option)
          ? option.workEmail
          : `${fullName(option)} <${option.workEmail}>`
      }
      isOptionEqualToValue={(a, b) => emailKey(a.workEmail) === emailKey(b.workEmail)}
      slotProps={{ listbox: { style: { maxHeight: 280 } } }}
      renderOption={(props, option) => {
        // React requires the key as a prop, not inside a spread.
        const { key, ...liProps } = props as typeof props & { key: string };
        return (
          <Box
            component="li"
            key={key}
            {...liProps}
            sx={{ display: "flex", alignItems: "center", gap: 1.25, py: 0.75 }}
          >
            <Avatar
              src={option.employeeThumbnail ?? undefined}
              sx={{ width: 28, height: 28, fontSize: 11, fontWeight: 700, flexShrink: 0 }}
            >
              {isSynthetic(option) ? "?" : initialsOf(option)}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 600,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {isSynthetic(option) ? option.workEmail : fullName(option)}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  display: "block",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {/* Says why someone appears who is not on the roster,
                    instead of leaving a nameless address unexplained. */}
                {isSynthetic(option) ? "No longer an active employee" : option.workEmail}
              </Typography>
            </Box>
          </Box>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          error={error}
          helperText={helperText}
          slotProps={{
            input: {
              ...params.InputProps,
              endAdornment: (
                <>
                  {employees.isPending ? <CircularProgress size={14} /> : null}
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
