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
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from "@wso2/oxygen-ui";
import { ArrowLeftIcon, LockIcon, type LucideIcon } from "@wso2/oxygen-ui-icons-react";
import { Link as RouterLink } from "react-router";
import { isParBackendConfigured } from "../api/useParMe";
import { useParGate } from "../api/useParGate";

/**
 * Which role a screen needs. Named for the role rather than passed as a boolean
 * pair, so a screen can't accidentally ask for both or neither.
 */
export type ParRequirement = "employee" | "teamLead" | "admin";

// Shared page frame for every PAR screen: an eyebrow chip, a title + subtitle,
// and one place that owns all four degraded states so no screen re-implements
// them:
//
//   1. backend URL not set    → name the missing config key
//   2. role check in flight   → spinner, never a premature denial
//   3. role check failed      → an error with a retry, NOT a denial
//   4. role not held          → a locked door, not a fault
//
// Same shape as MarketingOpsShell, which is where states 3 and 4 were first kept
// apart; collapsing them sends someone chasing a permission they already have
// when the real problem was a gateway timeout.
export default function ParShell({
  eyebrow,
  title,
  subtitle,
  require: requirement = "employee",
  children,
}: {
  eyebrow?: { icon: LucideIcon; label: string };
  title: string;
  subtitle?: string;
  // `require` shadows nothing in a module context, but it is a reserved-ish word
  // to read, hence the rename on destructure.
  require?: ParRequirement;
  children: ReactNode;
}) {
  const configured = isParBackendConfigured();
  const gate = useParGate(configured);

  // Every signed-in employee has their own PAR, so an "employee" screen has no
  // decision to wait for and no way to be refused. Asking the gate to hold those
  // screens would put a spinner in front of a check whose answer is always yes.
  // Only the two restricted requirements consult it.
  const gated = requirement !== "employee";
  const permitted = requirement === "admin" ? gate.isAdmin : gate.isTeamLead;

  // The header changes on the locked state, so it has to know which branch the
  // body will take — every earlier rung excluded, or someone whose check is
  // still in flight reads as denied for one render.
  const isLocked =
    configured && gated && !gate.isResolving && !gate.isError && !permitted;

  return (
    <Box>
      {eyebrow && (
        <Chip
          icon={<eyebrow.icon size={14} />}
          label={eyebrow.label}
          color="primary"
          // Outlined, not filled: white-on-orange at chip text sizes is ~3.6:1
          // and fails WCAG AA. Outlined routes through the a11y overlay.
          variant="outlined"
          size="small"
          sx={{ mb: 0.5 }}
        />
      )}
      <Typography component="h1" variant="h5" sx={{ mb: 0.5, mt: 0 }}>
        {title}
      </Typography>
      {/* Dropped on the locked state alone: a subtitle selling a screen is right
          on one you can open and wrong above a panel about to refuse you. */}
      {subtitle && !isLocked && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.25, maxWidth: "70ch" }}>
          {subtitle}
        </Typography>
      )}

      <ParBody configured={configured} gate={gate} gated={gated} permitted={permitted}>
        {children}
      </ParBody>
    </Box>
  );
}

// Split out so the header stays readable — the ladder reads better as a sequence
// of guards than as nested ternaries inside JSX.
function ParBody({
  configured,
  gate,
  gated,
  permitted,
  children,
}: {
  configured: boolean;
  gate: ReturnType<typeof useParGate>;
  gated: boolean;
  permitted: boolean;
  children: ReactNode;
}) {
  if (!configured) {
    return (
      <Alert severity="info" sx={{ mt: 1.5 }}>
        PAR isn't connected yet. Set <code>ONE_WSO2_PAR_BACKEND_URL</code> in{" "}
        <code>public/config.js</code> (the backend URL) and reload.
      </Alert>
    );
  }

  if (gated && gate.isResolving) {
    return (
      <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", mt: 2 }}>
        <CircularProgress size={16} />
        <Typography variant="body2" color="text.secondary">
          Checking your PAR access…
        </Typography>
      </Stack>
    );
  }

  // Before the locked state below. A failed request also leaves us holding no
  // role, so this order is what stops a backend outage from being reported as a
  // missing permission.
  if (gated && gate.isError) {
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
        Couldn't check your PAR access. {gate.errorMessage}
      </Alert>
    );
  }

  if (gated && !permitted) {
    return <ParLocked />;
  }

  return <>{children}</>;
}

// A locked door, not a fault — so no Alert and no amber, which stays reserved
// for the isError branch above.
//
// The copy deliberately doesn't name the Asgardeo group or the `isTeamLead`
// flag: those are backend vocabulary, and someone who isn't a lead can do
// nothing with either. It also discloses nothing new — the rail hides these
// screens, but the person reached this URL somehow, so they already know it
// exists.
//
// The exit goes to the reader's own PAR rather than Home: they are already
// inside PAR and there is a screen here that IS theirs.
function ParLocked() {
  return (
    <Card variant="outlined" sx={{ mt: 1.5, p: 3, maxWidth: 620 }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.75 }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            flexShrink: 0,
            borderRadius: 1.5,
            display: "grid",
            placeItems: "center",
            bgcolor: "background.default",
            border: 1,
            borderColor: "divider",
            color: "text.secondary",
          }}
          aria-hidden="true"
        >
          <LockIcon size={19} />
        </Box>
        <Box>
          {/* h2 under the shell's h1, so heading order holds. */}
          <Typography component="h2" variant="subtitle1" sx={{ mb: 0.5 }}>
            This part of PAR isn't yours to open
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            It's limited to the people who run performance reviews — team leads
            for their own reports, and the PAR administrators for everyone. Your
            own review is unaffected.
          </Typography>
          <Button
            component={RouterLink}
            to="/me/par"
            variant="outlined"
            size="small"
            startIcon={<ArrowLeftIcon size={16} />}
          >
            Back to my PAR
          </Button>
        </Box>
      </Box>
    </Card>
  );
}
