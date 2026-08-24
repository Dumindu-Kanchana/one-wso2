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
import { Avatar } from "@wso2/oxygen-ui";
import type { Employee } from "../../api/types";

// The employee photo, with an initial as the fallback.
//
// Its own file for one reason: `referrerPolicy: "no-referrer"`. Thumbnails are
// often Google-hosted and 403 without it, which is exactly the attribute that
// gets dropped on the second copy — and then every photo silently becomes a
// letter.
export default function EmployeeAvatar({
  employee,
  size = 32,
}: {
  employee: Pick<Employee, "firstName" | "employeeThumbnail">;
  size?: number;
}) {
  const initial = employee.firstName?.trim()?.[0]?.toUpperCase() ?? "E";
  return (
    <Avatar
      src={employee.employeeThumbnail ?? undefined}
      imgProps={{ referrerPolicy: "no-referrer" }}
      sx={{ width: size, height: size, fontSize: size * 0.4, fontWeight: 600 }}
    >
      {initial}
    </Avatar>
  );
}
