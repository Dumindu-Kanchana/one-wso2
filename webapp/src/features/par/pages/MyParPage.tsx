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
import { Alert, Box, Chip, Skeleton, Stack, Typography } from "@wso2/oxygen-ui";
import { ClipboardCheckIcon } from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import { useAsgardeoUser } from "@hooks/useAsgardeoUser";
import ParShell from "../components/ParShell";
import ParSection from "../components/ParSection";
import MyParAnswerPanel from "../components/MyParAnswerPanel";
import MyParReviewersPanel from "../components/MyParReviewersPanel";
import MyParRequestsPanel from "../components/MyParRequestsPanel";
import { useParMe } from "../api/useParMe";
import {
  useMyParCycle,
  useMyParRating,
  useMyReviewRequests,
  useMyReviewers,
} from "../api/useParEmployee";
import { deadlineViews } from "../util/parDeadlines";
import { parCycleStatusMeta } from "../util/parStatus";
import { useParNow } from "../util/useParNow";

// My PAR — the employee's own appraisal for the open cycle.
//
// See docs/ported-apps/par-app.md §5.1 for what this screen owes the user. The
// locking rules are NOT reimplemented here: they are pure functions in
// util/parEditability.ts, tested at each boundary, and each panel asks them.

export default function MyParPage(): JSX.Element {
  const now = useParNow();
  const { email } = useAsgardeoUser();
  const me = useParMe(email);
  const cycleQuery = useMyParCycle();
  const cycle = cycleQuery.data;
  const ratingQuery = useMyParRating(cycle?.parCycleId);
  const reviewers = useMyReviewers(cycle?.parCycleId);
  const requests = useMyReviewRequests(cycle?.parCycleId);

  return (
    <ParShell
      eyebrow={{ icon: ClipboardCheckIcon, label: "PAR" }}
      title="My PAR"
      subtitle="Your performance appraisal review for the current cycle."
      require="employee"
    >
      {cycleQuery.isPending ? (
        <Skeleton variant="rectangular" height={220} sx={{ borderRadius: 1.5 }} />
      ) : cycleQuery.isError ? (
        <Alert severity="error">
          Couldn&apos;t load the current review cycle. {describeError(cycleQuery.error)}
        </Alert>
      ) : cycle === undefined ? (
        // Between cycles. Not a fault, and not an empty screen either — the two
        // panels below still have work in them, because 360 requests and the
        // record of past cycles outlive any one cycle.
        <Alert severity="info">
          No review cycle is open at the moment. You&apos;ll see your PAR here when the next
          one starts.
        </Alert>
      ) : (
        <>
          <CycleHeader now={now} cycle={cycle} />

          {ratingQuery.isPending ? (
            <Skeleton variant="rectangular" height={260} sx={{ borderRadius: 1.5, mb: 2.25 }} />
          ) : ratingQuery.isError ? (
            <Alert severity="error" sx={{ mb: 2.25 }}>
              Couldn&apos;t load your review. {describeError(ratingQuery.error)}
            </Alert>
          ) : (
            // Keyed on the record, so loading a different PAR reseeds the answer
            // field. The key must not change while editing — parRatingId is
            // stable for the life of a cycle, which is what makes it safe here.
            <MyParAnswerPanel
              key={ratingQuery.data?.parRatingId}
              now={now}
              cycle={cycle}
              rating={ratingQuery.data}
            />
          )}

          <MyParReviewersPanel
            now={now}
            cycle={cycle}
            selfEmail={email}
            leadEmail={me.data?.leadEmail}
            reviewers={reviewers.data ?? []}
            isLoading={reviewers.isPending}
            error={reviewers.isError ? reviewers.error : undefined}
          />

          <MyParRequestsPanel
            now={now}
            cycle={cycle}
            requests={requests.data ?? []}
            isLoading={requests.isPending}
            error={requests.isError ? requests.error : undefined}
          />
        </>
      )}
    </ParShell>
  );
}

/** The cycle's name, status and the dates that gate each stage. */
function CycleHeader({ now, cycle }: { now: Date; cycle: NonNullable<ReturnType<typeof useMyParCycle>["data"]> }) {
  const status = parCycleStatusMeta(cycle.parCycleStatus);
  const views = deadlineViews(now, cycle);

  return (
    <ParSection
      title={cycle.parCycleName}
      subtitle="Each stage has its own date. They do not all lock the same things."
      action={<Chip size="small" label={status.label} color={status.color} variant="outlined" />}
    >
      <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1.25 }}>
        {views.map((v) => (
          <Box
            key={v.key}
            sx={{
              px: 1.25,
              py: 0.75,
              borderRadius: 1,
              border: 1,
              borderColor: v.passed ? "divider" : "primary.main",
              opacity: v.passed ? 0.65 : 1,
              minWidth: 150,
            }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
              {v.label}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {v.date ?? "—"}
            </Typography>
            {/* Says outright which dates actually stop anything. One of them
                stops nothing at all, by decision — see the spec's §9. */}
            <Typography variant="caption" color={v.passed ? "text.secondary" : "text.primary"}>
              {v.passed ? "Passed" : "Open"}
              {v.enforced ? "" : " · informational"}
            </Typography>
          </Box>
        ))}
      </Stack>
    </ParSection>
  );
}
