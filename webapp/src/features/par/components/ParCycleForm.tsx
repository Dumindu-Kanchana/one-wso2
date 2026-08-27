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
  Divider,
  Stack,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { PlusIcon, XIcon } from "@wso2/oxygen-ui-icons-react";
import ParRichText from "./ParRichText";
import ParSection from "./ParSection";
import {
  emptyParCycleForm,
  parCycleFormProblems,
  type ParCycleFormValues,
} from "../util/parCycleForm";

// Creating a cycle, and editing an open one's configuration.
//
// One component for both, because the standalone app's two forms
// (ParCreationForm and ParCycleSettingsForm) collect the same fields with the
// same rules — the difference is which are editable and what the button says.
// Two copies would drift, and the rules are the part that must not.
//
// The rules themselves are in util/parCycleForm.ts, ported field for field and
// message for message. Nothing is validated here.

const DATE_FIELDS: { key: keyof ParCycleFormValues; label: string; help?: string }[] = [
  { key: "parCycleStartDate", label: "Cycle starts" },
  { key: "parCycleEndDate", label: "Cycle ends" },
  { key: "parEvaluationStartDate", label: "Evaluation opens" },
  { key: "parEvaluationEndDate", label: "Evaluation closes" },
  { key: "parEmployeeDeadline", label: "Employee deadline" },
  { key: "parThreeSixtyRatingDeadline", label: "360° deadline" },
  {
    key: "parLeadDeadline",
    label: "Lead deadline",
    help: "Must fall after the employee deadline, not on the same day.",
  },
  {
    key: "parSpecialRatingDeadline",
    label: "Top 5% / 20% deadline",
    help: "Informational only — nothing is locked when it passes.",
  },
  { key: "parF2FDeadline", label: "Conversation deadline" },
];

export default function ParCycleForm({
  initial,
  mode,
  isSaving,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<ParCycleFormValues>;
  /** "create" collects everything; "edit" is the same form on an open cycle. */
  mode: "create" | "edit";
  isSaving: boolean;
  onSubmit: (values: ParCycleFormValues) => void;
  onCancel?: () => void;
}): JSX.Element {
  const [values, setValues] = useState<ParCycleFormValues>(() => ({
    ...emptyParCycleForm(),
    ...initial,
  }));
  // Problems are computed on every render but only SHOWN for fields the user
  // has left, so a blank form does not open covered in red.
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const problems = parCycleFormProblems(values);
  const shows = (key: keyof ParCycleFormValues) =>
    (submitted || touched.has(key)) && problems[key] !== undefined;

  const set = <K extends keyof ParCycleFormValues>(key: K, value: ParCycleFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));
  const leave = (key: keyof ParCycleFormValues) =>
    setTouched((t) => new Set(t).add(String(key)));

  return (
    <>
      <ParSection
        title={mode === "create" ? "New review cycle" : "Cycle configuration"}
        subtitle={
          mode === "create"
            ? "Creating a cycle starts a background job. It stays pending until that finishes."
            : "Changes apply to this cycle. The org-wide defaults are on the settings screen."
        }
      >
        <Stack spacing={2.5}>
          <TextField
            size="small"
            label="Cycle name"
            value={values.parCycleName}
            onChange={(e) => set("parCycleName", e.target.value)}
            onBlur={() => leave("parCycleName")}
            error={shows("parCycleName")}
            helperText={shows("parCycleName") ? problems.parCycleName : " "}
            sx={{ maxWidth: 420 }}
          />

          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
              DATES
            </Typography>
            <Box
              sx={{
                mt: 1,
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(3, 1fr)" },
                gap: 2,
              }}
            >
              {DATE_FIELDS.map((f) => (
                <TextField
                  key={String(f.key)}
                  size="small"
                  type="date"
                  label={f.label}
                  value={values[f.key] as string}
                  onChange={(e) => set(f.key, e.target.value as never)}
                  onBlur={() => leave(f.key)}
                  error={shows(f.key)}
                  helperText={shows(f.key) ? problems[f.key] : (f.help ?? " ")}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              ))}
            </Box>
          </Box>

          <Divider />

          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
              THE EMPLOYEE&apos;S QUESTION
            </Typography>
            <Box sx={{ mt: 0.75 }}>
              <ParRichText
                initialHtml={values.employeeParQuestion}
                onChange={(html) => set("employeeParQuestion", html)}
                label="The employee's question"
                maxChars={2000}
              />
            </Box>
            {shows("employeeParQuestion") && (
              <Typography variant="caption" color="error">
                {problems.employeeParQuestion}
              </Typography>
            )}
          </Box>

          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
              THE 360° QUESTION
            </Typography>
            <Box sx={{ mt: 0.75 }}>
              <ParRichText
                initialHtml={values.threeSixtyReviewQuestion}
                onChange={(html) => set("threeSixtyReviewQuestion", html)}
                label="The 360° question"
                maxChars={2000}
              />
            </Box>
            {shows("threeSixtyReviewQuestion") && (
              <Typography variant="caption" color="error">
                {problems.threeSixtyReviewQuestion}
              </Typography>
            )}
          </Box>

          <Divider />

          <RatingList
            label="PAR ratings"
            help="The scale a lead picks from. At least one."
            values={values.parRatings}
            problem={shows("parRatings") ? problems.parRatings : undefined}
            onChange={(next) => set("parRatings", next)}
          />
          <RatingList
            label="360° ratings"
            help="The scale a 360° reviewer picks from. At least one."
            values={values.threeSixtyReviewRatings}
            problem={shows("threeSixtyReviewRatings") ? problems.threeSixtyReviewRatings : undefined}
            onChange={(next) => set("threeSixtyReviewRatings", next)}
          />

          {submitted && Object.keys(problems).length > 0 && (
            <Alert severity="warning">
              {Object.keys(problems).length === 1
                ? "One field needs attention before this can be saved."
                : `${Object.keys(problems).length} fields need attention before this can be saved.`}
            </Alert>
          )}

          <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
            {onCancel && (
              <Button size="small" onClick={onCancel} disabled={isSaving}>
                Cancel
              </Button>
            )}
            <Button
              size="small"
              variant="contained"
              onClick={() => {
                setSubmitted(true);
                if (Object.keys(problems).length === 0) onSubmit(values);
              }}
              disabled={isSaving}
              sx={{ fontWeight: 600 }}
            >
              {isSaving
                ? mode === "create"
                  ? "Creating…"
                  : "Saving…"
                : mode === "create"
                  ? "Create cycle"
                  : "Save changes"}
            </Button>
          </Stack>
        </Stack>
      </ParSection>
    </>
  );
}

