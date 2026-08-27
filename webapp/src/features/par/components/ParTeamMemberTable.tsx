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
import {
  Box,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@wso2/oxygen-ui";
import type { ParTeamMember } from "../api/parTypes";
import { PAR_RATING_NOT_ASSIGNED } from "../api/parTypes";
import {
  parEmployeeStatusMeta,
  parF2fStatusMeta,
  parLeadStatusMeta,
  parSpecialRatingMeta,
  parThreeSixtyStatusMeta,
} from "../util/parStatus";

// A team's members and where each one's PAR has got to.
//
// Read-only in this slice. Opening a member to write their review is the next
// one, so there is deliberately no row action yet rather than a control that
// does nothing.

export default function ParTeamMemberTable({
  members,
  threeSixtyDeadlinePassed,
}: {
  members: readonly ParTeamMember[];
  threeSixtyDeadlinePassed: boolean;
}): JSX.Element {
  if (members.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        This team has no members in the current cycle.
      </Typography>
    );
  }

  return (
    <Box sx={{ overflowX: "auto" }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            {["Member", "Their PAR", "360°", "Your review", "Conversation", "Rating"].map((h) => (
              <TableCell key={h} sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                {h}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {members.map((m) => {
            const three = parThreeSixtyStatusMeta(m.par360ReviewStatus, {
              deadlinePassed: threeSixtyDeadlinePassed,
            });
            const counts = m.par360ReviewCounts;
            const special = parSpecialRatingMeta(m.parSpecialRating);
            const awarded =
              m.parRating && m.parRating !== PAR_RATING_NOT_ASSIGNED ? m.parRating : undefined;

            return (
              <TableRow key={m.parRatingId} hover>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {m.parEmployeeName ?? m.parEmployeeEmail}
                  </Typography>
                  {m.parEmployeeName && (
                    <Typography variant="caption" color="text.secondary">
                      {m.parEmployeeEmail}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <StatusChip meta={parEmployeeStatusMeta(m.parEmployeeStatus)} />
                </TableCell>
                <TableCell sx={{ whiteSpace: "nowrap" }}>
                  <StatusChip meta={three} />
                  {/* The ratio matters more than the status here: "pending" says
                      nothing about whether 1 of 5 or 4 of 5 have come back. */}
                  {counts && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ ml: 0.75, fontVariantNumeric: "tabular-nums" }}
                    >
                      {counts.sharedReviewCount}/{counts.requestedReviewCount}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <StatusChip meta={parLeadStatusMeta(m.parLeadStatus)} />
                </TableCell>
                <TableCell>
                  <StatusChip meta={parF2fStatusMeta(m.parF2fStatus)} />
                </TableCell>
                <TableCell sx={{ whiteSpace: "nowrap" }}>
                  {awarded ? (
                    <Typography variant="body2">{awarded}</Typography>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      —
                    </Typography>
                  )}
                  {special.label !== "—" && (
                    <Chip
                      size="small"
                      variant="outlined"
                      color={special.color}
                      label={special.label}
                      sx={{ ml: 0.75 }}
                    />
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Box>
  );
}

function StatusChip({ meta }: { meta: { label: string; color: "success" | "error" | "warning" | "info" | "default" } }) {
  return <Chip size="small" variant="outlined" color={meta.color} label={meta.label} />;
}
