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
  FormControlLabel,
  OutlinedInput,
  Skeleton,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@wso2/oxygen-ui";
import { SearchIcon } from "@wso2/oxygen-ui-icons-react";
import { useNavigate } from "react-router";
import { describeError } from "@api/errors";
import { PAR_RATING_NOT_ASSIGNED, type ParReportEntry } from "../api/parTypes";
import { filterReports, isReportALead } from "../util/parReports";
import { parEmployeeStatusMeta, parLeadStatusMeta } from "../util/parStatus";
import ParEmpty from "./ParEmpty";
import ParSection from "./ParSection";

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
  const [leadsOnly, setLeadsOnly] = useState(false);

  const shown = filterReports(reports, { query, leadsOnly });
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
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={leadsOnly}
                  onChange={(e) => setLeadsOnly(e.target.checked)}
                />
              }
              label={<Typography variant="body2">Leads only</Typography>}
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
                    {["Person", "Where they sit", "Their PAR", "Lead's review", "Rating"].map((h) => (
                      <TableCell key={h} sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {shown.map((r) => {
                    const awarded =
                      r.parRating && r.parRating !== PAR_RATING_NOT_ASSIGNED
                        ? r.parRating
                        : undefined;
                    return (
                      <TableRow
                        key={r.parRatingId}
                        hover
                        onClick={() => open(r.parEmployeeEmail)}
                        sx={{ cursor: "pointer" }}
                      >
                        <TableCell>
                          <Box
                            component="button"
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              open(r.parEmployeeEmail);
                            }}
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
                            {r.parEmployeeName ?? r.parEmployeeEmail}
                          </Box>
                          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                            {r.parEmployeeEmail}
                          </Typography>
                          {isReportALead(r) && (
                            <Chip size="small" variant="outlined" label="Lead" sx={{ mt: 0.5 }} />
                          )}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: "nowrap" }}>
                          <Typography variant="body2">
                            {[r.parTeam, r.parSubTeam].filter(Boolean).join(" · ") || "—"}
                          </Typography>
                          {/* Who actually reviews them, which is the point of
                              this list — the lead reading it does not. */}
                          {r.parDirectLead && (
                            <Typography variant="caption" color="text.secondary">
                              Reviewed by {r.parDirectLead}
                            </Typography>
                          )}
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
                        <TableCell sx={{ whiteSpace: "nowrap" }}>
                          {awarded ?? "—"}
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