/** A free-text list of rating values, added one at a time. */
function RatingList({
  label,
  help,
  values,
  problem,
  onChange,
}: {
  label: string;
  help: string;
  values: string[];
  problem?: string;
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const trimmed = draft.trim();
  // Case-insensitive, because two ratings differing only in case would be
  // indistinguishable in a dropdown.
  const duplicate = values.some((v) => v.toLowerCase() === trimmed.toLowerCase());

  const add = () => {
    if (trimmed === "" || duplicate) return;
    onChange([...values, trimmed]);
    setDraft("");
  };

  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
        {label.toUpperCase()}
      </Typography>
      {values.length > 0 && (
        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75, mt: 0.75 }}>
          {values.map((v) => (
            <Chip
              key={v}
              size="small"
              label={v}
              onDelete={() => onChange(values.filter((x) => x !== v))}
              // Named: an icon-only delete has no accessible name of its own, so
              // it is unreachable for anyone not clicking it with a mouse.
              deleteIcon={<XIcon size={14} aria-label={`Remove ${v}`} />}
            />
          ))}
        </Stack>
      )}
      <Stack direction="row" spacing={1} sx={{ mt: 1, alignItems: "flex-start" }}>
        <TextField
          size="small"
          label="Add a rating"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            add();
          }}
          error={duplicate}
          helperText={duplicate ? "That rating is already listed." : (problem ?? help)}
          sx={{ maxWidth: 360, flex: 1 }}
        />
        <Button
          size="small"
          onClick={add}
          disabled={trimmed === "" || duplicate}
          startIcon={<PlusIcon size={15} />}
          sx={{ textTransform: "none", fontWeight: 600, mt: 0.25 }}
        >
          Add
        </Button>
      </Stack>
      {problem && !duplicate && (
        <Typography variant="caption" color="error">
          {problem}
        </Typography>
      )}
    </Box>
  );
}
