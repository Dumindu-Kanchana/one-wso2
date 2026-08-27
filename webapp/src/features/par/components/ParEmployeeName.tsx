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

import type { JSX } from "react";
import { Box, IconButton, Tooltip, Typography } from "@wso2/oxygen-ui";
import { CopyIcon } from "@wso2/oxygen-ui-icons-react";
import { useNotifications } from "@context/notifications/NotificationsContext";

// The standalone app's employee-name cell: the name on its own, with the email
// hidden underneath at opacity 0. On hover the block lifts 10px and the email
// fades in, so the row never changes height. Four source views share the exact
// same markup — TeamSummary.tsx:165-248 (which the admin portal also renders,
// OrgSummary.tsx:1167), EmployeeReportView.tsx:112-170,
// ReportChainView.tsx:149-200, and OrgSummary's own employee columns at :465
// and :547.
//
// The three lead-portal views put a copy button next to the email; OrgSummary's
// own columns show the email alone. `copyable` is that difference, and nothing
// else varies between them.
//
// ChainViewTab (PAR History) has no email at all, so it does not use this.
const LIFT = "translateY(-10px)";

interface ParEmployeeNameProps {
  /** May be absent on a record with no name recorded; the email stands in. */
  readonly name?: string;
  readonly email: string;
  /** Renders the "Copy Email" button, as the three lead-portal views do. */
  readonly copyable?: boolean;
  /** When set, the name becomes the row's focusable control. */
  readonly onOpen?: () => void;
}

export function ParEmployeeName({
  name,
  email,
  copyable = false,
  onOpen,
}: ParEmployeeNameProps): JSX.Element {
  const notifications = useNotifications();

  const copy = (e: React.MouseEvent): void => {
    // Without this the row's own click handler fires and navigates away from
    // the row the user was copying from. The source stops propagation here too.
    e.stopPropagation();
    // Clipboard access is not guaranteed — an insecure origin or a denied
    // permission both leave it unavailable, and doing nothing silently reads as
    // the button being broken.
    void navigator.clipboard
      ?.writeText(email)
      .then(() => notifications.showSuccess("Email copied"))
      .catch(() =>
        notifications.showError("Couldn't copy — your browser refused clipboard access."),
      );
  };

  return (
    <Box
      sx={{
        position: "relative",
        display: "inline-block",
        transition: "transform 0.2s ease",
        "&:hover": { transform: LIFT, zIndex: 2 },
        // Hover alone would leave the copy button focusable but invisible — it
        // sits at opacity 0, not display none, so it stays in the tab order.
        // Revealing on focus-within is what keeps that from being a trap.
        "&:focus-within": { transform: LIFT, zIndex: 2 },
        "&:hover > .par-email, &:focus-within > .par-email": { opacity: 1 },
      }}
    >
      {onOpen ? (
        <Box
          component="button"
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
          sx={{
            all: "unset",
            display: "block",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 14,
            color: "text.primary",
            "&:focus-visible": {
              outline: 2,
              outlineStyle: "solid",
              outlineColor: "primary.main",
              outlineOffset: 2,
            },
          }}
        >
          {name ?? email}
        </Box>
      ) : (
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {name ?? email}
        </Typography>
      )}
      {/* Absolute, so revealing it cannot reflow the table.
          The source's rows are ~52px because the cell carries a 2.2rem avatar,
          which leaves the 10px lift enough room to fit the email inside the
          row. These tables are size="small" and 32.5px, so the reveal reaches
          9.5px past the cell (measured). Painting it opaque and above the rows
          below keeps it legible at this density; it lands in the 3px gap over
          the next row's name rather than on top of it. */}
      <Box
        className="par-email"
        sx={{
          position: "absolute",
          top: "100%",
          left: 0,
          display: "flex",
          alignItems: "center",
          whiteSpace: "nowrap",
          px: 0.5,
          borderRadius: 1,
          bgcolor: "background.paper",
          boxShadow: 2,
          opacity: 0,
          transition: "opacity 0.2s",
        }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ mr: copyable ? 0.5 : 0 }}>
          {email}
        </Typography>
        {copyable && (
          <Tooltip title="Copy Email" enterDelay={200} enterNextDelay={200}>
            <IconButton
              size="small"
              aria-label="Copy Email"
              onClick={copy}
              sx={{ width: 20, height: 20 }}
            >
              <CopyIcon size={13} />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Box>
  );
}
