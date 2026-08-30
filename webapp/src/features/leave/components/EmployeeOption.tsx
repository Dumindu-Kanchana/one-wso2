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

import type { HTMLAttributes, JSX } from "react";
import { Box, Chip, Typography } from "@wso2/oxygen-ui";
import EmployeeAvatar from "@features/my/my-team/components/EmployeeAvatar";
import type { MinimalEmployeeInfo } from "../api/leaveTypes";
import { employeeDisplayName } from "../util/employeeName";

// One row of an employee picker: photo, name, address underneath.
//
// The running app renders every picker this way — NotifyPeople.tsx:168-186 for
// the Notify field and Toolbar.tsx:124-144 for the report filter. The port
// listed bare addresses, having fetched firstName, lastName and
// employeeThumbnail and then discarded them. Picking a colleague out of a list
// of addresses is materially harder than picking them out of a list of faces
// and names.
//
// EmployeeAvatar is reused rather than reached for directly: it carries
// `referrerPolicy: "no-referrer"`, without which Google-hosted thumbnails 403
// and every photo silently becomes a letter.

const STATUS_CHIP_SX = { height: 16, fontSize: "0.65rem" } as const;

export function EmployeeOption({
  employee,
  props,
  showStatus = false,
}: {
  readonly employee: MinimalEmployeeInfo;
  readonly props: HTMLAttributes<HTMLLIElement>;
  /**
   * Flags a leaver, as the report filter does (Toolbar.tsx:134-139). Only there:
   * the Notify picker never offers a leaver, so a status chip would be noise.
   */
  readonly showStatus?: boolean;
}): JSX.Element {
  const name = employeeDisplayName(employee);
  return (
    <li {...props} key={employee.workEmail} style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <EmployeeAvatar employee={employee} size={32} />
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" noWrap>
          {name}
        </Typography>
        {/* Only when it adds something — a nameless record already shows the
            address above, and repeating it reads as a rendering fault. */}
        {name !== employee.workEmail && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
            <Typography variant="caption" color="text.secondary" noWrap>
              {employee.workEmail}
            </Typography>
            {showStatus && employee.employeeStatus === "Marked leaver" && (
              <Chip label="Marked leaver" color="warning" size="small" sx={STATUS_CHIP_SX} />
            )}
            {showStatus && employee.employeeStatus === "Left" && (
              <Chip label="Left" size="small" sx={{ ...STATUS_CHIP_SX, opacity: 0.7 }} />
            )}
          </Box>
        )}
      </Box>
    </li>
  );
}
