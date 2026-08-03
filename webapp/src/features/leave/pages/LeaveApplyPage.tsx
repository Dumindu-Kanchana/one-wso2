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

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  Chip,
  Skeleton,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { describeError } from "../util/leaveError";
import { useNotifications } from "@context/notifications/NotificationsContext";
import LeaveShell from "../components/LeaveShell";
import {
  GENERAL_LEAVE_TYPES,
  LEAVE_TYPE_EMOJI,
  LEAVE_TYPE_LABEL,
  defaultLeaveTypeForLocation,
  type LeavePayload,
  type LeavePeriodType,
  type LeaveType,
} from "../api/leaveTypes";
import { useLeaveAppConfig, useLeaveEmployees, useLeaveUserInfo } from "../api/useLeaveData";
import { useSubmitLeave, useValidateLeave } from "../api/useLeaveMutations";
import { calendarDaysInclusive, startOfYearIso, todayIso } from "../util/leaveDates";

type Portion = "full" | "first" | "second";

export default function LeaveApplyPage() {
  return (
    <LeaveShell
      title="Apply for leave"
      subtitle="Request general leave — pick your dates, the leave type and portion, and who to notify. Working days are validated against the holiday calendar before you submit."
    >
      <ApplyForm />
    </LeaveShell>
  );
}

