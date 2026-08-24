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

import { Avatar, Box, Skeleton, Tooltip, Typography } from "@wso2/oxygen-ui";
import { fullName, initialsOf } from "@features/my/api/derive";
import { useEmployeesBasicInfo } from "../api/useOrgChartEntities";
import { emailKey } from "./employeePickerOptions";

// Show a stored work email as the person behind it: avatar, name, address.
//
// The same presentation EmployeeEmailPicker uses for its options, so a head
// looks the same in the table as it did when it was chosen. Reads from the
// same ["people-ops", "employees-basic-info"] query the picker fills, so on
// a screen that has opened a dialog this costs nothing, and on one that
// hasn't it is a single cached-for-30-minutes request shared by every row.
//
// Degrades in place rather than guessing: an unresolvable email (a head who
// has since left, so not in the active-only roster) renders as the address
// with a neutral avatar, which is strictly more than the bare string it
// replaces.

export interface PersonCellProps {
  /** The stored work email; "" or null renders the empty placeholder. */
  email: string | null | undefined;
  /** Shown when there is no email at all. */
  placeholder?: string;
}

export default function PersonCell({ email, placeholder = "—" }: PersonCellProps) {
  const employees = useEmployeesBasicInfo();
  const address = (email ?? "").trim();

  if (!address) {
    return (
      <Typography variant="body2" color="text.disabled">
        {placeholder}
      </Typography>
    );
  }

  const person = (employees.data ?? []).find(
    (e) => emailKey(e.workEmail) === emailKey(address),
  );

  // Hold the row's shape while the roster loads, so the table doesn't jump
  // when names arrive. Only while genuinely pending — an unresolved email
  // after loading is a real answer, not a slow one.
  if (!person && employees.isPending) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Skeleton variant="circular" width={24} height={24} />
        <Skeleton variant="text" width={140} />
      </Box>
    );
  }

  const name = person ? fullName(person) : address;
  const initials = person ? initialsOf(person) : "?";

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
      <Avatar
        src={person?.employeeThumbnail ?? undefined}
        sx={{ width: 24, height: 24, fontSize: 10, fontWeight: 700, flexShrink: 0 }}
      >
        {initials}
      </Avatar>
      {/* The address is the tooltip rather than a second line: table rows are
          a fixed height, and stacking name over email would either grow every
          row or crush both. */}
      <Tooltip title={address} arrow>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="body2"
            sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          >
            {name}
          </Typography>
        </Box>
      </Tooltip>
    </Box>
  );
}
