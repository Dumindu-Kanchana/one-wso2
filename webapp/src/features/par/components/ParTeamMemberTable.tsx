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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@wso2/oxygen-ui";
import { useNavigate } from "react-router";
import type { ParTeamMember } from "../api/parTypes";
import ParEmpty from "./ParEmpty";
import { ParEmployeeName } from "./ParEmployeeName";
import { ParRatingCells, ParReviewAction } from "./ParRatingCells";
import { PAR_RATING_HEADERS } from "../util/parRatingColumns";

// A team's members and where each one's PAR has got to — TeamSummary.tsx's
// Members grid, which the admin portal renders as well (OrgSummary.tsx:1167).
//
// Nothing but the trailing icon opens a person. None of the three source views
// sets onRowClick or makes the name a control, so neither does this. An earlier
// version made the row and the name both clickable, which then had to fight the
// checkbox and the copy button for the same click.

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
            {["Team Member", ...PAR_RATING_HEADERS, ""].map((h, i) => (
              <TableCell key={h || `blank-${i}`} sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                {h}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {members.map((m) => {
            return (
              <TableRow key={m.parRatingId} hover>
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
                  {/* Plain text. None of the three source views makes the name
                      or the row clickable — the trailing icon is the only way
                      in, so it is the only control here too. */}
                  <ParEmployeeName
                    name={m.parEmployeeName}
                    email={m.parEmployeeEmail}
                    copyable
                  />
                </TableCell>
                <ParRatingCells row={m} threeSixtyDeadlinePassed={threeSixtyDeadlinePassed} />
                <TableCell align="right">
                  <ParReviewAction
                    shared={m.parLeadStatus === "SHARED"}
                    onOpen={() => open(m.parEmployeeEmail)}
                    label={m.parEmployeeName ?? m.parEmployeeEmail}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Box>
  );
}

