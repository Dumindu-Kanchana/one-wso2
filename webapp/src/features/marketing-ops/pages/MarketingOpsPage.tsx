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
import { alpha } from "@mui/material/styles";
import {
  ArrowUpRightIcon,
  SatelliteDishIcon,
  type LucideIcon,
} from "@wso2/oxygen-ui-icons-react";
import { NavLink } from "react-router";
import { MARKETING_OPS_APPS } from "@constants/marketingOpsApps";
import { isIsacConfigured, isacUrl } from "@config/apiConfig";
import MarketingOpsShell from "../components/MarketingOpsShell";
import { useMarketingOpsGate } from "../api/useMarketingOpsGate";
import { BENTO_COLS, packBento } from "./bentoLayout";

// Marketing Ops perspective landing page: a bento of the operations, and nothing
// else.
//
// It used to be a page of prose — 285 words across 17 item cards, each carrying a
// full sentence, under an operation-level "purpose" line that mostly repeated them.
// That reads as documentation, and a landing page's first job is to get you out of
// it. So the descriptions are gone and the tile is the unit: an operation, its
// screens as links, no explanation. The labels already say what the screens are.
//
// ---- why a bento and not the old grid ------------------------------------
//
// The grid before this was `repeat(auto-fit, minmax(214px, 1fr))`: on a wide
// screen it made five or six skinny columns of identical weight and unequal
// height. Nothing on the page was bigger than anything else, so there was no
// entry point and no reading order — the eye had nowhere to land first.
//
// Now the first operation takes a double-width feature tile and carries the
// page's ONLY brand wash; everything else sits around it at one of two widths.
// The sizing rule, and why a fixed-column bento needs a pack step at all, are in
// ./bentoLayout.
//
// The feature was briefly 2x2 — two rows tall as well as two columns wide. It
// left ~75px of empty card under its last link, because a header plus four links
// is not as tall as the two rows beside it. Both attempts to fill that space were
// rejected, and both rightly:
//
//   - live status per tile (queue depths, draft counts, last-run times): a
//     launcher that also reports status says two things at once, and the badges
//     turned a grid you scan into a page you have to read;
//   - the operation's `purpose` sentence: description text on the one tile with
//     room for it is documentation on a launcher, and it singles out one
//     operation for an explanation none of the others get.
//
// The hole was a geometry problem, and inventing content to plug it was the wrong
// way round. So no tile is two rows tall now: the feature is prominent by width,
// wash and glyph size, and every tile is exactly as tall as its row needs. If
// this page ever does report state it should be one deliberate strip, not a badge
// per tile.
//
// ---- what else went, and why ---------------------------------------------
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
//     perspective pages for that reason — the rail already says where you are.
//
//   - The Marketing Admin strip: a full-width card whose panel pills were pushed
//     to the right edge with `ml: auto`, leaving a long empty middle and making the
//     quietest thing on the page also the widest.
//
//     It was briefly a hairline "Configure" band under the grid instead, and that
//     over-corrected — demoted to a footer, it read as fine print for the thing
//     that holds the import contracts and the Pardot send defaults. Marketing
//     Admin is now a TILE like the others, two columns wide, sitting after the
//     operations and before ISAC. It gets the same weight as what it configures,
//     and its Settings icon is what marks it as the one that configures rather
//     than one of the things configured.
//
//   - The "4 screens" / "4 panels" count under each tile name. See the note on
//     the header row in OperationTile: it counted what the CALLER may open, so
//     the same operation read "4 screens" to an admin and "1 screen" to a
//     submitter — a number nobody can act on, attached to a list you can see.
//
// ---- what the access gate does to this page ------------------------------
//
// Every tile here is conditional. `canSee` runs per ITEM, so RBAC changes both
// which tiles exist and how many links each one holds, and the page has to look
// deliberate for all of it rather than only for the admin who sees everything.
// What that relies on:
//
//   - Nothing renders at all for an unauthorized caller: MarketingOpsShell holds
//     the page on `requireAuthorized` and explains the Asgardeo group instead. So
//     the minimum this grid ever draws is what an AUTHORIZED caller with no
//     capabilities sees, which is Utilities — the one app with no `requires`.
//     There is no empty-grid state to design, and `operations` is never empty.
//   - `isAdmin` is a master key in hasMarketingOpsCapability, so "sees Marketing
//     Admin" implies "sees every operation". The Admin tile can therefore never
//     turn up as the only tile, or as the first one, which is what lets the
//     feature slot be "the first operation" without a special case for it.
//   - Widths come from the FILTERED item counts, so a tile that RBAC reduced to
//     one link is sized as a one-link tile rather than keeping a four-link
//     footprint with three links missing from it.
//   - The feature is whichever operation comes first for THIS caller, and it is
//     suppressed below three tiles — a lone Utilities tile with the brand wash
//     on it would be announcing an entry point to a page with one door.
//
// packBento covers the arithmetic of the varying tile count; its tests walk the
// capability sets that actually occur rather than arbitrary subsets.
export default function MarketingOpsPage() {
  const gate = useMarketingOpsGate();

  // An operation whose every screen is hidden by the gate is dropped entirely —
  // an empty tile is worse than no tile, because it advertises something and then
  // refuses to open it. Dropping it HERE rather than at render time is also what
  // keeps the pack honest: it sizes the tiles that will actually exist.
  const visible = MARKETING_OPS_APPS.map((app) => ({
    app,
    items: app.items.filter((it) => gate.canSee(it.id)),
  })).filter(({ items }) => items.length > 0);

  const operations = visible.filter(({ app }) => app.key !== "admin");
  const admin = visible.find(({ app }) => app.key === "admin");

  // ISAC trails the operations rather than leading them as it does in the rail.
  // The rail is a list, where first means "top"; the bento's first slot is the
  // feature, and the feature has to be somewhere you WORK. ISAC is the one tile
  // that leaves One WSO2 altogether, so promoting it would aim the page's
  // strongest signal at the exit. Omitted entirely when unconfigured.
  const isac = isIsacConfigured();

  // Marketing Admin sits between the operations and ISAC: last of the things
  // that are part of One WSO2, before the one that isn't.
  const placements = packBento([
    ...operations.map(({ app, items }) => ({ key: app.key, weight: items.length })),
    ...(admin ? [{ key: "admin", weight: admin.items.length }] : []),
    ...(isac ? [{ key: "isac", weight: 1 }] : []),
  ]);
  const spanOf = (key: string): Span => placements.find((p) => p.key === key) ?? { colSpan: 1 };

  return (
    <MarketingOpsShell
      title="Marketing Ops"
      subtitle="Campaign operations, event lists and CRM ingestion."
    >
      <Box
        sx={{
          display: "grid",
          // Four columns is what the bento is packed for, but only once there is
          // room for it: the perspective rail eats ~208px, so four columns below
          // `lg` would be four ~150px tiles. Two columns keeps every span valid (a
          // 2-wide tile fills the row); one column ignores spans entirely.
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, 1fr)",
            lg: `repeat(${BENTO_COLS}, 1fr)`,
          },
          gap: 1.5,
        }}
      >
        {operations.map(({ app, items }, i) => (
          <OperationTile
            key={app.key}
            icon={app.icon}
            name={app.name}
            items={items}
            // The first operation is the feature — the same fact packBento uses
            // to force it double-width, told to the tile so it can also carry the
            // wash. Below three tiles there is no feature; see packBento.
            feature={i === 0 && placements.length > 2}
            {...spanOf(app.key)}
          />
        ))}

        {admin && (
          <OperationTile
            icon={admin.app.icon}
            name={admin.app.name}
            items={admin.items}
            feature={false}
            {...spanOf("admin")}
          />
        )}

        {isac && <IsacTile {...spanOf("isac")} />}
      </Box>
    </MarketingOpsShell>
  );
}

