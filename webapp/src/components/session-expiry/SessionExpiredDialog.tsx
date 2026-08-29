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

export interface SessionExpiredDialogProps {
  open: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
}

/**
 * Shown when the app has stopped being able to renew the session in the
 * background and has given up trying.
 *
 * Distinct from SessionWarningDialog, which asks an idle user whether they are
 * still there and can be answered by staying put. Nothing here can be answered
 * by waiting: every backend call is being refused, so the only ways out are a
 * fresh sign-in or leaving.
 *
 * No dismiss path, and no auto-redirect either. Dismissing would leave someone
 * clicking around an app that silently fails every request, and redirecting
 * without asking would discard whatever they had typed with no warning.
 */
export default function SessionExpiredDialog({
  open,
  onSignIn,
  onSignOut,
}: SessionExpiredDialogProps): JSX.Element {
  return (
    <Dialog
      open={open}
      onClose={() => {
        // Explicit actions only — see above.
      }}
      maxWidth="sm"
      fullWidth
      aria-labelledby="session-expired-dialog-title"
      aria-describedby="session-expired-dialog-body"
    >
      <DialogTitle id="session-expired-dialog-title">Your session has expired</DialogTitle>
      <DialogContent>
        <Typography id="session-expired-dialog-body" color="text.secondary">
          We couldn&apos;t renew it in the background, so the app can&apos;t load or save
          anything right now. Signing in again takes a moment and brings you back to this
          page — but anything unsaved here will be lost.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="outlined" onClick={onSignOut}>
          Sign out
        </Button>
        <Button variant="contained" color="primary" onClick={onSignIn}>
          Sign in again
        </Button>
      </DialogActions>
    </Dialog>
  );
}
