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
import {
  Alert,
  Box,
  Button,
  Chip,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@wso2/oxygen-ui";
import { HistoryIcon } from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import ParShell from "../components/ParShell";
import ParSection from "../components/ParSection";
import ParHtml from "../components/ParHtml";
import { useMyClosedCycles, useMyParRatingFor } from "../api/useParHistory";
import { formatParDate, formatParPeriod } from "../util/parDates";
import {
  PAR_RATING_NOT_ASSIGNED,
  type ParCycle,
} from "../api/parTypes";
import {
  parEmployeeStatusMeta,
  parF2fStatusMeta,
  parLeadStatusMeta,
  parSpecialRatingMeta,
} from "../util/parStatus";

// PAR history — the employee's own past appraisals.
//
// See docs/ported-apps/par-app.md §5.2. The source paired this with a "chain
// view" tab for browsing subordinates' history; that is a lead capability
// reading other people's appraisals, and it lands with the lead screens.

export default function ParHistoryPage(): JSX.Element {
  const cycles = useMyClosedCycles();
  const [openCycleId, setOpenCycleId] = useState<number | null>(null);

  return (
    <ParShell
      eyebrow={{ icon: HistoryIcon, label: "PAR" }}
      title="PAR history"
      subtitle="Your appraisals from cycles that have closed."
      require="employee"
    >
      {cycles.isPending ? (
        <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 1.5 }} />
      ) : cycles.isError ? (
        <Alert severity="error">
          Couldn&apos;t load your history. {describeError(cycles.error)}
        </Alert>
      ) : (cycles.data ?? []).length === 0 ? (
        <Alert severity="info">
          You don&apos;t have any closed cycles yet. Your first appraisal appears here once its
          cycle closes.
        </Alert>
      ) : (
        <>
          <ParSection
            title="Closed cycles"
            subtitle="Newest first. Open one to read what was written."
          >
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Cycle</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Period</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Closed</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(cycles.data ?? []).map((cycle) => {
                    const isOpen = openCycleId === cycle.parCycleId;
                    return (
                      <TableRow key={cycle.parCycleId} hover>
                        <TableCell sx={{ fontWeight: 600 }}>{cycle.parCycleName}</TableCell>
                        <TableCell>
                          {formatParPeriod(cycle.parCycleStartDate, cycle.parCycleEndDate)}
                        </TableCell>
                        <TableCell>{formatParDate(cycle.parCycleEndDate)}</TableCell>
                        <TableCell align="right">
                          <Button
                            size="small"
                            variant={isOpen ? "contained" : "outlined"}
                            onClick={() => setOpenCycleId(isOpen ? null : cycle.parCycleId)}
                            sx={{ textTransform: "none", fontWeight: 600 }}
                          >
                            {isOpen ? "Hide" : "Open"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Box>
          </ParSection>

          {/* Mounted only for the cycle actually open, so nothing is fetched
              until it is asked for and the detail cannot show a stale cycle. */}
          {openCycleId !== null && (
            <PastCycleDetail
              key={openCycleId}
              cycle={(cycles.data ?? []).find((c) => c.parCycleId === openCycleId)}
            />
          )}
        </>
      )}
    </ParShell>
  );
}

/** One past appraisal in full: both sides of it, and what it concluded. */
function PastCycleDetail({ cycle }: { cycle: ParCycle | undefined }): JSX.Element | null {
  const rating = useMyParRatingFor(cycle?.parCycleId, cycle !== undefined);
  if (cycle === undefined) return null;

  if (rating.isPending) {
    return <Skeleton variant="rectangular" height={220} sx={{ borderRadius: 1.5, mb: 2.25 }} />;
  }
  if (rating.isError) {
    return (
      <Alert severity="error" sx={{ mb: 2.25 }}>
        Couldn&apos;t load {cycle.parCycleName}. {describeError(rating.error)}
      </Alert>
    );
  }

  const r = rating.data;
  if (r === undefined) {
    return (
      <Alert severity="info" sx={{ mb: 2.25 }}>
        No appraisal was recorded for {cycle.parCycleName}.
      </Alert>
    );
  }

  // "NOT_ASSIGNED" is the backend's way of saying no rating was given; showing
  // it raw states a value that is really an absence.
  const awarded =
    r.parRating && r.parRating !== PAR_RATING_NOT_ASSIGNED ? r.parRating : undefined;
  const special = parSpecialRatingMeta(r.parSpecialRating);

  return (
    <ParSection
      title={cycle.parCycleName}
      subtitle={formatParPeriod(cycle.parCycleStartDate, cycle.parCycleEndDate)}
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
        </Stack>
      }
    >
      <Stack spacing={2.25}>
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
            WHAT YOU WROTE
          </Typography>
          <Box sx={{ mt: 0.5 }}>
            <ParHtml
              html={r.parEmployeeComment}
              emptyText="You didn't write anything for this cycle."
            />
          </Box>
        </Box>

        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
            WHAT YOUR LEAD WROTE
          </Typography>
          <Box sx={{ mt: 0.5 }}>
            <ParHtml
              html={r.parLeadComment}
              emptyText="Your lead didn't leave written feedback."
            />
          </Box>
        </Box>

        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
          {/* The three statuses the record ends on. Shown together because
              "shared" on its own says nothing about whether the conversation
              actually happened. */}
          <Chip
            size="small"
            variant="outlined"
            color={parEmployeeStatusMeta(r.parEmployeeStatus).color}
            label={`Yours: ${parEmployeeStatusMeta(r.parEmployeeStatus).label}`}
          />
          <Chip
            size="small"
            variant="outlined"
            color={parLeadStatusMeta(r.parLeadStatus).color}
            label={`Lead's: ${parLeadStatusMeta(r.parLeadStatus).label}`}
          />
          <Chip
            size="small"
            variant="outlined"
            color={parF2fStatusMeta(r.parF2fStatus).color}
            label={`Conversation: ${parF2fStatusMeta(r.parF2fStatus).label}${
              r.parF2fDate ? ` · ${formatParDate(r.parF2fDate)}` : ""
            }`}
          />
        </Stack>
      </Stack>
    </ParSection>
  );
}
