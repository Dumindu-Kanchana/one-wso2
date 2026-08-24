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

import PeopleOpsShell from "../components/PeopleOpsShell";
import EmployeeReportTable from "../reports/EmployeeReportTable";
import { REPORTS_EYEBROW } from "../reports/reportRoutes";
import { EmployeeStatus } from "../api/peopleOpsTypes";

// The Active Employees report, ported from people-app's
// view/reports/ActiveEmployeesReportView. Everything specific to "active" is
// here; EmployeeReportTable holds what this shares with the Resignations
// report that follows it.
//
// Two defaults distinguish this report, and both are ON:
//  - excludeFutureStartDate — accepted offers who haven't joined yet are not
//    part of the active headcount.
//  - includeMarkedLeavers — people serving notice still are. "Marked leaver"
//    is a separate status from "Left", and excluding them would undercount.
export default function ActiveEmployeesReportPage() {
  return (
    <PeopleOpsShell
      eyebrow={REPORTS_EYEBROW}
      title="Active employees"
      subtitle="Everyone currently employed, with the filters and columns you choose. Preview here, then export the full dataset as CSV."
    >
      <EmployeeReportTable
        employeeStatus={EmployeeStatus.Active}
        countChipLabel="Total active"
        downloadFilenamePrefix="active-employees"
        showExcludeFutureFilter
        showIncludeMarkedLeaversFilter
        defaultIncludeMarkedLeavers
        previewAlertText={
          <>
            Search or filter to narrow the list, and select an employee to see
            their full record. Export CSV downloads every matching row with the
            columns you've chosen.
          </>
        }
      />
    </PeopleOpsShell>
  );
}