// ---- tile shell ------------------------------------------------------------

type Items = (typeof MARKETING_OPS_APPS)[number]["items"];

interface Span {
  colSpan: 1 | 2;
}

// Width only — see the note in ./bentoLayout on why nothing here spans two rows.
// At `xs` there is a single column, so every span collapses to it.
const spanSx = ({ colSpan }: Span) => ({
  gridColumn: { xs: "span 1", sm: `span ${colSpan}` },
});

const cardSx = {
  p: 2,
  display: "flex",
  flexDirection: "column",
  gap: 1.4,
  position: "relative",
  overflow: "hidden",
  transition: "border-color .14s, transform .14s, box-shadow .14s",
  "&:hover": { borderColor: "text.disabled", transform: "translateY(-2px)", boxShadow: 2 },
  // The lift is decoration; someone who has asked not to be moved shouldn't be.
  "@media (prefers-reduced-motion: reduce)": {
    transition: "none",
    "&:hover": { transform: "none" },
  },
} as const;

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

// ISAC's one-line descriptor. It used to be the style for a "4 screens" count on
// every tile as well; that count was cut — see the note on the header row below.
const captionSx = { fontSize: 11, color: "text.disabled" } as const;

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

// ---- one operation ---------------------------------------------------------

function OperationTile({
  icon: Icon,
  name,
  items,
  feature,
  colSpan,
}: Span & {
  icon: LucideIcon;
  name: string;
  items: Items;
  feature: boolean;
}) {
  return (
    <Card
      variant="outlined"
      sx={[
        cardSx,
        spanSx({ colSpan }),
        // Prominence by scale, not by extra rows: more padding, a bigger glyph
        // and a bigger name — all of which grow with the content instead of
        // leaving space beside it.
        feature && { p: 2.5, gap: 1.6 },
        // A tile with fewer links than its tallest neighbour has slack whatever
        // the layout does, because a grid row is as tall as its tallest cell.
        // Centring splits that slack above and below the content, which reads as
        // breathing room; leaving it at the top dumps it all under the last link,
        // which is what reads as a hole.
        !feature && { justifyContent: "center" },
        // The page's only brand wash, on the page's only feature tile. Same two
        // radial pools the app paints on the body canvas in brandTheme.ts, at the
        // same alphas — so it belongs to the product rather than to this page. The
        // alphas rise in dark mode for the reason they do there too: the pools
        // vanish against #0C0C0E otherwise. `palette.mode` is unreliable under
        // CssVars, hence applyStyles.
        feature &&
          ((t) => ({
            "&::before": {
              content: '""',
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              backgroundImage: [
                `radial-gradient(420px 150px at 4% 0%, ${alpha(t.palette.primary.main, 0.1)} 0%, transparent 62%)`,
                `radial-gradient(300px 200px at 96% 100%, ${alpha(t.palette.primary.main, 0.05)} 0%, transparent 60%)`,
              ].join(","),
            },
            ...t.applyStyles("dark", {
              "&::before": {
                backgroundImage: [
                  `radial-gradient(420px 150px at 4% 0%, ${alpha(t.palette.primary.main, 0.17)} 0%, transparent 62%)`,
                  `radial-gradient(300px 200px at 96% 100%, ${alpha(t.palette.primary.main, 0.09)} 0%, transparent 60%)`,
                ].join(","),
              },
            }),
          })),
      ]}
    >
      {/* Glyph and name, one line, nothing else.
          There was a "4 screens" / "4 panels" count under the name. It is gone:
          it told you how long the list directly beneath it was, which you can
          see, and under RBAC it is worse than useless — the number counts what
          THIS caller may open, so the same operation reads "4 screens" to an
          admin and "1 screen" to a submitter. Nobody can act on that, and it
          invites the reading that something is missing.

          position: relative because the feature's wash is an inset-0 ::before. */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, position: "relative" }}>
        <Box
          sx={[
            glyphSx,
            // The feature's glyph is the one place white-on-orange appears on this
            // page. It holds an ICON, not text, so the small-text contrast rule
            // that keeps the eyebrow chips outlined doesn't apply to it.
            feature && {
              width: 40,
              height: 40,
              borderRadius: 1.5,
              bgcolor: "primary.main",
              borderColor: "transparent",
              color: "primary.contrastText",
            },
          ]}
          aria-hidden="true"
        >
          <Icon size={feature ? 21 : 18} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            component="h2"
            sx={{ fontSize: feature ? 17 : 15, fontWeight: 700, letterSpacing: "-0.015em" }}
          >
            {name}
          </Typography>
        </Box>
      </Box>

      <Box
        sx={{
          position: "relative",
          display: "grid",
          // A wide tile lists its screens two-up rather than as one long column.
          // That is the whole reason bentoLayout gave it the extra width, and it
          // is also what keeps a four-screen tile the same height as a two-screen
          // one — the difference that used to show up as empty card.
          gridTemplateColumns: {
            xs: "1fr",
            sm: colSpan === 2 && items.length > 2 ? "1fr 1fr" : "1fr",
          },
          gap: "1px 1.25rem",
          mb: -0.5,
        }}
      >
        {items.map((it) => (
          // The registry id stays on the anchor: appsToSections treats an item
          // without a `path` as a scroll target on this page, and though every item
          // has one today, keeping the id means a future path-less item still works.
          <Box
            key={it.id}
            id={it.id}
            component={NavLink}
            to={it.path!}
            sx={[linkSx, feature && { fontSize: 13.5, py: 0.9 }]}
          >
            {it.label}
          </Box>
        ))}
      </Box>
    </Card>
  );
}

// ---- ISAC ------------------------------------------------------------------

function IsacTile({ colSpan }: Span) {
  return (
    <Card
      variant="outlined"
      sx={[cardSx, spanSx({ colSpan }), { justifyContent: "center", borderStyle: "dashed" }]}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
        {/* Tinted rather than neutral: the one tile that leaves One WSO2 is worth
            being able to spot without reading it. */}
        <Box
          sx={{ ...glyphSx, bgcolor: "primary.light", borderColor: "transparent" }}
          aria-hidden="true"
        >
          <SatelliteDishIcon size={18} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            component="h2"
            sx={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.015em" }}
          >
            ISAC
          </Typography>
          <Typography sx={captionSx}>Separate application</Typography>
        </Box>
      </Box>

      <Box sx={{ display: "flex", flexDirection: "column", gap: "1px", mb: -0.5 }}>
        <Box component="a" href={isacUrl} target="_blank" rel="noopener noreferrer" sx={linkSx}>
          Open ISAC
          <Box component="span" sx={{ ml: "auto", display: "flex", color: "text.disabled" }}>
            <ArrowUpRightIcon size={13} />
          </Box>
        </Box>
      </Box>
    </Card>
  );
}
