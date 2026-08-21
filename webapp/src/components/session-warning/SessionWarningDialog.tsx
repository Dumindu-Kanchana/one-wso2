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

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@wso2/oxygen-ui";
import type { JSX } from "react";

export interface SessionWarningDialogProps {
  open: boolean;
  /**
   * Whole minutes left before automatic sign-out, rounded up by the caller so
   * the last partial minute still reads as "1 minute" rather than "0".
   *
   * Omitted when auto sign-out is off. Nothing happens at the deadline then, so
   * the dialog must not claim otherwise — it asks the question and waits instead
   * of counting down to an event that never arrives.
   */
  remainingMinutes?: number;
  onContinue: () => void;
  onLogout: () => void;
}

/**
 * Dialog that asks "Are you still there?" when the user has been idle.
 * Continue resets the idle timer; Logout signs the user out.
 *
 * Whether ignoring this dialog ends the session is configuration, not layout:
 * with `ONE_WSO2_IDLE_AUTO_SIGN_OUT` enabled the session is signed out at the
 * deadline; with it off — the default — this is a prompt only and the session
 * stays open. That behaviour lives in IdleTimeoutProvider, not here.
 */
export default function SessionWarningDialog({
  open,
  remainingMinutes,
  onContinue,
  onLogout,
}: SessionWarningDialogProps): JSX.Element {
  return (
    <Dialog
      open={open}
      onClose={() => {
        // Explicit dialog actions only (Continue / Logout).
      }}
      maxWidth="sm"
      fullWidth
      aria-labelledby="session-warning-dialog-title"
    >
      <DialogTitle id="session-warning-dialog-title">
        Are you still there?
      </DialogTitle>
      <DialogContent>
        {/* aria-live so the minute count is announced as it changes; the dialog
            itself is only announced once, when it opens. */}
        <Typography color="text.secondary" aria-live="polite">
          It looks like you&apos;ve been inactive for a while.{" "}
          {remainingMinutes === undefined ? (
            // csm-portal's exact wording, for when nothing follows.
            <>Would you like to continue?</>
          ) : (
            <>
              Signing out in {remainingMinutes}{" "}
              {remainingMinutes === 1 ? "minute" : "minutes"}.
            </>
          )}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="outlined" onClick={onLogout}>
          Logout
        </Button>
        <Button variant="contained" color="primary" onClick={onContinue}>
          Continue
        </Button>
      </DialogActions>
    </Dialog>
  );
}
