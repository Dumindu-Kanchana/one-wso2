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
  Checkbox,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@wso2/oxygen-ui";
import { useNavigate } from "react-router";
import type { ParTeamMember } from "../api/parTypes";
import { PAR_RATING_NOT_ASSIGNED } from "../api/parTypes";
import ParEmpty from "./ParEmpty";
import {
  parEmployeeStatusMeta,
  parF2fStatusMeta,
  parLeadStatusMeta,
  parSpecialRatingMeta,
  parThreeSixtyStatusMeta,
} from "../util/parStatus";

// A team's members and where each one's PAR has got to, each row opening that
// person's review.
//
// The whole row is the link, not just the name — the same arrangement My Team
// uses, and for the same reason: a lead is picking a person, so the target
// should be the row they are reading rather than a word inside it.

export default function ParTeamMemberTable({
  members,
  threeSixtyDeadlinePassed,
  selectedIds,
  onToggle,
  onToggleAll,
}: {
  members: readonly ParTeamMember[];
  threeSixtyDeadlinePassed: boolean;
  /** Selected rating ids. Omitted entirely when selection is not offered. */
  selectedIds?: ReadonlySet<number>;
  onToggle?: (parRatingId: number) => void;
  onToggleAll?: (select: boolean) => void;
}): JSX.Element {
  // Above the early return: a hook after one is only called on some renders,
  // so the hook order changes between an empty team and a populated one.
  const navigate = useNavigate();
  const open = (email: string) => void navigate(`/me/par/team/${encodeURIComponent(email)}`);

  const selectable = selectedIds !== undefined && onToggle !== undefined;
  const allSelected = selectable && members.length > 0 && members.every((m) => selectedIds.has(m.parRatingId));
  // Distinct from "all": a partially-filled box says something the other two
  // states cannot, and without it selecting one row makes the header look off.
  const someSelected = selectable && members.some((m) => selectedIds.has(m.parRatingId));

  if (members.length === 0) {
    return (
      <ParEmpty>
        This team has no members in the current cycle.
      </ParEmpty>
    );
  }

  return (
    <Box sx={{ overflowX: "auto" }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            {selectable && (
              <TableCell padding="checkbox">
                <Checkbox
                  size="small"
                  checked={allSelected}
                  indeterminate={someSelected && !allSelected}
                  onChange={(e) => onToggleAll?.(e.target.checked)}
                  inputProps={{ "aria-label": "Select every member" }}
                />
              </TableCell>
            )}
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
              <TableRow
                key={m.parRatingId}
                hover
                onClick={() => open(m.parEmployeeEmail)}
                sx={{ cursor: "pointer" }}
              >
                {selectable && (
                  <TableCell padding="checkbox">
                    <Checkbox
                      size="small"
                      checked={selectedIds.has(m.parRatingId)}
                      // Selecting is not opening, so the row's own click must
                      // not fire underneath it.
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => onToggle?.(m.parRatingId)}
                      inputProps={{
                        "aria-label": `Select ${m.parEmployeeName ?? m.parEmployeeEmail}`,
                      }}
                    />
                  </TableCell>
                )}
                <TableCell>
                  {/* A real button inside the row, so the row is reachable by
                      keyboard and announced as a link — a row-level onClick
                      alone is invisible to anyone not using a mouse. */}
                  <Box
                    component="button"
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      open(m.parEmployeeEmail);
                    }}
                    sx={{
                      all: "unset",
                      cursor: "pointer",
                      fontWeight: 600,
                      fontSize: 14,
                      color: "text.primary",
                      "&:focus-visible": {
                        outline: 2,
                        outlineStyle: "solid",
                        outlineColor: "primary.main",
                        outlineOffset: 2,
                      },
                    }}
                  >
                    {m.parEmployeeName ?? m.parEmployeeEmail}
                  </Box>
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
