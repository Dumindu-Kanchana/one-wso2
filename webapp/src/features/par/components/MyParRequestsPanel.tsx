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


import { useState, type JSX } from "react";
import { Alert, Box, Button, Chip, Stack, Typography } from "@wso2/oxygen-ui";
import { describeError } from "@api/errors";
import type { ParCycle, ParThreeSixtyReviewRequest } from "../api/parTypes";
import { isDeadlinePassed } from "../util/parDeadlines";
import { parThreeSixtyStatusMeta } from "../util/parStatus";
import ParSection from "./ParSection";
import ThreeSixtyReviewDialog from "./ThreeSixtyReviewDialog";

// Feedback OTHER people have asked this employee to write.
//
// Distinct from the panel above it, which is feedback about them. Keeping the
// two apart is the point: the source put both behind tabs labelled "offered"
// and "requested", which named the data rather than the reader's task.

export default function MyParRequestsPanel({
  now,
  cycle,
  requests,
  isLoading,
  error,
}: {
  now: Date;
  cycle: ParCycle | undefined;
  requests: ParThreeSixtyReviewRequest[];
  isLoading: boolean;
  error?: unknown;
}): JSX.Element {
  const [active, setActive] = useState<string | null>(null);

  const deadlinePassed = isDeadlinePassed(now, cycle?.parThreeSixtyRatingDeadline);
  const outstanding = requests.filter((r) => r.reviewStatus !== "SHARED");

  return (
    <ParSection
      title="Feedback others asked you for"
      subtitle="Colleagues who named you as a reviewer this cycle."
      action={
        outstanding.length > 0 ? (
          <Chip size="small" color="warning" variant="outlined" label={`${outstanding.length} to do`} />
        ) : undefined
      }
    >
      {error ? (
        <Alert severity="error">Couldn&apos;t load these requests. {describeError(error)}</Alert>
      ) : requests.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {isLoading ? "Loading…" : "Nobody has asked you for feedback this cycle."}
        </Typography>
      ) : (
        <Stack spacing={1}>
          {requests.map((r) => {
            const meta = parThreeSixtyStatusMeta(r.reviewStatus, { deadlinePassed });
            const done = r.reviewStatus === "SHARED" || r.reviewStatus === "REJECTED";
            return (
              <Stack
                key={r.employeeEmail}
                direction="row"
                sx={{
                  alignItems: "center",
                  gap: 1.5,
                  py: 1,
                  borderTop: 1,
                  borderColor: "divider",
                }}
              >
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                    {r.employeeEmail}
                  </Typography>
                  {/* Who asked matters: a lead asking on someone's behalf reads
                      differently from the person asking themselves. */}
                  <Typography variant="caption" color="text.secondary">
                    {r.isLeadRequested && r.isEmployeeRequested
                      ? "Asked by them and their lead"
                      : r.isLeadRequested
                        ? "Asked by their lead"
                        : "Asked by them"}
                  </Typography>
                </Box>
                <Chip size="small" variant="outlined" color={meta.color} label={meta.label} />
                <Button
                  size="small"
                  variant={done ? "outlined" : "contained"}
                  onClick={() => setActive(r.employeeEmail)}
                  // Past the deadline nothing can be written, but an answer
                  // already given stays readable.
                  disabled={deadlinePassed && !done}
                  sx={{ textTransform: "none", fontWeight: 600, flexShrink: 0 }}
                >
                  {done ? "View" : "Write"}
                </Button>
              </Stack>
            );
          })}
        </Stack>
      )}

      {/* Mounted only while a request is open, so each open starts from what is
          stored rather than from text typed and abandoned earlier. */}
      {active !== null && cycle !== undefined && (
        <ThreeSixtyReviewDialog
          cycle={cycle}
          revieweeEmail={active}
          onClose={() => setActive(null)}
        />
      )}
    </ParSection>
  );
}
