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
  Chip,
  OutlinedInput,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@wso2/oxygen-ui";
import { SearchIcon } from "@wso2/oxygen-ui-icons-react";
import { useNavigate } from "react-router";
import { describeError } from "@api/errors";
import type { ParReportEntry } from "../api/parTypes";
import { filterReports } from "../util/parReports";
import ParEmpty from "./ParEmpty";
import ParSection from "./ParSection";
import { ParEmployeeName } from "./ParEmployeeName";
import { ParRatingCells, ParReviewAction } from "./ParRatingCells";
import { PAR_RATING_HEADERS } from "../util/parRatingColumns";

// A list of people somewhere in the lead's reporting line.
//
// Used for the indirect reports, where the lead is not the direct reviewer but
// still has visibility. Read-only in the sense that this screen writes nothing;
// a row opens the review, which decides for itself whether it is editable.

export default function ParReportsPanel({
  title,
  subtitle,
  reports,
  isPending,
  error,
}: {
  title: string;
  subtitle: string;
  reports: readonly ParReportEntry[];
  isPending: boolean;
  error?: unknown;
}): JSX.Element {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  // EmployeeReportView.tsx:287-289 searches the email only, so a name it
  // shows is not a term it finds. Matching the name too is a superset: it
  // hides nothing, and the email is now behind a hover.
  const shown = filterReports(reports, { query, leadsOnly: false });
  const open = (email: string) => void navigate(`/me/par/team/${encodeURIComponent(email)}`);

  return (
    <ParSection
      title={title}
      subtitle={subtitle}
      action={
        <Chip
          size="small"
          variant="outlined"
          label={
            shown.length === reports.length
              ? `${reports.length}`
              : `${shown.length} of ${reports.length}`
          }
        />
      }
    >
      {error ? (
        <Alert severity="error">Couldn&apos;t load these reports. {describeError(error)}</Alert>
      ) : isPending ? (
        <Skeleton variant="rectangular" height={160} sx={{ borderRadius: 1.5 }} />
      ) : reports.length === 0 ? (
        <ParEmpty>
          Nobody reports to you indirectly in this cycle.
        </ParEmpty>
      ) : (
        <>
          <Stack
            direction="row"
            sx={{ alignItems: "center", gap: 2, mb: 1.75, flexWrap: "wrap" }}
          >
            <OutlinedInput
              size="small"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or email"
              startAdornment={
                <Box sx={{ display: "inline-flex", mr: 0.75, color: "text.secondary" }}>
                  <SearchIcon size={15} />
                </Box>
              }
              // On the input itself, not the wrapper — a bare aria-label on
              // OutlinedInput names the surrounding div, which names nothing.
              slotProps={{ input: { "aria-label": "Search reports" } }}
              sx={{ height: 36, fontSize: 13, width: { xs: "100%", sm: 300 } }}
            />
          </Stack>

          {shown.length === 0 ? (
            <ParEmpty>
              Nobody here matches that.
            </ParEmpty>
          ) : (
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {["Team Member", ...PAR_RATING_HEADERS, ""].map((h, i) => (
                      <TableCell key={h || `blank-${i}`} sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {shown.map((r) => {
                    return (
                      <TableRow key={r.parRatingId} hover>
                        <TableCell>
                          {/* EmployeeReportView.tsx:109-170. It never reads
                              isEmployeeALead — that field drives ReportChainView's
                              drill-in and its leads-only switch, and nothing here. */}
                          <ParEmployeeName
                            name={r.parEmployeeName}
                            email={r.parEmployeeEmail}
                            copyable
                          />
                        </TableCell>
                        <ParRatingCells row={r} />
                        <TableCell align="right">
                          <ParReviewAction
                            shared={r.parLeadStatus === "SHARED"}
                            onOpen={() => open(r.parEmployeeEmail)}
                            label={r.parEmployeeName ?? r.parEmployeeEmail}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Box>
          )}
        </>
      )}
    </ParSection>
  );
}
