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

import { Box, Card, Chip, Divider, Stack, Typography } from "@wso2/oxygen-ui";
import { NavLink } from "react-router";
import { MARKETING_OPS_APPS } from "@constants/marketingOpsApps";
import {
  isMarketingOpsWebAppConfigured,
  marketingOpsWebAppUrl,
} from "@config/apiConfig";
import MarketingOpsShell from "../components/MarketingOpsShell";
import { useMarketingOpsGate } from "../api/useMarketingOpsGate";
import { useMarketingOpsMe } from "../api/useMarketingOpsMe";

// Marketing Ops perspective overview.
//
// Right now this is the perspective's ONLY page, and it does double duty:
//
//  1. It is the landing route the rail and (eventually) the waffle point at.
//  2. It is the walking skeleton that proves the whole vertical actually works
//     in a browser — config key → access token → Choreo gateway →
//     x-jwt-assertion → /api/me → capability gate → rendered menu. Every one of
//     those hops was verified individually by curl before this existed; this is
//     where they're verified together, end to end, as the app really runs them.
//
// The "Your access" block below exists for (2) and should stay: when a Marketing
// Ops screen misbehaves for one person and not another, the first question is
// always "what does the backend think you can do?", and this answers it without
// anyone needing a terminal.
//
// The operation cards are deliberately rendered for operations that DON'T exist
// yet — an operation with no `path` in the registry is one this webapp hasn't
// ported, and its card links out to Marketing Ops proper instead of nowhere.
// That's what makes the strangler migration honest: the perspective is complete
// from day one, it just doesn't host everything yet.
export default function MarketingOpsPage() {
  const gate = useMarketingOpsGate();
  // requireAuthorized={false} on the shell — see below. That means this page can
  // render for someone the backend hasn't authorized, so it reads `me` directly
  // rather than assuming a successful gate.
  const me = useMarketingOpsMe();

  return (
    <MarketingOpsShell
      eyebrow="✦ Marketing Ops perspective"
      title="Marketing Ops"
      subtitle="Campaign operations, event lists and CRM ingestion. What you see is scoped to your Marketing Ops group membership."
      // Deliberately false: someone without Marketing Ops access should still
      // land here and be told where the real app is, rather than hitting a wall.
      // The access state is surfaced in the block below instead.
      requireAuthorized={false}
    >
      <AccessSummary gate={gate} email={me.data?.email} groupCount={me.data?.groups.length} />

      {MARKETING_OPS_APPS.map((app) => {
        // An app whose every item is hidden by the gate is hidden entirely —
        // no empty headings. Marketing Admin has no items until Phase 1 adds
        // its first panel, so it drops out here on length alone.
        const items = app.items.filter((it) => gate.canSee(it.id));
        if (items.length === 0) return null;
        return <AppSection key={app.key} app={app} items={items} />;
      })}
    </MarketingOpsShell>
  );
}

// What the backend says this caller can do. Reads as a sentence rather than a
// debug dump, because it's shown to real users on a real page — the raw claim
// echo belongs in the dev-only AuthDebugPanel, not here.
function AccessSummary({
  gate,
  email,
  groupCount,
}: {
  gate: ReturnType<typeof useMarketingOpsGate>;
  email?: string;
  groupCount?: number;
}) {
  return (
    <Card variant="outlined" sx={{ p: 1.75, mb: 1 }}>
      <Typography
        sx={{
          fontSize: 10.5,
          textTransform: "uppercase",
          letterSpacing: "0.07em",
          color: "text.disabled",
          fontWeight: 700,
          mb: 1,
        }}
      >
        Your access
      </Typography>

      {gate.isResolving ? (
        <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>
          Checking with the Marketing Ops backend…
        </Typography>
      ) : (
        <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", gap: 0.75 }}>
          <Chip
            size="small"
            label={gate.isAuthorized ? "Authorized" : "No Marketing Ops access"}
            color={gate.isAuthorized ? "success" : "warning"}
            sx={{ height: 22, fontSize: 11, fontWeight: 600 }}
          />
          {gate.isAdmin && (
            <Chip
              size="small"
              label="Marketing Ops admin"
              color="primary"
              sx={{ height: 22, fontSize: 11, fontWeight: 600 }}
            />
          )}
          {email && (
            <Chip
              size="small"
              variant="outlined"
              label={email}
              sx={{ height: 22, fontSize: 11 }}
            />
          )}
          {typeof groupCount === "number" && (
            <Chip
              size="small"
              variant="outlined"
              label={`${groupCount} Asgardeo group${groupCount === 1 ? "" : "s"}`}
              sx={{ height: 22, fontSize: 11 }}
            />
          )}
        </Stack>
      )}

      {!gate.isResolving && !gate.isAuthorized && !gate.isError && (
        <Typography sx={{ fontSize: 12, color: "text.secondary", mt: 1.25, lineHeight: 1.5 }}>
          Access to Marketing Ops is granted through Asgardeo group membership.
          Ask the Marketing Ops admins to add you to the group for the operation
          you need.
        </Typography>
      )}
    </Card>
  );
}

