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
import { Box, Button, Chip, Skeleton, Typography } from "@wso2/oxygen-ui";
import { ArrowLeftIcon } from "@wso2/oxygen-ui-icons-react";
import { Link as RouterLink, useParams } from "react-router";
import { HttpError } from "@api/http";
import FieldGrid, { type FieldDef } from "../../components/FieldGrid";
import SectionHeader from "../../../people-ops/components/SectionHeader";
import { display, formatDate, fullName, serviceLength } from "../../api/derive";
import { useTeamMember } from "../api/useTeamSearch";
import { employeeStatusMeta } from "../util/employeeStatus";
import EmployeeAvatar from "../components/EmployeeAvatar";
import ErrorNotice from "@components/error-notice/ErrorNotice";

// One team member's record, read-only.
//
// There is no client-side lead check here on purpose: the server's rule is more
// specific than ours — admin, yourself, or someone in your own subtree — so we
// ask and then handle its answer. A capability check would only duplicate it
// less accurately.
//
// This page shows job information ONLY. It deliberately does not show, request,
// or link to personal details — NIC or passport, date of birth, gender,
// nationality, personal email or phone, home address, emergency contacts.
//
// A lead needs to know who reports to them, their designation and their dates.
// None of that requires their subordinate's identity documents or home address,
// and a page that will fetch them on request is a page that eventually does.
// Anyone with a genuine need has People Ops > Employee detail, which shows
// personal information behind the admin gate that governs it.
//
// `useTeamMemberPersonalInfo` was removed with it rather than left unused: a
// hook that fetches PII and has no caller is an invitation.
export default function TeamMemberPage() {
  const { employeeId } = useParams<{ employeeId: string }>();
  const member = useTeamMember(employeeId);

  const back = (
    <Button
      component={RouterLink}
      to="/me/my-team"
      size="small"
      startIcon={<ArrowLeftIcon size={16} />}
      sx={{ textTransform: "none", alignSelf: "flex-start", mb: 1 }}
    >
      My Team
    </Button>
  );

  if (member.isLoading) {
    return (
      <Box>
        {back}
        <Skeleton variant="rectangular" height={220} sx={{ borderRadius: 1.5 }} />
      </Box>
    );
  }

  if (member.isError) {
    const status = member.error instanceof HttpError ? member.error.status : undefined;
    return (
      <Box>
        {back}
        <ErrorNotice
          severity={status === 403 || status === 404 ? "info" : "error"}
          error={status === 403 || status === 404 ? undefined : member.error}
          onRetry={status === 403 || status === 404 ? undefined : () => member.refetch()}
        >
          {status === 403
            ? "You don't have access to this employee's record."
            : status === 404
              ? "That employee doesn't exist."
              : "Couldn't load this employee."}
        </ErrorNotice>
      </Box>
    );
  }

  const e = member.data;
  if (!e) return null;
  const status = employeeStatusMeta(e.employeeStatus);

  const jobFields: FieldDef[] = [
    { label: "Employee ID", value: display(e.employeeId) },
    { label: "Work email", value: display(e.workEmail) },
    { label: "Designation", value: display(e.designation) },
    { label: "External designation", value: display(e.externalDesignation) },
    { label: "Employment type", value: display(e.employmentType) },
    { label: "Job band", value: display(e.jobBand) },
    { label: "Company", value: display(e.company) },
    { label: "Office", value: display(e.office) },
    { label: "Business unit", value: display(e.businessUnit) },
    { label: "Team", value: display(e.team) },
    { label: "Sub team", value: display(e.subTeam) },
    { label: "Unit", value: display(e.unit) },
    { label: "Start date", value: formatDate(e.startDate) },
    { label: "Length of service", value: serviceLength(e.startDate) },
    { label: "Probation ends", value: formatDate(e.probationEndDate) },
    { label: "Agreement ends", value: formatDate(e.agreementEndDate) },
    { label: "Reports to", value: display(e.managerName ?? e.managerEmail) },
    // A single comma-separated string on the wire, not a list.
    { label: "Additional leads", value: display(e.additionalManagerEmails) },
    { label: "Subordinates", value: display(e.subordinateCount) },
  ];

  // Only meaningful for someone on their way out — omitted entirely otherwise
  // rather than shown as a row of dashes.
  if (e.resignationDate || e.finalDayOfEmployment) {
    jobFields.push(
      { label: "Resignation date", value: formatDate(e.resignationDate) },
      { label: "Final day in office", value: formatDate(e.finalDayInOffice) },
      { label: "Final day of employment", value: formatDate(e.finalDayOfEmployment) },
    );
  }

  return (
    <Box>
      {back}

      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
        <EmployeeAvatar employee={e} size={56} />
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography component="h1" variant="h5">
              {fullName(e)}
            </Typography>
            <Chip
              label={status.label}
              color={status.color}
              size="small"
              variant="outlined"
              sx={{ height: 20, fontSize: 10.5, fontWeight: 600, borderWidth: 1.5 }}
            />
          </Box>
          <Typography variant="body2" color="text.secondary">
            {display(e.designation)} · {display(e.workEmail)}
          </Typography>
        </Box>
      </Box>

      <SectionHeader id="member-job">Job information</SectionHeader>
      <FieldGrid fields={jobFields} />

    </Box>
  );
}
