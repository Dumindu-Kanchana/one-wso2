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

import { Box, Button, Card, Typography } from "@wso2/oxygen-ui";
import { ArrowLeftIcon, LockIcon } from "@wso2/oxygen-ui-icons-react";
import { Link as RouterLink } from "react-router";
import { MARKETING_OPS_APPS } from "@constants/marketingOpsApps";

// What someone sees when they open Marketing Ops without being in any of its
// Asgardeo groups. Rendered by MarketingOpsShell for `authorized: false` only.
//
// ---- why this isn't an Alert any more ------------------------------------
//
// It used to be one line inside `<Alert severity="warning">`, which put it in the
// app's amber caution palette behind a warning triangle — the same treatment a
// failed request gets. Nothing has failed here. The person opened a door that
// isn't theirs yet, and dressing that as a fault made the screen read as broken.
//
// A padlock on a neutral surface says the same thing without the alarm, and it
// frees the amber for the state that IS a fault: the shell's `isError` branch,
// where /api/me itself failed. Those two were already distinguished in code and
// now look different too.
//
// ---- why the operations are listed --------------------------------------
//
// The old copy ended with "the group for the operation you need" while never
// saying what the operations are, so it asked for something the reader had no
// words for. The list is read from MARKETING_OPS_APPS, the same registry the rail
// and the waffle use, so it can't drift as operations are added.
//
// It shows OPERATION names only — no capability tokens (`emailworkbench`,
// `events-review`) and no Asgardeo group names. Those are backend vocabulary; see
// useMarketingOpsGate for where they live. And it discloses nothing new: the
// waffle already showed this person that Marketing Ops exists.
//
// ---- the one button -----------------------------------------------------
//
// "Ask a Marketing Ops admin" is prose rather than a link because there is
// nobody to link to: no support address, Slack channel or service-desk route is
// configured anywhere in the app. Inventing an address would be worse than
// saying it plainly. When a real destination exists
// it becomes the primary button and "Back to Home" moves to secondary.
//
// Back to Home goes to /me, which every authenticated employee can reach — it is
// also where App.tsx sends `/` and any unmatched route. Before this, the screen's
// only exit was the browser's back button, which is what made it feel like a wall
// rather than a locked door.
export default function MarketingOpsLocked() {
  return (
    <Card variant="outlined" sx={{ mt: 1.5, p: 3, maxWidth: 620 }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.75 }}>
        {/* Neutral, not tinted: the padlock is the whole message and it should
            not read as a status colour. */}
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
          {/* h2 under the shell's h1, so heading order holds for anyone
              navigating by headings. The perspective's name is deliberately not
              repeated here — the shell's title says it two lines above. */}
          <Typography
            component="h2"
            sx={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.02em", mb: 0.6 }}
          >
            You don't have access yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: "52ch" }}>
            Access comes from your Asgardeo groups, and each operation has its own.
            Ask a Marketing Ops admin for the group that covers the work you need to do.
          </Typography>
        </Box>
      </Box>

      <Box sx={{ height: "1px", bgcolor: "divider", my: 2.25 }} />

      <Typography
        component="h3"
        variant="overline"
        sx={{ color: "text.secondary", display: "block", mb: 1.25 }}
      >
        What's inside
      </Typography>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
          gap: "0.55rem 1.5rem",
        }}
      >
        {MARKETING_OPS_APPS.map((app) => (
          <Box
            key={app.key}
            sx={{ display: "flex", alignItems: "center", gap: 1.15, minWidth: 0 }}
          >
            <Box
              sx={{
                width: 22,
                height: 22,
                flexShrink: 0,
                borderRadius: 0.75,
                display: "grid",
                placeItems: "center",
                bgcolor: "background.default",
                border: 1,
                borderColor: "divider",
                color: "text.secondary",
              }}
              aria-hidden="true"
            >
              <app.icon size={13} />
            </Box>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            >
              {app.name}
            </Typography>
            {/* Decorative: every row in this list is locked, and the panel above
                has already said so in words. */}
            <Box
              sx={{ ml: "auto", display: "flex", color: "text.disabled", flexShrink: 0 }}
              aria-hidden="true"
            >
              <LockIcon size={12} />
            </Box>
          </Box>
        ))}
      </Box>

      <Box sx={{ height: "1px", bgcolor: "divider", my: 2.25 }} />

      {/* Outlined rather than contained: a11yThemeOverrides shifts outlined
          primary to primary.dark (5.77:1), while contained primary stays
          white-on-orange, which fails AA in both schemes — see the note there. */}
      <Button
        component={RouterLink}
        to="/me"
        variant="outlined"
        startIcon={<ArrowLeftIcon size={15} />}
        sx={{ textTransform: "none", fontSize: 13, fontWeight: 600 }}
      >
        Back to Home
      </Button>
    </Card>
  );
}
