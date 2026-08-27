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
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@wso2/oxygen-ui";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { describeError } from "@api/errors";
import {
  PAR_REMINDER_LABELS,
  useAllCycleTeams,
  useCycleParRatings,
  useSendParReminder,
  useSetParCycleStatus,
  useUpdateParCycle,
  type ParReminderKind,
} from "../api/useParAdmin";
import { PAR_RATING_NOT_ASSIGNED, type ParCycle } from "../api/parTypes";
import { allTeamsTotals, completionPercent } from "../util/parTeamSummary";
import { formatParDate, formatParPeriod } from "../util/parDates";
import {
  parCycleStatusMeta,
  parEmployeeStatusMeta,
  parF2fStatusMeta,
  parLeadStatusMeta,
  parSpecialRatingMeta,
} from "../util/parStatus";
import type { ParCycleFormValues } from "../util/parCycleForm";
import ParCompletionBar from "./ParCompletionBar";
import ParCycleForm from "./ParCycleForm";
import ParEmpty from "./ParEmpty";
import ParPanel from "./ParPanel";
import ParSection from "./ParSection";

// The org-wide view of a cycle: how far it has got, who still owes something,
// and the two things only an admin can do — change the configuration and close
// it.
//
// `readOnly` is for the history tab, where the same summary is shown for a cycle
// that is already closed.

const REMINDERS: ParReminderKind[] = ["employees", "leads", "specialRating", "threeSixty"];

