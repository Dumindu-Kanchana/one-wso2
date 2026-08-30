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
import { useState } from "react";
import { Alert, Box, Button, Chip, Skeleton, Typography } from "@wso2/oxygen-ui";
import { ArrowLeftIcon, ChevronDownIcon, ChevronUpIcon } from "@wso2/oxygen-ui-icons-react";
import { Link as RouterLink, useParams } from "react-router";
import { HttpError } from "@api/http";
import { describeError } from "@api/errors";
import FieldGrid, { type FieldDef } from "../../components/FieldGrid";
import SectionHeader from "../../../people-ops/components/SectionHeader";
import { display, emergencyContactList, formatDate, fullName, serviceLength } from "../../api/derive";
import { useTeamMember, useTeamMemberPersonalInfo } from "../api/useTeamSearch";
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
// Personal details sit behind a disclosure and are not requested until it is
// expanded. They ARE permitted for a lead, so this is a deliberate restraint
// rather than a technical limit: opening someone's record should not pull their
// NIC, date of birth and home address along with it.
export default function TeamMemberPage() {
  const { employeeId } = useParams<{ employeeId: string }>();
  const member = useTeamMember(employeeId);
  const [showPersonal, setShowPersonal] = useState(false);
  const personal = useTeamMemberPersonalInfo(employeeId, showPersonal);

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

      <Box sx={{ mt: 4 }}>
        <Button
          size="small"
          onClick={() => setShowPersonal((v) => !v)}
          endIcon={showPersonal ? <ChevronUpIcon size={15} /> : <ChevronDownIcon size={15} />}
          sx={{ textTransform: "none", fontWeight: 600 }}
          aria-expanded={showPersonal}
        >
          {showPersonal ? "Hide personal details" : "Show personal details"}
        </Button>

        {showPersonal && (
          <Box sx={{ mt: 1.5 }}>
            {/* `isPending`, not `isLoading`: this query is disabled until the
                disclosure is expanded AND identity has resolved, and a disabled
                query reports `isPending` without `isLoading`. Keying on
                `isLoading` sent the still-resolving case to the success branch
                below, which drew every field as an em dash. */}
            {personal.isPending ? (
              <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 1.5 }} />
            ) : personal.isError ? (
              // Degrades this section alone. The job record above has already
              // rendered successfully and must not be taken down with it.
              <Alert severity="info">
                {personal.error instanceof HttpError && personal.error.status === 403
                  ? "Personal details aren't available to you."
                  : `Couldn't load personal details. ${describeError(personal.error)}`}
              </Alert>
            ) : (
              <FieldGrid
                fields={[
                  { label: "NIC or passport", value: display(personal.data?.nicOrPassport) },
                  { label: "Date of birth", value: formatDate(personal.data?.dob) },
                  { label: "Gender", value: display(personal.data?.gender) },
                  { label: "Nationality", value: display(personal.data?.nationality) },
                  { label: "Personal email", value: display(personal.data?.personalEmail) },
                  { label: "Personal phone", value: display(personal.data?.personalPhone) },
                  {
                    label: "Address",
                    span: 2,
                    value: display(
                      [
                        personal.data?.addressLine1,
                        personal.data?.addressLine2,
                        personal.data?.city,
                        personal.data?.stateOrProvince,
                        personal.data?.country,
                      ]
                        .filter(Boolean)
                        .join(", "),
                    ),
                  },
                  {
                    label: "Emergency contacts",
                    span: 2,
                    value: display(
                      emergencyContactList(personal.data)
                        .map((c) => `${c.name} (${c.relationship}) ${c.mobile || c.telephone || ""}`.trim())
                        .join(" · "),
                    ),
                  },
                ]}
              />
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}
