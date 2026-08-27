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
import { Box, Chip, Stack, Typography } from "@wso2/oxygen-ui";
import type { ParCycle, ParRating } from "../api/parTypes";
import { PAR_RATING_NOT_ASSIGNED } from "../api/parTypes";
import { formatParDate } from "../util/parDates";
import {
  parF2fStatusMeta,
  parLeadStatusMeta,
  parSpecialRatingMeta,
} from "../util/parStatus";
import ParHtml from "./ParHtml";
import ParSection from "./ParSection";

// What the employee sees once their lead has shared: the review written about
// them, the rating, and the record of the conversation.
//
// Gated on `parLeadStatus === "SHARED"` by the caller, which is the source's
// condition — before that the lead's draft is not the employee's to read. The
// F2F record is read-only here: the lead records it, and the standalone app
// passes `isEmployeeView` for exactly this distinction.
//
// This closes §5.1's last bullet, which slice 1 specified and did not implement.

export default function MyParLeadReviewPanel({
  cycle,
  rating,
}: {
  cycle: ParCycle;
  rating: ParRating;
}): JSX.Element {
  void cycle;
  const awarded =
    rating.parRating && rating.parRating !== PAR_RATING_NOT_ASSIGNED ? rating.parRating : undefined;
  const special = parSpecialRatingMeta(rating.parSpecialRating);
  const f2f = parF2fStatusMeta(rating.parF2fStatus);

  return (
    <ParSection
      title="Your lead's review"
      subtitle="Shared with you, and no longer editable by them."
      action={
        <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", justifyContent: "flex-end" }}>
          <Chip
            size="small"
            variant="outlined"
            color={awarded ? "success" : "default"}
            label={awarded ? `Rating: ${awarded}` : "No rating recorded"}
          />
          {special.label !== "—" && (
            <Chip size="small" variant="outlined" color={special.color} label={special.label} />
          )}
          <Chip
            size="small"
            variant="outlined"
            color={parLeadStatusMeta(rating.parLeadStatus).color}
            label={parLeadStatusMeta(rating.parLeadStatus).label}
          />
        </Stack>
      }
    >
      <Stack spacing={2}>
        <ParHtml
          html={rating.parLeadComment}
          emptyText="Your lead shared the review without written feedback."
        />
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
            FACE-TO-FACE CONVERSATION
          </Typography>
          <Box sx={{ mt: 0.5 }}>
            <Chip
              size="small"
              variant="outlined"
              color={f2f.color}
              label={
                rating.parF2fDate && rating.parF2fStatus !== "PENDING"
                  ? `${f2f.label} · ${formatParDate(rating.parF2fDate)}`
                  : f2f.label
              }
            />
            {/* Read-only: the lead records this, and saying so prevents the
                reader looking for a control that is not theirs. */}
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
              Recorded by your lead.
            </Typography>
          </Box>
        </Box>
      </Stack>
    </ParSection>
  );
}
