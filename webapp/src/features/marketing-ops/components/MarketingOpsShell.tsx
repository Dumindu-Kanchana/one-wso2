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
import { Alert, Box, Chip, CircularProgress, Stack, Typography } from "@wso2/oxygen-ui";
import type { LucideIcon } from "@wso2/oxygen-ui-icons-react";
import { isMarketingOpsBackendConfigured } from "@config/apiConfig";
import { useMarketingOpsGate } from "../api/useMarketingOpsGate";
import MarketingOpsLocked from "./MarketingOpsLocked";
import ErrorNotice from "@components/error-notice/ErrorNotice";

// Shared page frame for every Marketing Ops screen: an operation eyebrow chip,
// a title + subtitle, and — the reason this exists — ONE place that owns all
// four degraded states, so no screen has to remember to handle them and none
// of them handles them differently:
//
//   1. backend URL not set        → say which config key is missing
//   2. /api/me still in flight    → spinner, never a premature denial
//   3. /api/me failed             → an error with a retry, NOT a denial
//   4. authorized: false          → say plainly that access is missing
//
// States 3 and 4 are the pair worth keeping distinct; see the note on
// MarketingOpsGate.isError for why collapsing them misleads the reader.
//
// Same role as FinanceShell, with the authorization states added. Finance
// doesn't need them because its three backends have no equivalent of Marketing
// Ops' "authenticated but not a member" answer: /api/me deliberately returns
// 200 with `authorized: false` rather than a 403, precisely so the UI can
// explain the situation instead of surfacing a raw failure.
//
// `requireAuthorized` exists for the eventual overview page, which should still
// render its deep-links out to Marketing Ops for someone who lacks access here —
// telling them where the real thing is beats a dead end.
export default function MarketingOpsShell({
  eyebrow,
  title,
  subtitle,
  requireAuthorized = true,
  children,
}: {
  // Which operation this screen belongs to — informational, not decorative: the
  // shell is shared by all six. A descriptor rather than a string so the icon is
  // the operation's OWN registry icon (MARKETING_OPS_EYEBROW) and the chip shows
  // the same glyph the left rail and the waffle show for it. This replaced a
  // hardcoded emoji per page ("📣 Email Workbench"), which said nothing the rail
  // didn't already say, in a different visual language. Same shape as
  // FinanceShell's eyebrow.
  //
  // Optional because the perspective landing page has no single operation to
  // name, and there the chip only restated the page title — see MarketingOpsPage.
  eyebrow?: { icon: LucideIcon; label: string };
  title: string;
  subtitle?: string;
  requireAuthorized?: boolean;
  children: ReactNode;
}) {
  const configured = isMarketingOpsBackendConfigured();
  // Only ask the backend who we are once we know there's a backend to ask.
  const gate = useMarketingOpsGate(configured);

  // The header changes on the locked state, so the shell has to know which
  // branch the body below will take. This mirrors the LAST rung of that ladder —
  // every earlier rung has to be excluded, or a caller whose /api/me is still in
  // flight (or failed) would be treated as denied for one render.
  const isLocked =
    configured &&
    requireAuthorized &&
    !gate.isResolving &&
    !gate.isError &&
    !gate.isAuthorized;

  return (
    <Box>
      {eyebrow && (
        <Chip
          icon={<eyebrow.icon size={14} />}
          label={eyebrow.label}
          color="primary"
          // Outlined, not filled: white-on-orange at chip text sizes is ~3.6:1 and
          // fails WCAG AA. Outlined routes through the a11y overlay, which shifts
          // the label and border to primary.dark in light mode. Matches the
          // Finance and Leave shells.
          variant="outlined"
          size="small"
          sx={{ mb: 0.5 }}
        />
      )}
      {/* An h1, not a styled div: it is the page's heading, and a screen-reader
          user navigating by headings had nothing to land on. */}
      <Typography component="h1" variant="h5" sx={{ mb: 0.5, mt: 0 }}>
        {title}
      </Typography>
      {/* The subtitle sells the screen — "Campaign operations, event lists and
          CRM ingestion" — which is right on a page you can use and wrong above a
          panel that is about to refuse you. The locked panel names the operations
          itself, so this would only be a pitch for something withheld. Dropped on
          THAT state alone; every screen you can open keeps it. */}
      {subtitle && !isLocked && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.25, maxWidth: "70ch" }}>
          {subtitle}
        </Typography>
      )}

      <MarketingOpsBody
        configured={configured}
        gate={gate}
        requireAuthorized={requireAuthorized}
      >
        {children}
      </MarketingOpsBody>
    </Box>
  );
}

// Split out so the header above stays readable — the state ladder is the part
// that carries the logic, and it reads better as a sequence of guards than as
// nested ternaries inside JSX.
function MarketingOpsBody({
  configured,
  gate,
  requireAuthorized,
  children,
}: {
  configured: boolean;
  gate: ReturnType<typeof useMarketingOpsGate>;
  requireAuthorized: boolean;
  children: ReactNode;
}) {
  if (!configured) {
    return (
      <Alert severity="info" sx={{ mt: 1.5 }}>
        Marketing Ops isn't connected yet. Set{" "}
        <code>ONE_WSO2_MARKETINGOPS_BACKEND_URL</code> in{" "}
        <code>public/config.js</code> (the backend URL) and reload.
      </Alert>
    );
  }

  // Hold the page until the authorization decision lands. Rendering the
  // unauthorized state first and correcting it a moment later would flash a
  // denial at people who do have access, on every single load.
  if (requireAuthorized && gate.isResolving) {
    return (
      <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", mt: 2 }}>
        <CircularProgress size={16} />
        <Typography variant="body2" color="text.secondary">
          Checking your Marketing Ops access…
        </Typography>
      </Stack>
    );
  }

  // Checked BEFORE the unauthorized state below. A failed request also leaves
  // us with no capabilities, so the order here is what stops a gateway timeout
  // from being reported as a missing permission — which would send someone
  // chasing an Asgardeo group they already have.
  if (requireAuthorized && gate.isError) {
    return (
      <ErrorNotice onRetry={gate.retry} sx={{ mt: 1.5 }}>
        Couldn't check your Marketing Ops access. {gate.errorMessage}
      </ErrorNotice>
    );
  }

  // Not an Alert: this is a locked door, not a fault. MarketingOpsLocked carries
  // the reasoning, and `isLocked` above has to agree with this condition.
  if (requireAuthorized && !gate.isAuthorized) {
    return <MarketingOpsLocked />;
  }

  return <>{children}</>;
}
