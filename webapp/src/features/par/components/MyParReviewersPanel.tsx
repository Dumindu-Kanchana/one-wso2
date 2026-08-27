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
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { PlusIcon, XIcon } from "@wso2/oxygen-ui-icons-react";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { describeError } from "@api/errors";
import { useNominateReviewers } from "../api/useParEmployeeMutations";
import type { ParCycle, ParReviewer } from "../api/parTypes";
import { isDeadlinePassed } from "../util/parDeadlines";
import { canNominateReviewers } from "../util/parEditability";
import {
  REVIEWER_PROBLEM_TEXT,
  acceptableReviewers,
  normalizeEmail,
  reviewerProblem,
} from "../util/parReviewers";
import { parThreeSixtyStatusMeta } from "../util/parStatus";
import ParSection from "./ParSection";

// Asking colleagues for 360 feedback.
//
// Addresses are staged locally and sent in one request, matching the backend's
// array payload. Each is validated as it is added rather than on submit, so a
// refusal names the address it is about.

export default function MyParReviewersPanel({
  now,
  cycle,
  selfEmail,
  leadEmail,
  reviewers,
  isLoading,
  error,
}: {
  now: Date;
  cycle: ParCycle | undefined;
  selfEmail: string | undefined;
  leadEmail: string | null | undefined;
  reviewers: ParReviewer[];
  isLoading: boolean;
  error?: unknown;
}): JSX.Element {
  const notifications = useNotifications();
  const nominate = useNominateReviewers();
  const [input, setInput] = useState("");
  const [staged, setStaged] = useState<string[]>([]);

  const open = canNominateReviewers(now, cycle);
  const deadlinePassed = isDeadlinePassed(now, cycle?.parThreeSixtyRatingDeadline);
  const alreadyAsked = reviewers.map((r) => r.reviewerEmail);

  // Checked against what is already stored AND what is already staged, so the
  // same address cannot be added twice before anything is sent.
  const problem = reviewerProblem(input, {
    selfEmail,
    leadEmail,
    existing: [...alreadyAsked, ...staged],
  });
  // An empty box is not an error worth showing — it is the resting state.
  const showProblem = input.trim() !== "" && problem !== null;

  const add = () => {
    if (problem !== null) return;
    setStaged((prev) => [...prev, normalizeEmail(input)]);
    setInput("");
  };

  const send = () => {
    if (!cycle) return;
    const emails = acceptableReviewers(staged, {
      selfEmail,
      leadEmail,
      existing: alreadyAsked,
    });
    if (emails.length === 0) return;
    nominate.mutate(
      { parCycleId: cycle.parCycleId, reviewerEmails: emails },
      {
        onSuccess: () => {
          setStaged([]);
          notifications.showSuccess(
            emails.length === 1 ? "Feedback requested" : `Feedback requested from ${emails.length}`,
          );
        },
        onError: (err) => notifications.showError(describeError(err)),
      },
    );
  };

  return (
    <ParSection
      title="360° feedback"
      subtitle="Ask colleagues who have worked with you this cycle. Your lead reviews your PAR separately."
    >
      {error ? (
        <Alert severity="error">Couldn&apos;t load your reviewers. {describeError(error)}</Alert>
      ) : (
        <>
          {reviewers.length > 0 && (
            <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1, mb: open ? 2 : 0 }}>
              {reviewers.map((r) => {
                const meta = parThreeSixtyStatusMeta(r.reviewStatus, { deadlinePassed });
                return (
                  <Chip
                    key={r.reviewerEmail}
                    size="small"
                    variant="outlined"
                    color={meta.color}
                    // The status is part of the label rather than only a colour,
                    // so it does not depend on distinguishing hues.
                    label={`${r.reviewerEmail} · ${meta.label}`}
                  />
                );
              })}
            </Stack>
          )}

          {reviewers.length === 0 && !isLoading && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: open ? 2 : 0 }}>
              You haven&apos;t asked anyone yet.
            </Typography>
          )}

          {!open ? (
            <Alert severity="info" sx={{ mt: 1.5 }}>
              {cycle === undefined
                ? "No review cycle is open at the moment."
                : "The deadline for requesting 360° feedback has passed."}
            </Alert>
          ) : (
            <Box>
              <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
                <TextField
                  size="small"
                  type="email"
                  label="Colleague's email"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    // Enter adds an address; it must not submit anything, since
                    // sending is a separate, deliberate act.
                    e.preventDefault();
                    add();
                  }}
                  error={showProblem}
                  helperText={showProblem ? REVIEWER_PROBLEM_TEXT[problem] : " "}
                  sx={{ maxWidth: 340, flex: 1 }}
                />
                <Tooltip title="Add to the list">
                  <span>
                    <IconButton
                      onClick={add}
                      disabled={problem !== null}
                      aria-label="Add to the list"
                      sx={{ mt: 0.25 }}
                    >
                      <PlusIcon size={18} />
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>

              {staged.length > 0 && (
                <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1, mt: 0.5 }}>
                  {staged.map((email) => (
                    <Chip
                      key={email}
                      size="small"
                      label={email}
                      onDelete={() => setStaged((prev) => prev.filter((e) => e !== email))}
                      deleteIcon={<XIcon size={14} />}
                    />
                  ))}
                </Stack>
              )}

              {nominate.isError && (
                <Alert severity="error" sx={{ mt: 1.5 }}>
                  {describeError(nominate.error)}
                </Alert>
              )}

              <Stack direction="row" sx={{ mt: 1.75, justifyContent: "flex-end" }}>
                <Button
                  size="small"
                  variant="contained"
                  onClick={send}
                  disabled={staged.length === 0 || nominate.isPending}
                  sx={{ fontWeight: 600 }}
                >
                  {nominate.isPending
                    ? "Requesting…"
                    : staged.length > 1
                      ? `Request from ${staged.length}`
                      : "Request feedback"}
                </Button>
              </Stack>
            </Box>
          )}
        </>
      )}
    </ParSection>
  );
}
