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
import { useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { useSubmitLunchFeedback } from "../api/useMenuMutations";
import { describeError } from "../util/menuError";
import { formatMenuDate } from "../util/menuTime";
import { isFeedbackOpen, type TimeWindow } from "../util/menuWindows";
import WindowNotice from "./WindowNotice";

const MIN_LENGTH = 10;

// Lunch feedback. Open outside the window too, deliberately: the button that
// opens it stays enabled so someone who wants to leave feedback finds out WHY
// they can't rather than meeting a dead control.
export default function FeedbackDialog({
  open,
  onClose,
  now,
  menuDate,
  feedbackWindow,
}: {
  open: boolean;
  onClose: () => void;
  now: Date;
  menuDate: string | null;
  feedbackWindow: TimeWindow;
}) {
  const [message, setMessage] = useState("");
  const [touched, setTouched] = useState(false);
  const submit = useSubmitLunchFeedback();
  const { showSuccess, showError } = useNotifications();

  const windowOpen = isFeedbackOpen(now, menuDate, feedbackWindow);
  const tooShort = message.trim().length < MIN_LENGTH;

  const close = () => {
    setMessage("");
    setTouched(false);
    submit.reset();
    onClose();
  };

  const send = () => {
    setTouched(true);
    if (tooShort) return;
    submit.mutate(message.trim(), {
      onSuccess: () => {
        showSuccess("Lunch feedback submitted");
        close();
      },
      // The server says exactly why it refused — a closed window names the date
      // and the hours. Shown inline as well, since that is where the user is.
      onError: (err) => showError(describeError(err)),
    });
  };

  return (
    <Dialog open={open} onClose={submit.isPending ? undefined : close} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontSize: 17, fontWeight: 700 }}>Lunch feedback</DialogTitle>
      <DialogContent dividers>
        {windowOpen ? (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Your email is recorded along with your feedback.
            </Typography>
            <TextField
              fullWidth
              size="small"
              multiline
              minRows={4}
              label="Share your feedback"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onBlur={() => setTouched(true)}
              error={touched && tooShort}
              helperText={
                touched && tooShort ? `Feedback must be at least ${MIN_LENGTH} characters.` : " "
              }
            />
            {submit.isError && (
              <Alert severity="error" sx={{ mt: 1 }}>
                {describeError(submit.error)}
              </Alert>
            )}
          </>
        ) : (
          <WindowNotice window={feedbackWindow}>
            {(range) =>
              menuDate
                ? `Feedback is accepted on ${formatMenuDate(menuDate)} between ${range}.`
                : `Feedback is accepted between ${range} on the day of the menu.`
            }
          </WindowNotice>
        )}
      </DialogContent>
      <DialogActions>
        <Button size="small" onClick={close} disabled={submit.isPending}>
          {windowOpen ? "Cancel" : "Close"}
        </Button>
        {windowOpen && (
          <Button
            size="small"
            variant="contained"
            onClick={send}
            disabled={submit.isPending}
            sx={{ fontWeight: 600 }}
          >
            {submit.isPending ? "Submitting…" : "Submit"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
