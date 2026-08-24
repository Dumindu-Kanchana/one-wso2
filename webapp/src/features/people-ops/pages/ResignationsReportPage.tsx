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
import { EmployeeStatus } from "../api/peopleOpsTypes";
import { REPORTS_EYEBROW } from "../reports/reportRoutes";

// The Resignations report, ported from people-app's
// view/reports/ResignationReportView. Everything it needs beyond the shared
// table follows from the status: passing EmployeeStatus.Left adds the four
// resignation columns (date, final day in office, final day of employment,
// reason) to the column selector, and makes the backend build its resignation
// CSV rather than the standard employee one — it branches on
// filters.employeeStatus, which the table already sends.
//
// Both of the Active report's toggles are off here, for the same reason in
// each case: they ask questions that don't apply to someone who has left.
// "Exclude future joiners" would filter on a start date that is by definition
// in the past, and "include marked leavers" is about people still serving
// notice — who are Active, and so belong to the other report.
export default function ResignationsReportPage() {
  return (
    <PeopleOpsShell
      eyebrow={REPORTS_EYEBROW}
      title="Resignations"
      subtitle="Everyone who has left, with their resignation dates and reasons. Preview here, then export the full dataset as CSV."
    >
      <EmployeeReportTable
        employeeStatus={EmployeeStatus.Left}
        countChipLabel="Total resigned"
        downloadFilenamePrefix="resigned-employees"
        showExcludeFutureFilter={false}
        previewAlertText={
          <>
            Search or filter to narrow the list, and select someone to see their
            full record. Export CSV downloads every matching row, including
            resignation dates and reasons.
          </>
        }
      />
    </PeopleOpsShell>
  );
}
