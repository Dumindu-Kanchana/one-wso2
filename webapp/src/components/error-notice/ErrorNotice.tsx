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

import type { JSX, ReactNode } from "react";
import { Alert, Button, type AlertColor, type SxProps, type Theme } from "@wso2/oxygen-ui";
import { describeError } from "@api/errors";

// The one way this app reports a failed fetch.
//
// It was the same eleven-line block copy-pasted across nine files: an Alert, a
// Button in its action slot, a sentence, and the caught error appended. Two
// things kept going wrong in the copies. Some interpolated the raw error, which
// is how "[object Object]" reached users — Asgardeo's exception type is a plain
// class with no `extends Error` and no toString, so `String()` on it says
// nothing. And each copy drifted in its own direction on spacing and on whether
// Retry was offered at all.
//
// `error` goes through describeError, so no call site can print a raw one.

interface ErrorNoticeProps {
  /** What failed, in the reader's terms. Ends the sentence before the cause. */
  readonly children: ReactNode;
  /** The caught error, if there is one worth naming. Never rendered raw. */
  readonly error?: unknown;
  /** Omit to offer no retry — for a failure that retrying cannot fix. */
  readonly onRetry?: () => void;
  /** Disables the button while a retry is already in flight. */
  readonly retrying?: boolean;
  /** "info" for an expected refusal — a 403 is not an error to report. */
  readonly severity?: AlertColor;
  readonly sx?: SxProps<Theme>;
}

export default function ErrorNotice({
  children,
  error,
  onRetry,
  retrying = false,
  severity = "error",
  sx,
}: ErrorNoticeProps): JSX.Element {
  const cause = error === undefined ? "" : describeError(error);
  return (
    <Alert
      severity={severity}
      sx={sx}
      action={
        onRetry ? (
          <Button color="inherit" size="small" onClick={onRetry} disabled={retrying}>
            Retry
          </Button>
        ) : undefined
      }
    >
      {children}
      {cause ? ` ${cause}` : ""}
    </Alert>
  );
}