function AppSection({
  app,
  items,
}: {
  app: (typeof MARKETING_OPS_APPS)[number];
  items: (typeof MARKETING_OPS_APPS)[number]["items"];
}) {
  return (
    <Box>
      <Typography
        component="h2"
        sx={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "text.disabled",
          fontWeight: 700,
          mt: 3,
          mb: 1.25,
          display: "flex",
          alignItems: "center",
          gap: 1.25,
          "&::after": { content: '""', flex: 1, height: "1px", bgcolor: "divider" },
        }}
      >
        <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
          <span style={{ fontSize: 14 }}>{app.emoji}</span>
          {app.name}
        </Box>
      </Typography>
      <Typography sx={{ fontSize: 12.5, color: "text.secondary", mb: 1.5, mt: -0.5 }}>
        {app.purpose}
      </Typography>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(3, 1fr)" },
          gap: 1.5,
        }}
      >
        {items.map((it) => (
          <ItemCard key={it.id} id={it.id} label={it.label} desc={it.desc} path={it.path} />
        ))}
      </Box>
    </Box>
  );
}

// One operation screen. Three shapes, decided by whether the screen exists here
// yet and whether we know where the old app lives:
//
//   ported            → a NavLink card into this webapp
//   not ported, URL   → an outbound link to Marketing Ops, marked as such
//   not ported, no URL→ an inert card saying it's not available here yet
//
// The third case is what you get with ONE_WSO2_MARKETINGOPS_WEB_APP_URL unset:
// still honest, just less helpful. Never render a link we can't complete.
function ItemCard({
  id,
  label,
  desc,
  path,
}: {
  id: string;
  label: string;
  desc: string;
  path?: string;
}) {
  const ported = Boolean(path);
  const canLinkOut = !ported && isMarketingOpsWebAppConfigured();

  const cardSx = {
    p: 1.75,
    display: "flex",
    flexDirection: "column",
    gap: 0.5,
    textDecoration: "none",
    color: "inherit",
    ...(ported || canLinkOut
      ? {
          transition: "border-color .12s, box-shadow .12s",
          "&:hover": { borderColor: "primary.main", boxShadow: 1 },
        }
      : { opacity: 0.72 }),
  } as const;

  // The rail scrolls to section ids on the overview, so each card carries its
  // registry id as an anchor — that's the contract appsToSections assumes for
  // any item without a `path`.
  const linkProps = ported
    ? { component: NavLink, to: path! }
    : canLinkOut
      ? {
          component: "a" as const,
          href: marketingOpsWebAppUrl,
          target: "_blank",
          rel: "noopener noreferrer",
        }
      : {};

  return (
    <Card id={id} variant="outlined" sx={cardSx} {...linkProps}>
      <Stack direction="row" alignItems="center" spacing={0.75}>
        <Typography sx={{ fontSize: 13.5, fontWeight: 600, flex: 1, minWidth: 0 }}>
          {label}
        </Typography>
        {!ported && (
          <Chip
            label={canLinkOut ? "In Marketing Ops ↗" : "Not here yet"}
            size="small"
            variant="outlined"
            sx={{ height: 20, fontSize: 10, fontWeight: 600, borderWidth: 1.5 }}
          />
        )}
      </Stack>
      <Typography sx={{ fontSize: 12, color: "text.secondary", lineHeight: 1.45 }}>
        {desc}
      </Typography>
      {!ported && !canLinkOut && (
        <>
          <Divider sx={{ my: 0.5 }} />
          <Typography sx={{ fontSize: 11, color: "text.disabled", lineHeight: 1.45 }}>
            Still in Marketing Ops. Set{" "}
            <code>ONE_WSO2_MARKETINGOPS_WEB_APP_URL</code> to link there.
          </Typography>
        </>
      )}
    </Card>
  );
}
