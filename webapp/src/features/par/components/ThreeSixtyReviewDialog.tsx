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
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { describeError } from "@api/errors";
import { useMyThreeSixtyDraft } from "../api/useParEmployee";
import { useSubmitThreeSixtyReview } from "../api/useParEmployeeMutations";
import type { ParCycle } from "../api/parTypes";
import { isParHtmlEmpty, parConfiguredTextToHtml } from "../util/parHtml";
import ParHtml from "./ParHtml";
import ParRichText from "./ParRichText";

// Writing the 360 feedback a colleague asked for.
//
// Three ways out, and they are genuinely different: a draft stays private to
// the reviewer, submitting is final, and declining tells the asker not to wait.
// The source offered no way to decline from this screen even though the backend
// has a status for it, so an unwanted request simply sat there.
//
// Mounted only while open — the caller does `{active && <ThreeSixtyReviewDialog
// …/>}` — so every open starts from what is stored. Holding an `open` prop
// instead would keep the fields alive between opens, and reopening a request
// would silently show text typed and abandoned earlier rather than the draft
// the backend actually has.

export default function ThreeSixtyReviewDialog({
  onClose,
  cycle,
  revieweeEmail,
}: {
  onClose: () => void;
  cycle: ParCycle;
  revieweeEmail: string;
}): JSX.Element {
  const notifications = useNotifications();
  const submit = useSubmitThreeSixtyReview();
  // Always enabled: this component only exists while the form is open.
  const draft = useMyThreeSixtyDraft(cycle.parCycleId, revieweeEmail, true);

  const [rating, setRating] = useState<string>("");
  const [comment, setComment] = useState<string>("");
  // Seeded from whatever was loaded, once. Tracked by what it was seeded FROM
  // so a late-arriving draft still lands, without overwriting typing.
  const [seededFrom, setSeededFrom] = useState<string | null>(null);
  const loadedKey = draft.isPending ? null : `${revieweeEmail}:${draft.data?.reviewComment ?? ""}`;
  if (loadedKey !== null && seededFrom !== loadedKey) {
    setSeededFrom(loadedKey);
    setRating(draft.data?.reviewRating ?? "");
    setComment(draft.data?.reviewComment ?? "");
  }

  const options = cycle.parCycleConfigurations?.threeSixtyReviewRatings ?? [];
  // Admin-authored in a plain text box, so the same treatment as the employee
  // question: rendered, not printed.
  const questionHtml = parConfiguredTextToHtml(
    cycle.parCycleConfigurations?.threeSixtyReviewQuestion ??
      "How has this person contributed this cycle?",
  );

  const send = (reviewStatus: "DRAFT" | "SHARED" | "REJECTED") => {
    submit.mutate(
      {
        parCycleId: cycle.parCycleId,
        employeeEmail: revieweeEmail,
        reviewStatus,
        // A decline carries nothing: sending half-written text with it would
        // publish an opinion the reviewer chose not to give.
        ...(reviewStatus === "REJECTED" ? {} : { reviewRating: rating, reviewComment: comment }),
      },
      {
        onSuccess: () => {
          onClose();
          notifications.showSuccess(
            reviewStatus === "SHARED"
              ? "Feedback submitted"
              : reviewStatus === "REJECTED"
                ? "Request declined"
                : "Draft saved",
          );
        },
        onError: (err) => notifications.showError(describeError(err)),
      },
    );
  };

  // Submitting needs both halves. A rating with no words is not feedback, and
  // the backend takes either alone without complaint.
  const canSubmit = rating !== "" && !isParHtmlEmpty(comment);

  return (
    <Dialog
      open
      onClose={submit.isPending ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="par-360-title"
    >
      <DialogTitle id="par-360-title">Feedback for {revieweeEmail}</DialogTitle>
      <DialogContent dividers>
        {draft.isPending ? (
          <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", py: 2 }}>
            <CircularProgress size={16} />
            <Typography variant="body2" color="text.secondary">
              Loading anything you&apos;d already written…
            </Typography>
          </Stack>
        ) : (
          <>
            {draft.isError && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                Couldn&apos;t load an earlier draft, so this starts empty.{" "}
                {describeError(draft.error)}
              </Alert>
            )}

            <Box sx={{ mb: 2 }}>
              <ParHtml html={questionHtml} emptyText="No question was set for this cycle." />
            </Box>

            <TextField
              select
              size="small"
              label="Rating"
              value={rating}
              onChange={(e) => setRating(e.target.value)}
              sx={{ minWidth: 240, mb: 2 }}
            >
              {options.map((o) => (
                <MenuItem key={o} value={o}>
                  {o}
                </MenuItem>
              ))}
            </TextField>

            {/* Keyed on the reviewee so opening a different request reseeds the
                field, and stable while this one is open so typing survives. */}
            <ParRichText
              key={revieweeEmail}
              initialHtml={comment}
              onChange={setComment}
              label="Your feedback"
              maxChars={3000}
            />
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          size="small"
          color="inherit"
          onClick={() => send("REJECTED")}
          disabled={submit.isPending || draft.isPending}
        >
          Decline
        </Button>
        <span style={{ flex: 1 }} />
        <Button
          size="small"
          variant="outlined"
          onClick={() => send("DRAFT")}
          disabled={submit.isPending || draft.isPending}
          sx={{ textTransform: "none", fontWeight: 600 }}
        >
          Save draft
        </Button>
        <Button
          size="small"
          variant="contained"
          onClick={() => send("SHARED")}
          disabled={!canSubmit || submit.isPending || draft.isPending}
          sx={{ fontWeight: 600 }}
        >
          {submit.isPending ? "Submitting…" : "Submit"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
