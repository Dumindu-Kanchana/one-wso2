/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { Box, TextField, Typography } from "@wso2/oxygen-ui";

// One date input, shared by the general and sabbatical apply forms.
//
// The source uses MUI X's DatePicker; the port uses a native `type="date"`
// throughout, so its `minDate` / `maxDate` / `disablePast` / `disableFuture`
// props arrive here as plain `min` and `max` ISO bounds and its `slotProps
// .textField.error` / `.helperText` as `error` and `helperText`.
export default function LeaveDateField({
  label,
  value,
  min,
  max,
  disabled = false,
  error = false,
  helperText,
  onChange,
}: {
  label: string;
  value: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  error?: boolean;
  helperText?: string;
  onChange?: (v: string) => void;
}) {
  return (
    <Box>
      <Typography sx={{ fontSize: 11, color: "text.secondary", mb: 0.375 }}>{label}</Typography>
      <TextField
        type="date"
        size="small"
        fullWidth
        value={value}
        disabled={disabled}
        error={error}
        helperText={helperText}
        onChange={(e) => onChange?.(e.target.value)}
        // On the input, not the wrapper. The visible text above is a plain
        // Typography, so without this the field has no accessible name at all —
        // the source's DatePicker carries one via its `label` prop.
        inputProps={{ min, max, "aria-label": label }}
      />
    </Box>
  );
}