export default function ParAdminSummaryPanel({
  cycle,
  readOnly = false,
}: {
  cycle: ParCycle;
  readOnly?: boolean;
}): JSX.Element {
  const notifications = useNotifications();
  const teams = useAllCycleTeams(cycle.parCycleId);
  const [showReport, setShowReport] = useState(false);
  const ratings = useCycleParRatings(cycle.parCycleId, showReport);
  const [editing, setEditing] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const update = useUpdateParCycle();
  const setStatus = useSetParCycleStatus();
  const remind = useSendParReminder();

  const list = teams.data ?? [];
  const totals = allTeamsTotals(list);
  const status = parCycleStatusMeta(cycle.parCycleStatus);

  if (editing) {
    return (
      <ParPanel>
        <ParCycleForm
          mode="edit"
          isSaving={update.isPending}
          initial={{
            parCycleName: cycle.parCycleName,
            parCycleStartDate: cycle.parCycleStartDate?.slice(0, 10) ?? "",
            parCycleEndDate: cycle.parCycleEndDate?.slice(0, 10) ?? "",
            parEvaluationStartDate: cycle.parEvaluationStartDate?.slice(0, 10) ?? "",
            parEvaluationEndDate: cycle.parEvaluationEndDate?.slice(0, 10) ?? "",
            parEmployeeDeadline: cycle.parEmployeeDeadline?.slice(0, 10) ?? "",
            parThreeSixtyRatingDeadline: cycle.parThreeSixtyRatingDeadline?.slice(0, 10) ?? "",
            parLeadDeadline: cycle.parLeadDeadline?.slice(0, 10) ?? "",
            parSpecialRatingDeadline: cycle.parSpecialRatingDeadline?.slice(0, 10) ?? "",
            parF2FDeadline: cycle.parF2FDeadline?.slice(0, 10) ?? "",
            employeeParQuestion: cycle.parCycleConfigurations?.employeeParQuestion ?? "",
            threeSixtyReviewQuestion: cycle.parCycleConfigurations?.threeSixtyReviewQuestion ?? "",
            parRatings: cycle.parCycleConfigurations?.parRatings ?? [],
            threeSixtyReviewRatings: cycle.parCycleConfigurations?.threeSixtyReviewRatings ?? [],
          }}
          onCancel={() => setEditing(false)}
          onSubmit={(values: ParCycleFormValues) =>
            update.mutate(
              { parCycleId: cycle.parCycleId, values: values as unknown as Record<string, unknown> },
              {
                onSuccess: () => {
                  setEditing(false);
                  notifications.showSuccess("Cycle updated");
                },
                onError: (err) => notifications.showError(describeError(err)),
              },
            )
          }
        />
      </ParPanel>
    );
  }

  return (
    <>
      <ParPanel>
        <ParSection
          title={cycle.parCycleName}
          subtitle={formatParPeriod(cycle.parCycleStartDate, cycle.parCycleEndDate)}
          action={
            <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", flexWrap: "wrap" }}>
              <Chip size="small" variant="outlined" color={status.color} label={status.label} />
              {!readOnly && (
                <>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => setEditing(true)}
                    sx={{ textTransform: "none", fontWeight: 600 }}
                  >
                    Configuration
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    onClick={() => setConfirmClose(true)}
                    sx={{ textTransform: "none", fontWeight: 600 }}
                  >
                    Close cycle
                  </Button>
                </>
              )}
            </Stack>
          }
        >
          {teams.isPending ? (
            <Skeleton variant="rectangular" height={90} sx={{ borderRadius: 1.5 }} />
          ) : teams.isError ? (
            <Alert severity="error">
              Couldn&apos;t load the cycle&apos;s teams. {describeError(teams.error)}
            </Alert>
          ) : (
            <Stack direction="row" sx={{ flexWrap: "wrap", gap: 2.5 }}>
              <ParCompletionBar
                label="PARs shared"
                completed={totals.employeeParComplete}
                total={totals.totalMembers}
              />
              <ParCompletionBar
                label="360° complete"
                completed={totals.threeSixtyComplete}
                total={totals.totalMembers}
              />
              <ParCompletionBar
                label="Lead reviews shared"
                completed={totals.leadReviewComplete}
                total={totals.totalMembers}
              />
              <ParCompletionBar
                label="Conversations held"
                completed={totals.f2fComplete}
                total={totals.totalMembers}
              />
            </Stack>
          )}
        </ParSection>

        {!readOnly && (
          <ParSection
            title="Bulk reminders"
            subtitle="The server decides who is outstanding — there is nobody to choose."
          >
            <Stack spacing={1}>
              {REMINDERS.map((kind) => (
                <Stack
                  key={kind}
                  direction="row"
                  sx={{ alignItems: "center", gap: 1.5, py: 0.5 }}
                >
                  <Typography variant="body2" sx={{ flex: 1 }}>
                    {PAR_REMINDER_LABELS[kind]}
                  </Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    disabled={remind.isPending}
                    onClick={() =>
                      remind.mutate(kind, {
                        onSuccess: () => notifications.showSuccess("Reminders sent"),
                        onError: (err) => notifications.showError(describeError(err)),
                      })
                    }
                    sx={{ textTransform: "none", fontWeight: 600, flexShrink: 0 }}
                  >
                    Send
                  </Button>
                </Stack>
              ))}
            </Stack>
          </ParSection>
        )}

        <ParSection
          title="Teams"
          subtitle="Every team in the cycle, and how far each has got."
          action={
            <Button
              size="small"
              variant={showReport ? "contained" : "outlined"}
              onClick={() => setShowReport((v) => !v)}
              sx={{ textTransform: "none", fontWeight: 600 }}
            >
              {showReport ? "Hide everyone" : "Show everyone"}
            </Button>
          }
        >
          {teams.isPending ? (
            <Skeleton variant="rectangular" height={140} sx={{ borderRadius: 1.5 }} />
          ) : list.length === 0 ? (
            <ParEmpty>This cycle has no teams.</ParEmpty>
          ) : (
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {["Team", "Lead", "People", "PARs", "Reviews", "Conversations"].map((h) => (
                      <TableCell key={h} sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {list.map((t) => (
                    <TableRow key={t.parTeamId} hover>
                      <TableCell>
                        {[t.parBusinessUnit, t.parDepartment, t.parTeam, t.parSubTeam]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </TableCell>
                      <TableCell>{t.parLeadEmail}</TableCell>
                      <TableCell sx={{ fontVariantNumeric: "tabular-nums" }}>
                        {t.numberOfTeamMembers}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>
                        {t.summary?.employeeParCompletedCount ?? 0} / {t.numberOfTeamMembers}
                        {" · "}
                        {Math.round(
                          completionPercent(
                            t.summary?.employeeParCompletedCount ?? 0,
                            t.numberOfTeamMembers,
                          ),
                        )}
                        %
                      </TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>
                        {t.summary?.leadsReviewCompletedCount ?? 0} / {t.numberOfTeamMembers}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>
                        {t.summary?.f2fCompletedCount ?? 0} / {t.numberOfTeamMembers}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </ParSection>

        {/* The org-wide participant list, fetched only when asked for: it is one
            row per person in the organisation. */}
        {showReport && (
          <ParSection title="Everyone in this cycle" subtitle="One row per participant.">
            {ratings.isPending ? (
              <Skeleton variant="rectangular" height={160} sx={{ borderRadius: 1.5 }} />
            ) : ratings.isError ? (
              <Alert severity="error">
                Couldn&apos;t load the participant list. {describeError(ratings.error)}
              </Alert>
            ) : (ratings.data ?? []).length === 0 ? (
              <ParEmpty>No participants recorded for this cycle.</ParEmpty>
            ) : (
              <Box sx={{ overflowX: "auto", maxHeight: 420, overflowY: "auto" }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      {["Person", "Their PAR", "Lead's review", "Conversation", "Rating"].map(
                        (h) => (
                          <TableCell key={h} sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                            {h}
                          </TableCell>
                        ),
                      )}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(ratings.data ?? []).map((r) => {
                      const awarded =
                        r.parRating && r.parRating !== PAR_RATING_NOT_ASSIGNED
                          ? r.parRating
                          : undefined;
                      const special = parSpecialRatingMeta(r.parSpecialRating);
                      return (
                        <TableRow key={r.parRatingId} hover>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {r.parEmployeeName ?? r.parEmployeeEmail}
                            </Typography>
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
                            {parF2fStatusMeta(r.parF2fStatus).label}
                            {r.parF2fDate ? ` · ${formatParDate(r.parF2fDate)}` : ""}
                          </TableCell>
                          <TableCell sx={{ whiteSpace: "nowrap" }}>
                            {awarded ?? "—"}
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
            )}
          </ParSection>
        )}
      </ParPanel>

      <Dialog open={confirmClose} onClose={() => setConfirmClose(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Close {cycle.parCycleName}?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Closing ends the cycle for everyone: no employee, lead or reviewer can change anything
            in it afterwards, and the backend refuses further writes. It cannot be reopened from
            here.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button size="small" onClick={() => setConfirmClose(false)} disabled={setStatus.isPending}>
            Cancel
          </Button>
          <Button
            size="small"
            variant="contained"
            color="error"
            onClick={() =>
              setStatus.mutate(
                { parCycleId: cycle.parCycleId, parCycleStatus: "CLOSED" },
                {
                  onSuccess: () => {
                    setConfirmClose(false);
                    notifications.showSuccess("Cycle closed");
                  },
                  onError: (err) => {
                    setConfirmClose(false);
                    notifications.showError(describeError(err));
                  },
                },
              )
            }
            disabled={setStatus.isPending}
            sx={{ fontWeight: 600 }}
          >
            {setStatus.isPending ? "Closing…" : "Close it"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
