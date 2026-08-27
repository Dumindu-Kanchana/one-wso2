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
import { Chip, IconButton, TableCell, Tooltip, Typography } from "@wso2/oxygen-ui";
import { EyeIcon, SquarePenIcon } from "@wso2/oxygen-ui-icons-react";
import { PAR_RATING_NOT_ASSIGNED } from "../api/parTypes";
import type {
  ParEmployeeStatus,
  ParF2fStatus,
  ParLeadStatus,
  ParSpecialRating,
  ParThreeSixtyReviewStatus,
} from "../api/parTypes";
import {
  parEmployeeStatusMeta,
  parF2fStatusMeta,
  parLeadStatusMeta,
  parSpecialRatingMeta,
  parThreeSixtyStatusMeta,
} from "../util/parStatus";


/** The fields the six status columns read. */
export interface ParRatingCellsRow {
  readonly parEmployeeStatus: ParEmployeeStatus;
  readonly par360ReviewStatus?: ParThreeSixtyReviewStatus;
  readonly par360ReviewCounts?: {
    readonly requestedReviewCount: number;
    readonly sharedReviewCount: number;
  };
  readonly parLeadStatus?: ParLeadStatus;
  readonly parRating?: string;
  readonly parSpecialRating?: ParSpecialRating;
  readonly parF2fStatus?: ParF2fStatus;
}

function StatusChip({
  meta,
}: {
  meta: { label: string; color: "success" | "error" | "warning" | "info" | "default" };
}): JSX.Element {
  return <Chip size="small" variant="outlined" color={meta.color} label={meta.label} />;
}

export function ParRatingCells({
  row,
  threeSixtyDeadlinePassed,
}: {
  readonly row: ParRatingCellsRow;
  /** ParStatusChip.tsx:96 shows "-" for a pending 360 once its deadline is up. */
  readonly threeSixtyDeadlinePassed?: boolean;
}): JSX.Element {
  const counts = row.par360ReviewCounts;
  const special = parSpecialRatingMeta(row.parSpecialRating);
  const awarded =
    row.parRating && row.parRating !== PAR_RATING_NOT_ASSIGNED ? row.parRating : undefined;

  return (
    <>
      <TableCell>
        <StatusChip meta={parEmployeeStatusMeta(row.parEmployeeStatus)} />
      </TableCell>
      <TableCell sx={{ whiteSpace: "nowrap" }}>
        <StatusChip
          meta={parThreeSixtyStatusMeta(row.par360ReviewStatus, {
            deadlinePassed: threeSixtyDeadlinePassed,
          })}
        />
        {/* The ratio matters more than the status here: "pending" says nothing
            about whether 1 of 5 or 4 of 5 have come back. The source passes the
            same counts into its chip as `countDetails`. */}
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
        <StatusChip meta={parLeadStatusMeta(row.parLeadStatus)} />
      </TableCell>
      <TableCell sx={{ whiteSpace: "nowrap" }}>
        {awarded ? (
          <Typography variant="body2">{awarded}</Typography>
        ) : (
          <Typography variant="body2" color="text.secondary">
            —
          </Typography>
        )}
      </TableCell>
      <TableCell sx={{ whiteSpace: "nowrap" }}>
        {special.label === "—" ? (
          <Typography variant="body2" color="text.secondary">
            —
          </Typography>
        ) : (
          <Chip size="small" variant="outlined" color={special.color} label={special.label} />
        )}
      </TableCell>
      <TableCell>
        <StatusChip meta={parF2fStatusMeta(row.parF2fStatus)} />
      </TableCell>
    </>
  );
}

/**
 * The trailing action, headerName "" in all three source views: an eye once the
 * lead has shared their review, a pen while it is still to write.
 * TeamSummary.tsx:305-341, EmployeeReportView.tsx:228-264,
 * ReportChainView.tsx:256-282.
 */
export function ParReviewAction({
  shared,
  onOpen,
  label,
}: {
  readonly shared: boolean;
  readonly onOpen: () => void;
  /** Names the row, so a screen reader hears which person the button opens. */
  readonly label: string;
}): JSX.Element {
  const title = shared ? "View" : "Review";
  return (
    <Tooltip title={title} enterDelay={200} enterNextDelay={200}>
      <IconButton
        size="small"
        color="primary"
        aria-label={`${title} ${label}`}
        onClick={(e) => {
          e.stopPropagation();
          onOpen();
        }}
      >
        {shared ? <EyeIcon size={16} /> : <SquarePenIcon size={16} />}
      </IconButton>
    </Tooltip>
  );
}