function ApplyForm() {
  const userInfo = useLeaveUserInfo();
  const appConfig = useLeaveAppConfig();
  const employees = useLeaveEmployees();
  const validate = useValidateLeave();
  const submit = useSubmitLeave();
  const { showSuccess, showError } = useNotifications();

  const today = todayIso();
  const yearStart = startOfYearIso(new Date().getFullYear());

  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [leaveType, setLeaveType] = useState<LeaveType>("casual");
  const [portion, setPortion] = useState<Portion>("full");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  // Seed the default leave type from the employee's location once known.
  const location = userInfo.data?.location ?? null;
  useEffect(() => {
    setLeaveType((prev) => (prev === "casual" ? defaultLeaveTypeForLocation(location) : prev));
    // Only re-seed when location resolves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  const days = calendarDaysInclusive(startDate, endDate);
  const rangeValid = days > 0;
  // Half-day only makes sense for a single calendar day.
  useEffect(() => {
    if (days !== 1 && portion !== "full") setPortion("full");
  }, [days, portion]);

  const { periodType, isMorningLeave } = useMemo<{
    periodType: LeavePeriodType;
    isMorningLeave: boolean | null;
  }>(() => {
    if (portion === "full") return { periodType: days === 1 ? "one" : "multiple", isMorningLeave: null };
    return { periodType: "half", isMorningLeave: portion === "first" };
  }, [portion, days]);

  // Live validation whenever the date range / portion changes.
  const validateMutate = validate.mutate;
  useEffect(() => {
    if (!rangeValid) return;
    validateMutate({ startDate, endDate, periodType, isMorningLeave, leaveType });
    // leaveType doesn't change working days, but include for parity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, periodType, isMorningLeave, rangeValid]);

  const workingDays = validate.data?.workingDays;
  const canSubmit =
    rangeValid &&
    !validate.isPending &&
    !validate.isError &&
    typeof workingDays === "number" &&
    workingDays >= 1 &&
    !submit.isPending &&
    Boolean(userInfo.data);

  const employeeOptions = useMemo(
    () => (employees.data ?? []).map((e) => e.workEmail).filter(Boolean),
    [employees.data],
  );
  const mandatory = useMemo(
    () => (appConfig.data?.cachedEmails.mandatoryMails ?? []).map((m) => m.email),
    [appConfig.data],
  );

  const handleSubmit = () => {
    if (!canSubmit) return;
    const emailRecipients = Array.from(new Set([...mandatory, ...recipients]));
    const payload: LeavePayload = {
      startDate,
      endDate,
      periodType,
      isMorningLeave,
      leaveType,
      emailRecipients,
      comment: comment.trim() || null,
      isPublicComment: isPublic,
    };
    submit.mutate(payload, {
      onSuccess: () => {
        showSuccess("Leave request submitted");
        // Reset to a clean single-day request.
        setComment("");
        setRecipients([]);
        setPortion("full");
        setStartDate(today);
        setEndDate(today);
      },
      onError: (err) => showError(describeError(err)),
    });
  };

  if (userInfo.isLoading) {
    return (
      <Stack spacing={1.75}>
        <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 1.5 }} />
        <Skeleton variant="rectangular" height={160} sx={{ borderRadius: 1.5 }} />
        <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 1.5 }} />
      </Stack>
    );
  }
  if (userInfo.isError) {
    return <Alert severity="error">Couldn't load your leave profile. {describeError(userInfo.error)}</Alert>;
  }

  return (
    <Stack spacing={1.75} sx={{ maxWidth: 880 }}>
      {/* Dates + working-day validity */}
      <Card variant="outlined" sx={{ p: 2 }}>
        <FieldLabel>Dates</FieldLabel>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr auto auto" }, gap: 1.5, alignItems: "end" }}>
          <DateField label="Start" value={startDate} min={yearStart} onChange={setStartDate} />
          <DateField label="End" value={endDate} min={startDate} onChange={setEndDate} />
          <Stat label="Days selected" value={rangeValid ? String(days) : "—"} />
          <Stat label="Working days" value={validate.isPending ? "…" : workingDays != null ? String(workingDays) : "—"} />
        </Box>
        <Box sx={{ mt: 1.25 }}>
          {!rangeValid ? (
            <Chip label="Select a valid date range" size="small" color="default" variant="outlined" sx={CHIP_SX} />
          ) : validate.isPending ? (
            <Chip label="Validating…" size="small" color="default" variant="outlined" sx={CHIP_SX} />
          ) : validate.isError ? (
            <Chip label={describeError(validate.error)} size="small" color="error" variant="outlined" sx={CHIP_SX} />
          ) : workingDays != null && workingDays < 1 ? (
            <Chip label="No working days in this range" size="small" color="warning" variant="outlined" sx={CHIP_SX} />
          ) : (
            <Chip label="Valid selection" size="small" color="success" variant="outlined" sx={CHIP_SX} />
          )}
        </Box>
      </Card>

      {/* Leave type + portion */}
      <Card variant="outlined" sx={{ p: 2 }}>
        <FieldLabel>Leave type</FieldLabel>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
          {GENERAL_LEAVE_TYPES.map((t) => {
            const active = t === leaveType;
            return (
              <Button
                key={t}
                size="small"
                variant={active ? "contained" : "outlined"}
                onClick={() => setLeaveType(t)}
                sx={{ fontSize: 12, fontWeight: 600, borderRadius: 1.25, textTransform: "none" }}
              >
                {LEAVE_TYPE_EMOJI[t]} {LEAVE_TYPE_LABEL[t]}
              </Button>
            );
          })}
        </Box>

        <FieldLabel>Portion of the day</FieldLabel>
        <Stack direction="row" spacing={1}>
          {(["full", "first", "second"] as Portion[]).map((p) => {
            const active = p === portion;
            const disabled = p !== "full" && days !== 1;
            return (
              <Button
                key={p}
                size="small"
                variant={active ? "contained" : "outlined"}
                disabled={disabled}
                onClick={() => setPortion(p)}
                sx={{ fontSize: 12, fontWeight: 600, borderRadius: 1.25, textTransform: "none" }}
              >
                {p === "full" ? "Full day" : p === "first" ? "First half" : "Second half"}
              </Button>
            );
          })}
        </Stack>
        {days !== 1 && (
          <Typography sx={{ fontSize: 11, color: "text.disabled", mt: 0.75 }}>
            Half-day options apply to single-day requests only.
          </Typography>
        )}
      </Card>

      {/* Notify + comment */}
      <Card variant="outlined" sx={{ p: 2 }}>
        <FieldLabel>Notify people</FieldLabel>
        <Autocomplete
          multiple
          size="small"
          options={employeeOptions}
          value={recipients}
          onChange={(_e, v) => setRecipients(v as string[])}
          loading={employees.isLoading}
          renderInput={(params) => (
            <TextField {...params} placeholder="Add people to notify (optional)" />
          )}
        />
        <Typography sx={{ fontSize: 11, color: "text.disabled", mt: 0.75 }}>
          Your lead and People Ops are always notified.
        </Typography>

        <Box sx={{ mt: 2 }}>
          <FieldLabel>Comment</FieldLabel>
          <TextField
            fullWidth
            size="small"
            multiline
            minRows={2}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add a comment (optional)…"
          />
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1 }}>
            <Switch size="small" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
            <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>
              Public comment (visible to everyone notified)
            </Typography>
          </Stack>
        </Box>
      </Card>

      {submit.isError && <Alert severity="error">{describeError(submit.error)}</Alert>}

      <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
        <Button variant="contained" onClick={handleSubmit} disabled={!canSubmit} sx={{ fontWeight: 600 }}>
          {submit.isPending ? "Submitting…" : "Submit leave"}
        </Button>
      </Box>
    </Stack>
  );
}

const CHIP_SX = { height: 22, fontSize: 11, fontWeight: 600 } as const;

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      sx={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em", color: "text.disabled", fontWeight: 600, mb: 1 }}
    >
      {children}
    </Typography>
  );
}

function DateField({
  label,
  value,
  min,
  onChange,
}: {
  label: string;
  value: string;
  min?: string;
  onChange: (v: string) => void;
}) {
  return (
    <Box>
      <Typography sx={{ fontSize: 11, color: "text.secondary", mb: 0.375 }}>{label}</Typography>
      <TextField
        type="date"
        size="small"
        fullWidth
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputProps={{ min }}
      />
    </Box>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Box
      sx={{
        border: 1,
        borderColor: "divider",
        borderRadius: 1,
        px: 1.5,
        py: 0.75,
        minWidth: 92,
        textAlign: "center",
      }}
    >
      <Typography sx={{ fontSize: 10, color: "text.disabled", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{value}</Typography>
    </Box>
  );
}
