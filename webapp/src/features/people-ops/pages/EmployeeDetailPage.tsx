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
import { useLocation, useNavigate, useParams } from "react-router";
import { useMeProfile, useMePersonalInfo } from "@features/my/api/useMeProfile";
import ProfileHero from "@features/my/components/ProfileHero";
import GeneralInfo from "@features/my/components/GeneralInfo";
import PersonalInfo from "@features/my/components/PersonalInfo";
import EmergencyContacts from "@features/my/components/EmergencyContacts";
import { describeError } from "@api/errors";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import PeopleOpsShell from "../components/PeopleOpsShell";
import { usePeopleOpsGate } from "../api/usePeopleOpsGate";
import SectionHeader from "../components/SectionHeader";
import { ACTIVE_EMPLOYEES_REPORT_PATH, REPORTS_EYEBROW } from "../reports/reportRoutes";

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
  // Held until the admin check has actually passed. PeopleOpsShell gates its
  // CHILDREN, so a fetch started here would already have completed by the
  // time the shell decided to hide the page — a guard in appearance only.
  // The backend permits a lead to read their own subordinate, so a lead
  // reaching this URL got a 200 and a cached record for a page they were not
  // allowed to see. Nothing they could not read on My Team, but the request
  // should not have been made.
  const gate = usePeopleOpsGate();
  // `Boolean(employeeId)` as well as the gate: both hooks fall back to the
  // viewer's own employee id when none is passed, so an empty :employeeId would
  // fetch and cache the viewer's own record behind a page that says no employee
  // was specified.
  const wanted = gate.isAdmin && Boolean(employeeId);
  const { data, isLoading, isError, error } = useMeProfile(employeeId, wanted);
  const navigate = useNavigate();
  const location = useLocation();

  const employee = data?.employee;
  // Personal details are their own request now. Fetched up front here, unlike
  // the Me overview: this page exists to review one person's full record, and
  // it is already behind the admin gate that authorises reading it.
  const personal = useMePersonalInfo(employeeId, wanted);
  const personalInfo = personal.data;

  // Both reports link here, so a fixed path would send someone who arrived
  // from Resignations to Active Employees — and either way, a fresh link
  // loses the search and filters they had set. Going back through history
  // returns them to the exact list they left.
  //
  // `location.key` is "default" only on a first entry with no history to pop
  // (a pasted URL, a new tab). There, fall back to the Active report, which
  // is at least a sensible landing place.
  const cameFromAList = location.key !== "default";
  const goBack = () =>
    cameFromAList ? navigate(-1) : navigate(ACTIVE_EMPLOYEES_REPORT_PATH);

  return (
    <PeopleOpsShell
      eyebrow={REPORTS_EYEBROW}
      title={employee ? `${employee.firstName} ${employee.lastName}` : "Employee"}
      subtitle={employee?.workEmail ?? "Loading employee record…"}
    >
      <Box sx={{ mb: 2 }}>
        <Button size="small" onClick={goBack} startIcon={<ArrowLeftIcon size={16} />}>
          {cameFromAList ? "Back" : "Back to active employees"}
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

          {/* Its own request, so its own failure. Without this a failed fetch
              reads as an employee with no personal details on file. */}
          {personal.isError && (
            <ErrorNotice
              error={personal.error}
              onRetry={() => personal.refetch()}
              retrying={personal.isFetching}
              sx={{ mb: 2 }}
            >
              Couldn't load this employee's personal information.
            </ErrorNotice>
          )}

          <SectionHeader>Personal information</SectionHeader>
          <PersonalInfo personalInfo={personalInfo} isLoading={personal.isPending} viewOnly />

          <SectionHeader>Emergency contacts</SectionHeader>
          <EmergencyContacts
            contacts={personalInfo?.emergencyContacts ?? undefined}
            isLoading={personal.isPending}
            viewOnly
          />
        </>
      )}
    </PeopleOpsShell>
  );
}
