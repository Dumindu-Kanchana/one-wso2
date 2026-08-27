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
import { Alert, Button, Chip, MenuItem, Stack, TextField, Typography } from "@wso2/oxygen-ui";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { describeError } from "@api/errors";
import { useRecordF2f } from "../api/useParLead";
import type { ParCycle, ParF2fStatus, ParRating } from "../api/parTypes";
import { canRecordF2f, isCycleClosed } from "../util/parDeadlines";
import { formatParDate } from "../util/parDates";
import { parF2fStatusMeta } from "../util/parStatus";
import ParSection from "./ParSection";

// The face-to-face conversation record.
//
// Unlocked by the lead sharing their review, and gated by its own deadline —
// which is later than the lead deadline, because the conversation happens after
// the review is written. A shared review with no conversation recorded is the
// state this exists to make visible.

const F2F_OPTIONS: { value: ParF2fStatus; label: string }[] = [
  { value: "PENDING", label: "Not scheduled" },
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "COMPLETED", label: "Held" },
];

export default function LeadF2fPanel({
  now,
  cycle,
  rating,
}: {
  now: Date;
  cycle: ParCycle;
  rating: ParRating;
}): JSX.Element {
  const notifications = useNotifications();
  const record = useRecordF2f();

  const [status, setStatus] = useState<ParF2fStatus>(rating.parF2fStatus ?? "PENDING");
  const [date, setDate] = useState<string>(rating.parF2fDate?.slice(0, 10) ?? "");

  const meta = parF2fStatusMeta(rating.parF2fStatus);
  const notShared = rating.parLeadStatus !== "SHARED";
  const closed = isCycleClosed(cycle);
  const deadlinePassed = !canRecordF2f(now, cycle);
  const readOnly = notShared || closed || deadlinePassed;

  // A held conversation without a date is not a record of anything, so the
  // date is required for that status only.
  const needsDate = status === "COMPLETED" || status === "SCHEDULED";
  const dirty = status !== (rating.parF2fStatus ?? "PENDING") || date !== (rating.parF2fDate?.slice(0, 10) ?? "");

  const submit = () => {
    record.mutate(
      {
        parCycleId: cycle.parCycleId,
        parRatingId: rating.parRatingId,
        employeeEmail: rating.parEmployeeEmail,
        parF2fStatus: status,
        ...(needsDate && date !== "" ? { parF2fDate: date } : {}),
      },
      {
        onSuccess: () => notifications.showSuccess("Conversation record updated"),
        onError: (err) => notifications.showError(describeError(err)),
      },
    );
  };

  return (
    <ParSection
      title="Face-to-face conversation"
      subtitle="Recorded after you share your review. This is what closes the cycle for them."
      action={
        <Chip
          size="small"
          variant="outlined"
          color={meta.color}
          label={
            rating.parF2fDate && rating.parF2fStatus !== "PENDING"
              ? `${meta.label} · ${formatParDate(rating.parF2fDate)}`
              : meta.label
          }
        />
      }
    >
      {readOnly ? (
        <Alert severity="info">
          {notShared
            ? "Share your review first — the conversation record opens after that."
            : closed
              ? "This cycle is closed, so the record can no longer change."
              : "The deadline for recording the conversation has passed."}
        </Alert>
      ) : (
        <Stack spacing={2}>
          <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap", gap: 1.5 }}>
            <TextField
              select
              size="small"
              label="Status"
              value={status}
              onChange={(e) => setStatus(e.target.value as ParF2fStatus)}
              sx={{ minWidth: 200 }}
            >
              {F2F_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              size="small"
              type="date"
              label={status === "COMPLETED" ? "Date held" : "Date"}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={!needsDate}
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ minWidth: 200 }}
            />
          </Stack>

          {record.isError && <Alert severity="error">{describeError(record.error)}</Alert>}

          <Stack direction="row" sx={{ justifyContent: "flex-end" }}>
            <Button
              size="small"
              variant="contained"
              onClick={submit}
              // A held conversation with no date would be recorded as having
              // happened on no particular day.
              disabled={!dirty || record.isPending || (needsDate && date === "")}
              sx={{ fontWeight: 600 }}
            >
              {record.isPending ? "Saving…" : "Save record"}
            </Button>
          </Stack>

          {needsDate && date === "" && (
            <Typography variant="caption" color="text.secondary">
              Pick a date to save this.
            </Typography>
          )}
        </Stack>
      )}
    </ParSection>
  );
}
