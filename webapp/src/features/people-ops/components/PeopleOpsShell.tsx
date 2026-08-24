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

import type { ReactNode } from "react";
import { Alert, Box, Button, Chip, CircularProgress, Stack, Typography } from "@wso2/oxygen-ui";
import { isPeopleBackendConfigured } from "../api/useEmployeeReport";
import { usePeopleOpsGate } from "../api/usePeopleOpsGate";

// Shared page frame for the People Ops report screens. Same role and same
// state ladder as MarketingOpsShell — deliberately, so the two perspectives
// degrade identically rather than each inventing its own vocabulary:
//
//   1. backend URL not set     → name the missing config key
//   2. /user-info in flight    → spinner, never a premature denial
//   3. /user-info failed       → an error with a retry, NOT a denial
//   4. decided: not an admin   → say plainly that access is missing
//
// Keeping 3 and 4 apart is the point of the ladder. Collapsing them tells
// someone whose request merely timed out that they lack a privilege, and
// sends them off chasing an Asgardeo group they already hold.
//
// The reports are ADMIN-only in the backend (both POST /employees/search in
// its org-wide form and POST /reports/employees/generate return 403). This
// shell is UX, not enforcement: it explains the 403 that would otherwise
// arrive as a bare error, and it must not be mistaken for the access control.
//
// `requireAdmin` defaults on; a future People Ops page that is genuinely open
// to everyone can opt out without reimplementing states 1–3.
export default function PeopleOpsShell({
  eyebrow,
  title,
  subtitle,
  requireAdmin = true,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle?: ReactNode;
  requireAdmin?: boolean;
  children: ReactNode;
}) {
  const configured = isPeopleBackendConfigured();
  const gate = usePeopleOpsGate();

  return (
    <Box>
      <Chip
        label={eyebrow}
        color="primary"
        // Outlined, not filled — white-on-orange at chip text sizes measures
        // ~3.6:1 and fails WCAG AA. Matches the Marketing Ops/Finance shells.
        variant="outlined"
        size="small"
        sx={{ mb: 0.5 }}
      />
      {/* A real h1: the page's heading, so heading navigation has a landmark. */}
      <Typography component="h1" variant="h5" sx={{ mb: 0.5, mt: 0 }}>
        {title}
      </Typography>
      {subtitle && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.25, maxWidth: "70ch" }}>
          {subtitle}
        </Typography>
      )}

      <PeopleOpsBody configured={configured} gate={gate} requireAdmin={requireAdmin}>
        {children}
      </PeopleOpsBody>
    </Box>
  );
}

// Split out so the header stays readable — the ladder carries the logic and
// reads better as a sequence of guards than as nested ternaries in JSX.
function PeopleOpsBody({
  configured,
  gate,
  requireAdmin,
  children,
}: {
  configured: boolean;
  gate: ReturnType<typeof usePeopleOpsGate>;
  requireAdmin: boolean;
  children: ReactNode;
}) {
  if (!configured) {
    return (
      <Alert severity="info" sx={{ mt: 1.5 }}>
        People Ops isn't connected yet. Set{" "}
        <code>ONE_WSO2_PEOPLE_BACKEND_URL</code> in <code>public/config.js</code>{" "}
        (the backend URL) and reload.
      </Alert>
    );
  }

  // Hold the page until the decision lands. Rendering the denial first and
  // correcting it a moment later would flash "no access" at the admins who
  // do have it, on every single load.
  if (requireAdmin && gate.isResolving) {
    return (
      <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", mt: 2 }}>
        <CircularProgress size={16} />
        <Typography variant="body2" color="text.secondary">
          Checking your People Ops access…
        </Typography>
      </Stack>
    );
  }

  // Checked BEFORE the denial below: a failed request also leaves us holding
  // no privileges, so this order is what stops a gateway timeout from being
  // reported as a missing permission.
  if (requireAdmin && gate.isError) {
    return (
      <Alert
        severity="error"
        sx={{ mt: 1.5 }}
        action={
          <Button color="inherit" size="small" onClick={gate.retry}>
            Retry
          </Button>
        }
      >
        Couldn't check your People Ops access. {gate.errorMessage}
      </Alert>
    );
  }

  if (requireAdmin && !gate.isAdmin) {
    return (
      <Alert severity="warning" sx={{ mt: 1.5 }}>
        You don't have access to this report. People Ops reports cover the whole
        organisation, so they're limited to the People Ops admin team — ask them
        if you need access.
      </Alert>
    );
  }

  return <>{children}</>;
}
