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
  Breadcrumbs,
  Button,
  Chip,
  Link,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@wso2/oxygen-ui";
import { ArrowLeftIcon, ChevronRightIcon } from "@wso2/oxygen-ui-icons-react";
import { useNavigate } from "react-router";
import { describeError } from "@api/errors";
import { useReportsFor } from "../api/useParReports";
import { PAR_RATING_NOT_ASSIGNED } from "../api/parTypes";
import { isReportALead } from "../util/parReports";
import { parEmployeeStatusMeta, parLeadStatusMeta } from "../util/parStatus";
import {
  chainBack,
  chainPush,
  chainTruncate,
  type ParChainStep,
} from "../util/parChain";
import ParSection from "./ParSection";

// Walking down a reporting line, one level at a time.
//
// Every level is the same request with a different lead, so drilling in is a
// push onto a trail rather than a special case. The trail's rules live in
// util/parChain.ts — including that re-entering somebody already in it truncates
// rather than appends, so a loop in the reporting data cannot grow it forever.
//
// Distinct from the chain view on PAR history, which walks the same structure
// over CLOSED cycles. Same shape, different question.

export default function ParReportChainPanel({
  parCycleId,
  rootEmail,
  rootName,
}: {
  parCycleId: number;
  rootEmail: string;
  rootName: string;
}): JSX.Element {
  const navigate = useNavigate();
  const [trail, setTrail] = useState<ParChainStep[]>([
    { email: rootEmail, name: rootName },
  ]);
  const current = trail[trail.length - 1];
  const reports = useReportsFor(parCycleId, current.email);
  const rows = reports.data ?? [];

  return (
    <ParSection
      title="Report chain"
      subtitle="Their own lead reviews them."
      action={
        trail.length > 1 ? (
          <Button
            size="small"
            startIcon={<ArrowLeftIcon size={15} />}
            onClick={() => setTrail(chainBack(trail))}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            Back
          </Button>
        ) : undefined
      }
    >
      <Breadcrumbs separator={<ChevronRightIcon size={14} />} sx={{ mb: 1.75 }}>
        {trail.map((step, i) =>
          i === trail.length - 1 ? (
            <Typography key={step.email} variant="body2" sx={{ fontWeight: 700 }}>
              {step.name}
            </Typography>
          ) : (
            <Link
              key={step.email}
              component="button"
              type="button"
              variant="body2"
              onClick={() => setTrail(chainTruncate(trail, i))}
              sx={{ cursor: "pointer" }}
            >
              {step.name}
            </Link>
          ),
        )}
      </Breadcrumbs>

      {reports.isError ? (
        <Alert severity="error">
          Couldn&apos;t load {current.name}&apos;s reports. {describeError(reports.error)}
        </Alert>
      ) : reports.isPending ? (
        <Skeleton variant="rectangular" height={140} sx={{ borderRadius: 1.5 }} />
      ) : rows.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {trail.length === 1
            ? "Nobody reports to you in this cycle."
            : `${current.name} has nobody reporting to them in this cycle.`}
        </Typography>
      ) : (
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                {["Person", "Their PAR", "Lead's review", "Rating", ""].map((h, i) => (
                  <TableCell key={h || `blank-${i}`} sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r) => {
                const awarded =
                  r.parRating && r.parRating !== PAR_RATING_NOT_ASSIGNED ? r.parRating : undefined;
                const name = r.parEmployeeName ?? r.parEmployeeEmail;
                return (
                  <TableRow key={r.parRatingId} hover>
                    <TableCell>
                      {/* Opening the review and drilling deeper are different
                          intents, so they are different controls. A row-level
                          click would have to guess which one was meant. */}
                      <Box
                        component="button"
                        type="button"
                        onClick={() =>
                          void navigate(`/me/par/team/${encodeURIComponent(r.parEmployeeEmail)}`)
                        }
                        sx={{
                          all: "unset",
                          cursor: "pointer",
                          fontWeight: 600,
                          fontSize: 14,
                          "&:focus-visible": {
                            outline: 2,
                            outlineStyle: "solid",
                            outlineColor: "primary.main",
                            outlineOffset: 2,
                          },
                        }}
                      >
                        {name}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        variant="outlined"
                        color={parEmployeeStatusMeta(r.parEmployeeStatus).color}
                        label={parEmployeeStatusMeta(r.parEmployeeStatus).label}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        variant="outlined"
                        color={parLeadStatusMeta(r.parLeadStatus).color}
                        label={parLeadStatusMeta(r.parLeadStatus).label}
                      />
                    </TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{awarded ?? "—"}</TableCell>
                    <TableCell align="right">
                      {/* Offered only for someone who has reports of their own —
                          a leaf drills into an empty level, which reads as the
                          control being broken. */}
                      {isReportALead(r) && (
                        <Button
                          size="small"
                          variant="outlined"
                          endIcon={<ChevronRightIcon size={14} />}
                          onClick={() =>
                            setTrail(
                              chainPush(trail, { email: r.parEmployeeEmail, name }),
                            )
                          }
                          sx={{ textTransform: "none", fontWeight: 600 }}
                        >
                          Their team
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>
      )}
    </ParSection>
  );
}
