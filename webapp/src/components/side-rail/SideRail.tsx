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

import { useMemo, useState } from "react";
import { Box, ListItemButton, ListItemText, Typography } from "@wso2/oxygen-ui";
import { ChevronRightIcon, SettingsIcon, type LucideIcon } from "@wso2/oxygen-ui-icons-react";
import { matchPath, NavLink, useLocation, useNavigate } from "react-router";
import { useActivePerspective } from "@context/perspective/PerspectiveContext";
import { CROSS_PERSPECTIVES, type PerspectiveSection } from "@constants/perspectives";
import { capabilitiesFromPrivileges, type Capability } from "@constants/appMenu";
import { FINANCE_ITEM_IDS } from "@constants/financeApps";
import { useUserInfo } from "@api/useUserInfo";
import { useFinanceGate } from "@features/finance/api/useFinanceGate";
import { useMarketingOpsGate } from "@features/marketing-ops/api/useMarketingOpsGate";

// Context-sensitive left rail. Header = the active perspective; body =
// its sections (jump-anchor to canvas ids); footer = For you (My +
// Service Requests). Functional persona switching goes through the
// waffle (top-right), not the rail — the prototype behaviour.
//
// Sections render generically from the perspective registry: a leaf
// section is a scroll-anchor button; a section with `children` (People
// Ops apps) renders as a collapsible group whose children are filtered
// by the caller's capabilities. A group with a single visible child
// collapses to a plain leaf (e.g. Menu → its one Home item).
export default function SideRail() {
  const active = useActivePerspective();
  const userInfo = useUserInfo();
  const caps = capabilitiesFromPrivileges(userInfo.data?.privileges);
  const navigate = useNavigate();
  const location = useLocation();

  // Finance items (OPD/credit-card/expense, surfaced under Me) gate on each
  // finance app's OWN backend roles, not the coarse people-app capabilities
  // — so someone who is a people-app lead but not a cc-expenses lead/finance
  // doesn't see "Approve Submissions". Dispatched per item id rather than
  // per perspective since Finance items are just some of Me's sections now.
  // Only fetch those roles while Me is active.
  const financeGate = useFinanceGate(active.key === "me");

  // Marketing Ops needs the same treatment for the same reason, against its own
  // backend: its access comes from Asgardeo group membership
  // (app-marketingops-*), which has no relationship to the people-app privilege
  // numbers `caps` is built from. Gating its items on `caps` would show a
  // people-app admin every marketing screen — including ones the marketing
  // backend will 403 — and hide them from an actual Marketing Ops admin who
  // happens not to be a people-app admin.
  const isMarketingOps = active.key === "marketing";
  const marketingOpsGate = useMarketingOpsGate(isMarketingOps);

  const resolveVisible = (s: PerspectiveSection): boolean => {
    if (FINANCE_ITEM_IDS.has(s.id)) return financeGate.canSee(s.id);
    if (isMarketingOps) return marketingOpsGate.canSee(s.id);
    return sectionAllowed(s.requires, caps);
  };

  // Manual open/close choices for groups the user has explicitly clicked,
  // for when they're NOT the group containing the current route (see
  // activeGroupIds below, which always wins over this while it applies).
  const [overrides, setOverrides] = useState<Map<string, boolean>>(new Map());

  // Whichever group contains the current route is ALWAYS shown expanded —
  // no override, manual or otherwise, can suppress this. Otherwise landing
  // on e.g. Reports via a direct link, browser back/forward, or the Waffle
  // overlay (i.e. any path that doesn't go through manually clicking the
  // group open) renders that group collapsed while you're actively on one
  // of its own pages, hiding both where you are and its sibling links.
  const activeGroupIds = useMemo(() => {
    const ids = new Set<string>();
    for (const s of active.sections ?? []) {
      // matchPath (rather than a raw string ===) so a trailing slash on the
      // URL (e.g. "/me/leave/reports/") still matches its exact route.
      if (s.children?.some((c) => c.path && matchPath(c.path, location.pathname))) {
        ids.add(s.id);
      }
    }
    return ids;
  }, [active.sections, location.pathname]);
  const effectiveOpened = useMemo(() => {
    const ids = new Set(activeGroupIds);
    for (const [id, isOpen] of overrides) {
      if (activeGroupIds.has(id)) continue; // active route always wins
      if (isOpen) ids.add(id);
    }
    return ids;
  }, [activeGroupIds, overrides]);

  // No-op while the group contains the current route — you can't collapse
  // the group you're actively browsing (activeGroupIds always wins over
  // any override anyway), so recording one here would just silently arm a
  // collapse for later with no visible effect now: click "Leave" while on
  // one of its own pages, nothing looks like it changed, then navigating
  // to an unrelated page "mysteriously" collapses it. Outside its own
  // route, toggling is a normal, immediately-visible open/close.
  const toggle = (id: string) => {
    if (activeGroupIds.has(id)) return;
    const isOpen = effectiveOpened.has(id);
    setOverrides((prev) => new Map(prev).set(id, !isOpen));
  };

  // Scroll a canvas anchor into view. If we're on a sub-route of the
  // perspective (e.g. a Leave screen) rather than its overview page, jump
  // to the overview first, then scroll once its DOM has mounted.
  const basePath = active.path;
  const scrollToSection = (id: string) => {
    const doScroll = () => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    if (basePath && location.pathname !== basePath) {
      navigate(basePath);
      // Give the overview page a beat to render its anchor cards.
      window.setTimeout(doScroll, 80);
    } else {
      doScroll();
    }
  };

  const sections = active.sections ?? [];
  const crossPerspectives = CROSS_PERSPECTIVES.filter((p) => p.access && p.path);
  // The Home perspective (cross group) is itself the "Me" landing, so a
  // "For you → Me" link there is redundant. Inside an App (functional
  // group) we keep "For you → Me" so the user can jump home. Switching
  // between Apps is the waffle's job (top-right) — the rail doesn't
  // duplicate that launcher.
  const onHome = active.group === "cross";

  // The perspective eyebrow ("FINANCE", "PEOPLE OPS", …). When the
  // perspective has a landing route, the whole header links to it.
  const perspectiveHeaderSx = {
    fontSize: 10.5,
    textTransform: "uppercase",
    letterSpacing: "0.07em",
    color: "text.disabled",
    fontWeight: 600,
    mb: 0.75,
    mx: 1,
    display: "flex",
    alignItems: "center",
    gap: 0.75,
  } as const;
  const headerInner = (
    <>
      <active.icon size={13} />
      {active.label}
    </>
  );
  // Sub-section group header ("For you", "Apps") — same eyebrow styling with
  // top spacing to separate it from the sections above.
  const railHeaderSx = {
    fontSize: 10.5,
    textTransform: "uppercase",
    letterSpacing: "0.07em",
    color: "text.disabled",
    fontWeight: 600,
    mt: 1.75,
    mb: 0.75,
    mx: 1,
  } as const;

  return (
    <Box
      component="nav"
      sx={{
        borderRight: 1,
        borderColor: "divider",
        backgroundColor: "background.paper",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      {/* Scrollable body — perspective sections + For you. Settings row
          below sits pinned to the rail's viewport bottom. */}
      <Box sx={{ flex: 1, overflowY: "auto", px: 1.25, py: 1.75 }}>
        {/* Active perspective header — links to the perspective's landing
            page when it has one (e.g. Finance → /finance overview). */}
        {active.path ? (
          <Typography
            component={NavLink}
            to={active.path}
            sx={{
              ...perspectiveHeaderSx,
              textDecoration: "none",
              cursor: "pointer",
              "&:hover": { color: "text.secondary" },
              "&.active": { color: "primary.main" },
            }}
            end
          >
            {headerInner}
          </Typography>
        ) : (
          <Typography sx={perspectiveHeaderSx}>{headerInner}</Typography>
        )}

        {sections.length > 0 ? (
          sections.map((s) => (
            <SectionNode
              key={s.id}
              section={s}
              resolveVisible={resolveVisible}
              opened={effectiveOpened}
              locked={activeGroupIds.has(s.id)}
              onToggle={toggle}
              onScroll={scrollToSection}
            />
          ))
        ) : (
          <Box sx={{ fontSize: 11.5, color: "text.disabled", px: 1.25, py: 1, lineHeight: 1.5 }}>
            No sub-sections. Use the ⊞ waffle to switch functions.
          </Box>
        )}

        {/* Inside an App: "For you → Me" so you can jump home. Only render
            when there's at least one accessible cross-cutting perspective. */}
        {!onHome && crossPerspectives.length > 0 && (
          <>
            <Typography sx={railHeaderSx}>For you</Typography>
            {crossPerspectives.map((p) => (
              <ListItemButton
                key={p.key}
                component={NavLink}
                to={p.path!}
                sx={{
                  borderRadius: 1.125,
                  py: 0.75,
                  px: 1.25,
                  "&.active": {
                    bgcolor: "primary.light",
                    color: "primary.main",
                    "& .MuiListItemText-primary": { fontWeight: 600 },
                  },
                }}
              >
                <Box sx={{ width: 18, mr: 1.25, display: "flex", alignItems: "center" }}>
                  <p.icon size={16} />
                </Box>
                <ListItemText
                  primary={p.label}
                  primaryTypographyProps={{ fontSize: 13.5, fontWeight: 500 }}
                />
              </ListItemButton>
            ))}
          </>
        )}
      </Box>

      {/* Settings — pinned to the rail's viewport bottom, same treatment as
          cs-tools customer-portal. Currently inert; wire to /settings when
          the page exists. */}
      <Box
        sx={{
          borderTop: 1,
          borderColor: "divider",
          px: 1.25,
          py: 1.25,
        }}
      >
        <ListItemButton sx={{ borderRadius: 1.125, py: 0.75, px: 1.25 }}>
          <Box sx={{ width: 18, mr: 1.25, display: "flex", alignItems: "center" }}>
            <SettingsIcon size={16} />
          </Box>
          <ListItemText
            primary="Settings"
            primaryTypographyProps={{ fontSize: 13.5, fontWeight: 500 }}
          />
        </ListItemButton>
      </Box>
    </Box>
  );
}

function sectionAllowed(requires: Capability[] | undefined, caps: Set<Capability>): boolean {
  if (!requires || requires.length === 0) return true;
  return requires.some((r) => caps.has(r));
}

// Renders one section: an app group (collapsible), a single-child group
// collapsed to a leaf, or a plain scroll-anchor leaf.
function SectionNode({
  section,
  resolveVisible,
  opened,
  locked,
  onToggle,
  onScroll,
}: {
  section: PerspectiveSection;
  resolveVisible: (section: PerspectiveSection) => boolean;
  opened: Set<string>;
  // True while this group contains the current route — it's forced open
  // (see activeGroupIds in SideRail) and toggling it is a no-op. Rendered
  // as non-interactive rather than passed through to a click handler that
  // silently does nothing, which otherwise reads as "the rail is broken".
  locked: boolean;
  onToggle: (id: string) => void;
  onScroll: (id: string) => void;
}) {
  // Group section (has children) — filter children by visibility.
  if (section.children && section.children.length > 0) {
    const visible = section.children.filter((c) => resolveVisible(c));
    if (visible.length === 0) return null;

    // Single visible child → collapse the whole app to a plain leaf that
    // scrolls (or routes) straight to it (e.g. Menu → Home).
    //
    // Unless the app opts out. An app that is permanently one screen reads better
    // collapsed; one that is about to gain siblings does not, because the child's
    // name vanishes from the rail until the second one arrives.
    if (visible.length === 1 && !section.alwaysGroup) {
      const only = visible[0];
      return (
        <Leaf
          label={section.label}
          icon={section.icon}
          to={only.path}
          onClick={() => onScroll(only.id)}
        />
      );
    }

    const isOpen = opened.has(section.id);
    return (
      <>
        <ListItemButton
          onClick={locked ? undefined : () => onToggle(section.id)}
          disableRipple={locked}
          aria-disabled={locked}
          sx={{
            borderRadius: 1.125,
            py: 0.75,
            px: 1.25,
            ...(locked && {
              cursor: "default",
              "&:hover": { bgcolor: "transparent" },
            }),
          }}
        >
          <Box sx={{ width: 18, mr: 1.25, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {section.icon ? <section.icon size={16} /> : null}
          </Box>
          <ListItemText
            primary={section.label}
            primaryTypographyProps={{ fontSize: 13.5, fontWeight: 600 }}
          />
          <Chevron open={isOpen} />
        </ListItemButton>
        {isOpen &&
          visible.map((c) =>
            c.path ? (
              <ListItemButton
                key={c.id}
                component={NavLink}
                to={c.path}
                sx={{
                  borderRadius: 1.125,
                  py: 0.5,
                  pl: 4.5,
                  pr: 1.25,
                  "&.active .MuiListItemText-primary": { color: "primary.main", fontWeight: 600 },
                }}
              >
                <ListItemText
                  primary={c.label}
                  primaryTypographyProps={{ fontSize: 13, fontWeight: 500, color: "text.secondary" }}
                />
              </ListItemButton>
            ) : (
              <ListItemButton
                key={c.id}
                onClick={() => onScroll(c.id)}
                sx={{ borderRadius: 1.125, py: 0.5, pl: 4.5, pr: 1.25 }}
              >
                <ListItemText
                  primary={c.label}
                  primaryTypographyProps={{ fontSize: 13, fontWeight: 500, color: "text.secondary" }}
                />
              </ListItemButton>
            ),
          )}
      </>
    );
  }

  // Leaf section — a route (e.g. Dashboard) when it has a `path`, otherwise
  // a scroll-anchor (e.g. the My perspective's General/Personal sections).
  if (!resolveVisible(section)) return null;
  return (
    <Leaf
      label={section.label}
      icon={section.icon}
      // An outbound leaf keeps its icon as its marker; the bullet is for the
      // scroll-anchor leaves, which have none.
      bullet={!section.externalUrl}
      to={section.path}
      href={section.externalUrl}
      onClick={() => onScroll(section.id)}
    />
  );
}

function Leaf({
  label,
  icon: Icon,
  bullet,
  to,
  href,
  onClick,
}: {
  label: string;
  icon?: LucideIcon;
  bullet?: boolean;
  // When present, render as a route link (active-highlighted); otherwise
  // an onClick button (scroll-anchor).
  to?: string;
  // An address outside One WSO2 — rendered as a new-tab anchor rather than a
  // route. Never active-highlighted: no route of ours is current once the user
  // is over there, and highlighting it would claim otherwise.
  href?: string;
  onClick: () => void;
}) {
  const inner = (
    <>
      <Box
        sx={{
          width: 18,
          mr: 1.25,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: Icon ? undefined : "text.disabled",
        }}
      >
        {Icon ? <Icon size={16} /> : bullet ? <ChevronRightIcon size={13} /> : null}
      </Box>
      <ListItemText
        primary={label}
        primaryTypographyProps={{ fontSize: 13.5, fontWeight: Icon ? 600 : 500 }}
      />
    </>
  );
  if (href) {
    return (
      <ListItemButton
        component="a"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        sx={{ borderRadius: 1.125, py: 0.75, px: 1.25 }}
      >
        {inner}
        {/* The one affordance that says this leaves the app. Without it an
            outbound item is indistinguishable from a route until it has already
            opened a tab. */}
        <Box component="span" sx={{ fontSize: 11, color: "text.disabled", ml: 0.5 }}>
          ↗
        </Box>
      </ListItemButton>
    );
  }
  if (to) {
    return (
      <ListItemButton
        component={NavLink}
        to={to}
        sx={{
          borderRadius: 1.125,
          py: 0.75,
          px: 1.25,
          "&.active .MuiListItemText-primary": { color: "primary.main", fontWeight: 700 },
        }}
      >
        {inner}
      </ListItemButton>
    );
  }
  return (
    <ListItemButton onClick={onClick} sx={{ borderRadius: 1.125, py: 0.75, px: 1.25 }}>
      {inner}
    </ListItemButton>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <Box
      component="svg"
      viewBox="0 0 24 24"
      sx={{
        width: 15,
        height: 15,
        color: "text.disabled",
        transform: open ? "rotate(90deg)" : "rotate(0deg)",
        transition: "transform .15s",
        flexShrink: 0,
      }}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="9 6 15 12 9 18" />
    </Box>
  );
}
