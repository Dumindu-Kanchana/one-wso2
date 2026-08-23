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

import { Box, Card, Typography } from "@wso2/oxygen-ui";
import { SatelliteDishIcon, type LucideIcon } from "@wso2/oxygen-ui-icons-react";
import { NavLink } from "react-router";
import { MARKETING_OPS_APPS } from "@constants/marketingOpsApps";
import { isIsacConfigured, isacUrl } from "@config/apiConfig";
import MarketingOpsShell from "../components/MarketingOpsShell";
import { useMarketingOpsGate } from "../api/useMarketingOpsGate";

// Marketing Ops perspective landing page: one tile per operation, and nothing else.
//
// It used to be a page of prose — 285 words across 17 item cards, each carrying a
// full sentence, under an operation-level "purpose" line that mostly repeated them.
// That reads as documentation, and a landing page's first job is to get you out of
// it. So the descriptions are gone and the tile is the unit: an operation, its
// screens as links, no explanation. The labels already say what the screens are.
//
// What else went, and why:
//
//   - The "Your access" card. It showed the caller's own email address and their
//     Asgardeo group COUNT, which is diagnostic rather than useful — it existed to
//     prove the gateway hop worked when this was the perspective's only page. The
//     access states now come from MarketingOpsShell, which already distinguishes
//     all four (unconfigured / resolving / request failed / not authorized) and
//     says the same thing about Asgardeo groups in the denial case.
//
//   - `requireAuthorized={false}`. Its whole purpose was to let an unauthorized
//     visitor land here and be pointed at Marketing Ops proper instead of hitting a
//     wall. There is nothing left to point at — every operation is ported — so the
//     shell's warning is now the honest answer, and it is better written than the
//     block this page kept alongside it.
//
//   - ItemCard's "Not here yet" / "In Marketing Ops ↗" states, which could no
//     longer render for the same reason.
//
//   - The "✦ Marketing Ops perspective" eyebrow chip. Every operation screen now
//     shows an eyebrow carrying its OWN icon and name, which tells you which of the
//     six you are in. On this page the chip only restated the title under it, and
//     PerspectiveHeader dropped the identical sparkle chip from the other
//     perspective pages for that reason — the rail already says where you are. It
//     is the one Marketing Ops eyebrow that is removed rather than re-iconed.
export default function MarketingOpsPage() {
  const gate = useMarketingOpsGate();

  // Marketing Admin is pulled out of the grid: it configures the other operations
  // rather than being one, and it holds more items than any of them. As a tile it
  // was the biggest thing on a page it should be the quietest thing on.
  const operations = MARKETING_OPS_APPS.filter((app) => app.key !== "admin");
  const admin = MARKETING_OPS_APPS.find((app) => app.key === "admin");
  const adminItems = (admin?.items ?? []).filter((it) => gate.canSee(it.id));

  return (
    <MarketingOpsShell
      title="Marketing Ops"
      subtitle="Campaign operations, event lists and CRM ingestion."
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(214px, 1fr))",
          gap: 1.75,
        }}
      >
        {/* ISAC leads, matching the rail. It is a separate application rather than an
            operation, so it gets a tile rather than a route — but a reader who has just
            used the rail should find the same thing in the same place. Omitted entirely
            when unconfigured. */}
        {isIsacConfigured() && <IsacTile />}

        {operations.map((app) => {
          // An operation whose every screen is hidden by the gate is hidden
          // entirely — an empty tile is worse than no tile, because it advertises
          // something and then refuses to open it.
          const items = app.items.filter((it) => gate.canSee(it.id));
          if (items.length === 0) return null;
          return (
            <OperationTile
              key={app.key}
              icon={app.icon}
              name={app.name}
              items={items}
            />
          );
        })}
      </Box>

      {admin && adminItems.length > 0 && <AdminStrip icon={admin.icon} items={adminItems} />}
    </MarketingOpsShell>
  );
}

// ---- one operation ---------------------------------------------------------

const glyphSx = {
  width: 34,
  height: 34,
  flexShrink: 0,
  borderRadius: 1.25,
  display: "grid",
  placeItems: "center",
  bgcolor: "background.default",
  border: 1,
  borderColor: "divider",
} as const;

const countSx = { fontSize: 11, color: "text.disabled" } as const;

// A screen link. The chevron is a ::before rather than a character in the label so
// it can't be selected or read out — it's a bullet, not content.
const linkSx = {
  display: "flex",
  alignItems: "center",
  gap: 0.9,
  mx: -0.75,
  px: 0.75,
  py: 0.75,
  borderRadius: 0.75,
  fontSize: 13,
  color: "text.secondary",
  textDecoration: "none",
  "&::before": { content: '"\\203A"', color: "text.disabled", fontSize: 13, lineHeight: 1 },
  "&:hover": { bgcolor: "background.default", color: "primary.main" },
  "&:hover::before": { color: "primary.main" },
  // The rail navigates straight to these routes, so the tile's link for the
  // screen you're already on should say so.
  "&.active": { color: "primary.main", fontWeight: 600 },
} as const;

