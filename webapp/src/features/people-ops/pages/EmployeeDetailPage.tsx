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

import { Alert, Box, Button } from "@wso2/oxygen-ui";
import { ArrowLeftIcon } from "@wso2/oxygen-ui-icons-react";
import { Link as RouterLink, useParams } from "react-router";
import { useMeProfile } from "@features/my/api/useMeProfile";
import ProfileHero from "@features/my/components/ProfileHero";
import GeneralInfo from "@features/my/components/GeneralInfo";
import PersonalInfo from "@features/my/components/PersonalInfo";
import EmergencyContacts from "@features/my/components/EmergencyContacts";
import { describeError } from "@api/errors";
import PeopleOpsShell from "../components/PeopleOpsShell";
import SectionHeader from "../components/SectionHeader";
import { ACTIVE_EMPLOYEES_REPORT_PATH } from "../reports/reportRoutes";

// One employee's full record, reached by clicking a row in a report.
//
// This is the same reuse people-app makes: its EmployeeDetail is a one-liner
// that renders the Me profile view with an employee id and `readOnly`. So this
// composes the same four profile cards rather than duplicating them, and
// passes viewOnly so none of them offers an edit affordance — these are
// someone else's details.
//
// ConnectedServices is deliberately NOT here, unlike on the Me page. It reads
// the signed-in user from useUserInfo internally, so it would render the
// viewer's own vehicles and promotions beside a colleague's profile. Its
// vehicles card could not work here anyway: GET /employees/{email}/vehicles is
// self-only server-side, with no admin bypass.
export default function EmployeeDetailPage() {
  const { employeeId } = useParams<{ employeeId: string }>();
  const { data, isLoading, isError, error } = useMeProfile(employeeId);

  const employee = data?.employee;
  const personalInfo = data?.personalInfo;

  return (
    <PeopleOpsShell
      eyebrow="📊 Reports"
      title={employee ? `${employee.firstName} ${employee.lastName}` : "Employee"}
      subtitle={employee?.workEmail ?? "Loading employee record…"}
    >
      <Box sx={{ mb: 2 }}>
        <Button
          component={RouterLink}
          to={ACTIVE_EMPLOYEES_REPORT_PATH}
          size="small"
          startIcon={<ArrowLeftIcon size={16} />}
        >
          Back to active employees
        </Button>
      </Box>

      {/* A missing :employeeId means the route matched with an empty param —
          say so rather than firing a request for undefined. */}
      {!employeeId && <Alert severity="warning">No employee was specified.</Alert>}

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Couldn't load this employee. {describeError(error)}
        </Alert>
      )}

      {employeeId && !isError && (
        <>
          {/* userInfo is intentionally omitted: ProfileHero falls back to it
              for name/avatar, which would paint the VIEWER's identity over a
              colleague's record whenever the employee fetch is still in
              flight or came back empty. */}
          <ProfileHero employee={employee} isLoading={isLoading} />

          <SectionHeader>General information</SectionHeader>
          <GeneralInfo employee={employee} isLoading={isLoading} />

          <SectionHeader>Personal information</SectionHeader>
          <PersonalInfo personalInfo={personalInfo} isLoading={isLoading} viewOnly />

          <SectionHeader>Emergency contacts</SectionHeader>
          <EmergencyContacts
            contacts={personalInfo?.emergencyContacts ?? undefined}
            isLoading={isLoading}
            viewOnly
          />
        </>
      )}
    </PeopleOpsShell>
  );
}
