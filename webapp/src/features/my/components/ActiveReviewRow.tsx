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

import { Box, Chip, Skeleton, Stack, Tooltip, Typography } from "@wso2/oxygen-ui";
import type { ParEmployeeStatus } from "../api/types";
import {
  isParBackendConfigured,
  useActiveParCycle,
  useParRating,
} from "../api/useActiveReview";

// Active review row for the Performance & growth card. Fetches the
// caller's OPEN par cycle (if any) and their rating record within it;
// renders cycle name + submission-status chip + a computed
// deadline-approach line derived from parLeadDeadline.
export default function ActiveReviewRow({ workEmail }: { workEmail?: string }) {
  const configured = isParBackendConfigured();
  const cyclesQuery = useActiveParCycle(workEmail);
  // Two OPEN cycles at once is unusual — take the first. Backend orders
  // by parCycleId asc so this is stable.
  const cycle = cyclesQuery.data?.[0];
  const ratingQuery = useParRating(cycle?.parCycleId, workEmail);

  // Common wrapper — keep the row height stable across states so the card
  // doesn't jump between loading and success.
  const row = (title: React.ReactNode, meta: React.ReactNode) => (
    <Stack
      direction="row"
      spacing={1.25}
      sx={{ py: 1.125, alignItems: "center" }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 500, fontSize: 13, display: "flex", alignItems: "center", gap: 0.75 }}>
          {title}
        </Typography>
        <Typography sx={{ fontSize: 12, color: "text.secondary" }} noWrap>
          {meta}
        </Typography>
      </Box>
    </Stack>
  );

  if (!configured) {
    return row(
      <>
        Performance review
        <Tooltip title="Set ONE_WSO2_PAR_BACKEND_URL to enable this." placement="top">
          <Box component="span" sx={{ fontSize: 11, fontWeight: 500, color: "text.disabled", fontStyle: "italic", cursor: "help" }}>
            Not configured
          </Box>
        </Tooltip>
      </>,
      "Configure the par-app backend URL to see your active review.",
    );
  }

  if (cyclesQuery.isLoading) {
    return row(
      <Skeleton variant="text" width={160} sx={{ fontSize: 13 }} />,
      <Skeleton variant="text" width={220} sx={{ fontSize: 12 }} />,
    );
  }

  if (cyclesQuery.isError) {
    return row(
      "Performance review",
      <Box component="span" sx={{ color: "error.main" }}>Couldn't load your review cycle.</Box>,
    );
  }

  if (!cycle) {
    return row(
      "Performance review",
      "No active review cycle.",
    );
  }

  // rating error MUST render distinctly from "Not started". Otherwise a
  // 401 / 5xx / stale-token failure silently maps to the friendly
  // no-record-yet chip and the user has no way to tell backend is broken.
  const submissionChip = ratingQuery.isLoading ? (
    <Skeleton variant="rectangular" width={72} height={20} sx={{ borderRadius: 10 }} />
  ) : ratingQuery.isError ? (
    <Chip
      label="Unknown"
      size="small"
      color="error"
      variant="outlined"
      sx={{ ml: 0.75, height: 20, fontSize: 11, fontWeight: 600 }}
    />
  ) : (
    <SubmissionChip status={ratingQuery.data?.parEmployeeStatus} />
  );

  return row(
    <>
      {cycle.parCycleName} Review {submissionChip}
    </>,
    ratingQuery.isError
      ? "Couldn't load your rating status."
      : describeLeadDeadline(cycle.parLeadDeadline),
  );
}

function SubmissionChip({ status }: { status?: ParEmployeeStatus }) {
  const cfg = mapEmployeeStatus(status);
  return (
    <Chip
      label={cfg.label}
      color={cfg.color}
      size="small"
      variant={cfg.variant}
      sx={{ ml: 0.75, height: 20, fontSize: 11, fontWeight: 600 }}
    />
  );
}

// Maps par-app's ParEmployeeStatus enum → chip label + colour.
// undefined = no ParRating record yet (backend 404 → null in our hook).
function mapEmployeeStatus(status?: ParEmployeeStatus): {
  label: string;
  color: "primary" | "success" | "warning" | "default" | "error";
  variant: "filled" | "outlined";
} {
  switch (status) {
    case "SHARED":
      return { label: "Submitted", color: "success", variant: "filled" };
    case "DRAFT":
      return { label: "Draft", color: "warning", variant: "outlined" };
    case "SHARED_BLOCKED":
      return { label: "Blocked", color: "error", variant: "outlined" };
    case "PENDING":
      return { label: "Not started", color: "default", variant: "outlined" };
    default:
      // No rating record yet — the employee hasn't been added to the
      // cycle's rating table (or the backend returned 404).
      return { label: "Not started", color: "default", variant: "outlined" };
  }
}

// Turns an ISO date into "Lead's PAR submission deadline in N days" /
// "today" / "passed". Parses `YYYY-MM-DD` explicitly in the LOCAL calendar
// so a Ballerina date-only field lands on the day the backend meant,
// not the previous day for users west of UTC (new Date("YYYY-MM-DD")
// parses as UTC midnight per the spec).
function describeLeadDeadline(deadline: string | undefined | null): string {
  const targetDay = parseLocalDateOnly(deadline);
  if (!targetDay) return "Lead's PAR submission deadline: n/a";
  const today = startOfDay(new Date());
  const diffDays = Math.round((targetDay.getTime() - today.getTime()) / 86_400_000);
  if (diffDays > 1) return `Lead's PAR submission deadline in ${diffDays} days`;
  if (diffDays === 1) return "Lead's PAR submission deadline tomorrow";
  if (diffDays === 0) return "Lead's PAR submission deadline today";
  return "Lead's PAR submission deadline passed";
}

// Read a `YYYY-MM-DD[Thh:mm...]` string as a LOCAL calendar day. Returning
// a Date at local midnight for that day lets diff math against
// startOfDay(new Date()) stay on the intended day boundary in every
// timezone. Returns null if the input isn't a recognisable ISO date, or
// if the components describe an impossible calendar day (e.g. Feb 31 —
// `new Date(2026, 1, 31)` silently normalises to March 3 and would
// otherwise be rendered as if it were a valid deadline).
function parseLocalDateOnly(input: string | undefined | null): Date | null {
  if (!input) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(input);
  if (!match) return null;
  const [, y, m, d] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  const date = new Date(year, month - 1, day);
  // Round-trip: if the Date constructor had to normalise an overflowed
  // component the getters won't match what we parsed — reject as
  // malformed rather than silently returning a different date.
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
