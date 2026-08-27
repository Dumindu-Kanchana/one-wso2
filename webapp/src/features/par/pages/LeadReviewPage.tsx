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


import type { JSX } from "react";
import { Alert, Box, Button, Chip, Skeleton, Stack } from "@wso2/oxygen-ui";
import { ArrowLeftIcon, UsersRoundIcon } from "@wso2/oxygen-ui-icons-react";
import { Link as RouterLink, useParams } from "react-router";
import { describeError } from "@api/errors";
import ParShell from "../components/ParShell";
import LeadFeedbackPanel from "../components/LeadFeedbackPanel";
import LeadThreeSixtyPanel from "../components/LeadThreeSixtyPanel";
import LeadF2fPanel from "../components/LeadF2fPanel";
import { useMyParCycle } from "../api/useParEmployee";
import { useReportParRating, useReportThreeSixtyReviews } from "../api/useParLead";
import { isDeadlinePassed } from "../util/parDeadlines";
import { parEmployeeStatusMeta } from "../util/parStatus";
import { useParNow } from "../util/useParNow";

// One report's PAR, as their lead reviews it.
//
// A route rather than a dialog, matching the employee-detail screen under My
// Team: the lead works through a list of people, and a URL per person means
// they can be linked to, reopened, and pinned.
//
// Everything on this screen is read or written on somebody else's appraisal, so
// it sits behind the same `teamLead` gate as the list it came from. The three
// areas are stacked rather than tabbed — the source used tabs, but the lead
// needs the employee's words and the 360 feedback in front of them WHILE
// writing, and tabs put them one click away from each other.

export default function LeadReviewPage(): JSX.Element {
  const now = useParNow();
  const { employeeEmail: raw } = useParams<{ employeeEmail: string }>();
  // The email is a path segment, so it arrives percent-encoded.
  const employeeEmail = raw ? safeDecode(raw) : undefined;

  const cycleQuery = useMyParCycle();
  const cycle = cycleQuery.data;
  const ratingQuery = useReportParRating(cycle?.parCycleId, employeeEmail);
  const reviews = useReportThreeSixtyReviews(cycle?.parCycleId, employeeEmail);
  const rating = ratingQuery.data;

  return (
    <ParShell
      eyebrow={{ icon: UsersRoundIcon, label: "PAR" }}
      title={rating?.parEmployeeName ?? employeeEmail ?? "Review"}
      subtitle={rating?.parEmployeeName ? employeeEmail : undefined}
      require="teamLead"
    >
      <Box sx={{ mb: 2 }}>
        <Button
          component={RouterLink}
          to="/me/par/team"
          size="small"
          startIcon={<ArrowLeftIcon size={16} />}
          sx={{ textTransform: "none", fontWeight: 600 }}
        >
          Back to my team
        </Button>
      </Box>

      {cycleQuery.isPending || ratingQuery.isPending ? (
        <Skeleton variant="rectangular" height={280} sx={{ borderRadius: 1.5 }} />
      ) : cycleQuery.isError ? (
        <Alert severity="error">
          Couldn&apos;t load the current cycle. {describeError(cycleQuery.error)}
        </Alert>
      ) : cycle === undefined ? (
        <Alert severity="info">No review cycle is open at the moment.</Alert>
      ) : employeeEmail === undefined ? (
        <Alert severity="error">That link doesn&apos;t name anyone to review.</Alert>
      ) : ratingQuery.isError ? (
        <Alert severity="error">
          Couldn&apos;t load their PAR. {describeError(ratingQuery.error)}
        </Alert>
      ) : rating === undefined ? (
        // A lead can reach a URL for someone who is not in this cycle. Saying so
        // beats an empty screen, and it is not a permission problem.
        <Alert severity="info">
          {employeeEmail} doesn&apos;t have a PAR in {cycle.parCycleName}.
        </Alert>
      ) : (
        <>
          <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: "wrap", gap: 1 }}>
            <Chip
              size="small"
              variant="outlined"
              color={parEmployeeStatusMeta(rating.parEmployeeStatus).color}
              label={`Their PAR: ${parEmployeeStatusMeta(rating.parEmployeeStatus).label}`}
            />
            <Chip size="small" variant="outlined" label={cycle.parCycleName} />
          </Stack>

          <LeadFeedbackPanel key={rating.parRatingId} now={now} cycle={cycle} rating={rating} />

          <LeadThreeSixtyPanel
            reviews={reviews.data ?? []}
            isPending={reviews.isPending}
            error={reviews.isError ? reviews.error : undefined}
            deadlinePassed={isDeadlinePassed(now, cycle.parThreeSixtyRatingDeadline)}
          />

          <LeadF2fPanel now={now} cycle={cycle} rating={rating} />
        </>
      )}
    </ParShell>
  );
}

/**
 * Decode a path segment, keeping it as-is when it cannot be.
 *
 * `decodeURIComponent` throws on a malformed escape, and this runs during
 * render — the same failure that took the pin button down, so the same guard.
 */
function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