function OperationTile({
  icon: Icon,
  name,
  items,
}: {
  icon: LucideIcon;
  name: string;
  items: (typeof MARKETING_OPS_APPS)[number]["items"];
}) {
  return (
    <Card
      variant="outlined"
      sx={{
        p: 2,
        display: "flex",
        flexDirection: "column",
        gap: 1.4,
        transition: "border-color .12s, box-shadow .12s",
        "&:hover": { borderColor: "text.disabled", boxShadow: 1 },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
        <Box sx={glyphSx} aria-hidden="true">
          <Icon size={18} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography component="h2" sx={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.015em" }}>
            {name}
          </Typography>
          {/* A count is worth showing when it tells you how much is in here; for a
              single-screen operation the link below already says everything. */}
          {items.length > 1 && (
            <Typography sx={countSx}>{items.length} screens</Typography>
          )}
        </Box>
      </Box>

      <Box sx={{ display: "flex", flexDirection: "column", gap: "1px", mb: -0.5 }}>
        {items.map((it) => (
          // The registry id stays on the anchor: appsToSections treats an item
          // without a `path` as a scroll target on this page, and though every item
          // has one today, keeping the id means a future path-less item still works.
          <Box key={it.id} id={it.id} component={NavLink} to={it.path!} sx={linkSx}>
            {it.label}
          </Box>
        ))}
      </Box>
    </Card>
  );
}

// ---- ISAC ------------------------------------------------------------------

function IsacTile() {
  return (
    <Card
      variant="outlined"
      sx={{
        p: 2,
        display: "flex",
        flexDirection: "column",
        gap: 1.4,
        transition: "border-color .12s, box-shadow .12s",
        "&:hover": { borderColor: "text.disabled", boxShadow: 1 },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
        {/* Tinted rather than neutral: the one tile that leaves One WSO2 is worth
            being able to spot without reading it. */}
        <Box sx={{ ...glyphSx, bgcolor: "primary.light", borderColor: "transparent" }} aria-hidden="true">
          <SatelliteDishIcon size={18} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography component="h2" sx={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.015em" }}>
            ISAC
          </Typography>
          <Typography sx={countSx}>Separate application</Typography>
        </Box>
      </Box>

      <Box sx={{ display: "flex", flexDirection: "column", gap: "1px", mb: -0.5 }}>
        <Box
          component="a"
          href={isacUrl}
          target="_blank"
          rel="noopener noreferrer"
          sx={linkSx}
        >
          Open ISAC
          <Box component="span" sx={{ ml: "auto", fontSize: 11, color: "text.disabled" }}>
            ↗
          </Box>
        </Box>
      </Box>
    </Card>
  );
}

// ---- Marketing Admin -------------------------------------------------------

// A strip rather than a tile. Its five panels are pills because they're a set you
// pick one from rather than a list you read — and because at tile size, five rows of
// panel names outweighed every operation above them.
function AdminStrip({
  icon: Icon,
  items,
}: {
  icon: LucideIcon;
  items: (typeof MARKETING_OPS_APPS)[number]["items"];
}) {
  return (
    <Card
      variant="outlined"
      sx={{
        mt: 1.75,
        p: 2,
        display: "flex",
        alignItems: "center",
        gap: 2,
        flexWrap: "wrap",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
        <Box sx={glyphSx} aria-hidden="true">
          <Icon size={18} />
        </Box>
        <Box>
          <Typography component="h2" sx={{ fontSize: 14, fontWeight: 700 }}>
            Marketing Admin
          </Typography>
          <Typography sx={countSx}>
            {items.length} panel{items.length === 1 ? "" : "s"}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", ml: { sm: "auto" } }}>
        {items.map((it) => (
          <Box
            key={it.id}
            id={it.id}
            component={NavLink}
            to={it.path!}
            sx={{
              fontSize: 12,
              color: "text.secondary",
              textDecoration: "none",
              border: 1,
              borderColor: "divider",
              borderRadius: 999,
              px: 1.4,
              py: 0.5,
              "&:hover": { borderColor: "primary.main", color: "primary.main" },
              "&.active": { borderColor: "primary.main", color: "primary.main", fontWeight: 600 },
            }}
          >
            {it.label}
          </Box>
        ))}
      </Box>
    </Card>
  );
}
