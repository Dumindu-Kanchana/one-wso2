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
import { Alert, Box, Chip, Divider, Stack, Typography } from "@wso2/oxygen-ui";
import { describeError } from "@api/errors";
import type { ParThreeSixtyReview } from "../api/parTypes";
import { parThreeSixtyStatusMeta } from "../util/parStatus";
import ParHtml from "./ParHtml";
import ParSection from "./ParSection";

// The 360 feedback colleagues wrote about this report.
//
// Only the completed ones carry text; a pending or declined request has nothing
// to read, so it is listed as a status rather than as an empty card. Leads use
// this to weigh their own rating, and an empty card reads as feedback that said
// nothing.

export default function LeadThreeSixtyPanel({
  reviews,
  isPending,
  error,
  deadlinePassed,
}: {
  reviews: readonly ParThreeSixtyReview[];
  isPending: boolean;
  error?: unknown;
  deadlinePassed: boolean;
}): JSX.Element {
  const answered = reviews.filter((r) => r.reviewStatus === "SHARED");
  const outstanding = reviews.filter((r) => r.reviewStatus !== "SHARED");

  return (
    <ParSection
      title="360° feedback"
      subtitle="What colleagues wrote about them this cycle."
      action={
        reviews.length > 0 ? (
          <Chip
            size="small"
            variant="outlined"
            color={answered.length > 0 ? "success" : "default"}
            label={`${answered.length} of ${reviews.length} in`}
          />
        ) : undefined
      }
    >
      {error ? (
        <Alert severity="error">Couldn&apos;t load the 360° feedback. {describeError(error)}</Alert>
      ) : isPending ? (
        <Typography variant="body2" color="text.secondary">
          Loading…
        </Typography>
      ) : reviews.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Nobody was asked for feedback about them this cycle.
        </Typography>
      ) : (
        <Stack spacing={2}>
          {answered.map((r, i) => (
            <Box key={r.reviewerEmail ?? `answered-${i}`}>
              {i > 0 && <Divider sx={{ mb: 2 }} />}
              <Stack
                direction="row"
                sx={{ alignItems: "baseline", justifyContent: "space-between", gap: 1, mb: 0.75 }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {/* The backend withholds the reviewer on anonymous cycles, so
                      this has to read sensibly with no name at all. */}
                  {r.reviewerEmail ?? "A colleague"}
                </Typography>
                {r.reviewRating && (
                  <Chip size="small" variant="outlined" label={r.reviewRating} />
                )}
              </Stack>
              <ParHtml html={r.reviewComment} emptyText="They gave a rating but no comment." />
            </Box>
          ))}

          {outstanding.length > 0 && (
            <Box>
              {answered.length > 0 && <Divider sx={{ mb: 1.5 }} />}
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                STILL OUTSTANDING
              </Typography>
              <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1, mt: 0.75 }}>
                {outstanding.map((r, i) => {
                  const meta = parThreeSixtyStatusMeta(r.reviewStatus, { deadlinePassed });
                  return (
                    <Chip
                      key={r.reviewerEmail ?? `outstanding-${i}`}
                      size="small"
                      variant="outlined"
                      color={meta.color}
                      label={`${r.reviewerEmail ?? "A colleague"} · ${meta.label}`}
                    />
                  );
                })}
              </Stack>
            </Box>
          )}
        </Stack>
      )}
    </ParSection>
  );
}
