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

import { useMemo, useState, type JSX, type ReactNode } from "react";
import { Box, Link, Sidebar, Typography } from "@wso2/oxygen-ui";
import { ExternalLinkIcon, SettingsIcon } from "@wso2/oxygen-ui-icons-react";
import { Link as RouterLink, matchPath, useLocation, useNavigate } from "react-router";
import { useActivePerspective } from "@context/perspective/PerspectiveContext";
import { CROSS_PERSPECTIVES, type PerspectiveSection } from "@constants/perspectives";
import { capabilitiesFromPrivileges, type Capability } from "@constants/appMenu";
import { FINANCE_ITEM_IDS } from "@constants/financeApps";
import { useUserInfo } from "@api/useUserInfo";
import { useFinanceGate } from "@features/finance/api/useFinanceGate";

// Context-sensitive left rail, built on Oxygen's compound `Sidebar`.
//
// Everything visual comes from the library: `Sidebar.ItemLabel` renders the
// selected row at weight 600 and every other row at 400, `Sidebar.ItemIcon`
// tints the active icon `primary.main`, and `Sidebar.Item` supplies the group
// chevron plus a hover flyout when the rail is collapsed. This component
// deliberately sets NO font weights, colours, or paddings of its own — if a
// style literal creeps back in here, the migration has regressed.
//
// Sections still render generically from the perspective registry: a leaf is
// either a route (`path`) or a scroll-anchor (`id`); a section with `children`
// is a collapsible group whose children are filtered by capability. A group
// with a single visible child collapses to a plain leaf (e.g. Menu → Home).
//
// Oxygen's Sidebar is id-based (`activeItem` + `onSelect`) rather than
// link-based, which suits that route/anchor duality better than the NavLink
// tree this replaces: route items are wrapped in a real anchor so
// middle-click and cmd-click still work, and anchor-only items fall through
// to `onSelect`.

interface SideRailProps {
  collapsed: boolean;
}

/** Id for a cross-perspective row; namespaced so it can't collide with a section id. */
const crossId = (key: string) => `cross-${key}`;
/** Id for the perspective's own landing route. */
const OVERVIEW_ID = "perspective-overview";

export default function SideRail({ collapsed }: SideRailProps): JSX.Element {
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
  const resolveVisible = (s: PerspectiveSection): boolean =>
    FINANCE_ITEM_IDS.has(s.id) ? financeGate.canSee(s.id) : sectionAllowed(s.requires, caps);

  // Memoised because `?? []` would otherwise hand a fresh array to the
  // dependency lists below on every render, defeating both useMemos.
  const sections = useMemo(() => active.sections ?? [], [active.sections]);

  // Manual open/close choices for groups the user has explicitly clicked,
  // for when they're NOT the group containing the current route (see
  // activeGroupIds below, which always wins over this while it applies).
  const [overrides, setOverrides] = useState<Map<string, boolean>>(new Map());

  // Whichever group contains the current route is ALWAYS shown expanded —
  // no override, manual or otherwise, can suppress this. Otherwise landing
  // on e.g. Reports via a direct link, browser back/forward, or the waffle
  // renders that group collapsed while you're actively on one of its own
  // pages, hiding both where you are and its sibling links.
  const activeGroupIds = useMemo(() => {
    const ids = new Set<string>();
    for (const s of sections) {
      // matchPath (rather than a raw string ===) so a trailing slash on the
      // URL (e.g. "/me/leave/reports/") still matches its exact route.
      if (s.children?.some((c) => c.path && matchPath(c.path, location.pathname))) {
        ids.add(s.id);
      }
    }
    return ids;
  }, [sections, location.pathname]);

  // Oxygen wants a Record, not a Set.
  const expandedMenus = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const id of activeGroupIds) map[id] = true;
    for (const [id, isOpen] of overrides) {
      if (activeGroupIds.has(id)) continue; // active route always wins
      map[id] = isOpen;
    }
    return map;
  }, [activeGroupIds, overrides]);

  // No-op while the group contains the current route — you can't collapse
  // the group you're actively browsing (activeGroupIds always wins over any
  // override anyway), so recording one here would silently arm a collapse
  // for later with no visible effect now.
  const onToggleExpand = (id: string) => {
    if (activeGroupIds.has(id)) return;
    setOverrides((prev) => new Map(prev).set(id, !expandedMenus[id]));
  };

  // Which row reads as selected. Resolved from the URL rather than from
  // click state, so a deep link, a browser Back, or the waffle all highlight
  // correctly. Leaves win over the perspective overview, which is why the
  // sections are checked first.
  const activeItem = useMemo(() => {
    for (const s of sections) {
      if (s.path && matchPath(s.path, location.pathname)) return s.id;
      for (const c of s.children ?? []) {
        if (c.path && matchPath(c.path, location.pathname)) return c.id;
      }
    }
    if (active.path && matchPath(active.path, location.pathname)) return OVERVIEW_ID;
    return "";
  }, [sections, active.path, location.pathname]);

  // Scroll a canvas anchor into view. If we're on a sub-route of the
  // perspective (e.g. a Leave screen) rather than its overview page, jump to
  // the overview first, then scroll once its DOM has mounted.
  const scrollToSection = (id: string) => {
    const doScroll = () => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    if (active.path && location.pathname !== active.path) {
      navigate(active.path);
      // Give the overview page a beat to render its anchor cards.
      window.setTimeout(doScroll, 80);
    } else {
      doScroll();
    }
  };

  // Anchor-only rows arrive here (route rows navigate through their own
  // wrapping link). Unknown ids — e.g. the inert Settings row — are ignored.
  const onSelect = (id: string) => {
    if (id === OVERVIEW_ID || id.startsWith("cross-") || id === "settings") return;
    scrollToSection(id);
  };

  const crossPerspectives = CROSS_PERSPECTIVES.filter((p) => p.access && p.path);
  // The Home perspective (cross group) is itself the "Me" landing, so a
  // "For you → Me" link there is redundant. Inside an App (functional group)
  // we keep it so the user can jump home. Switching between Apps is the
  // waffle's job — the rail doesn't duplicate that launcher.
  const onHome = active.group === "cross";

  return (
    <Sidebar
      collapsed={collapsed}
      activeItem={activeItem}
      expandedMenus={expandedMenus}
      onSelect={onSelect}
      onToggleExpand={onToggleExpand}
    >
      <Sidebar.Nav>
        <Sidebar.Category>
          <Sidebar.CategoryLabel>{active.label}</Sidebar.CategoryLabel>

          {/* The perspective's own landing page. Previously this was a
              clickable eyebrow label; as a real row it can also be
              highlighted when you're on it. */}
          {active.path && (
            <RouteItem id={OVERVIEW_ID} to={active.path}>
              <Sidebar.Item id={OVERVIEW_ID}>
                <Sidebar.ItemIcon>
                  <active.icon />
                </Sidebar.ItemIcon>
                <Sidebar.ItemLabel>Overview</Sidebar.ItemLabel>
              </Sidebar.Item>
            </RouteItem>
          )}

          {sections.map((s) => (
            <SectionNode
              key={s.id}
              section={s}
              resolveVisible={resolveVisible}
              locked={activeGroupIds.has(s.id)}
            />
          ))}

          {sections.length === 0 && !collapsed && (
            <Box sx={{ px: 3, py: 1 }}>
              <Typography variant="body2" color="text.secondary">
                No sub-sections yet. Use the app switcher to change function.
              </Typography>
            </Box>
          )}
        </Sidebar.Category>

        {!onHome && crossPerspectives.length > 0 && (
          <Sidebar.Category>
            <Sidebar.CategoryLabel>For you</Sidebar.CategoryLabel>
            {crossPerspectives.map((p) => (
              <RouteItem key={p.key} id={crossId(p.key)} to={p.path!}>
                <Sidebar.Item id={crossId(p.key)}>
                  <Sidebar.ItemIcon>
                    <p.icon />
                  </Sidebar.ItemIcon>
                  <Sidebar.ItemLabel>{p.label}</Sidebar.ItemLabel>
                </Sidebar.Item>
              </RouteItem>
            ))}
          </Sidebar.Category>
        )}
      </Sidebar.Nav>

      {/* Currently inert; wire to /settings when the page exists. */}
      <Sidebar.Footer showDivider>
        <Sidebar.Item id="settings">
          <Sidebar.ItemIcon>
            <SettingsIcon />
          </Sidebar.ItemIcon>
          <Sidebar.ItemLabel>Settings</Sidebar.ItemLabel>
        </Sidebar.Item>
      </Sidebar.Footer>
    </Sidebar>
  );
}

function sectionAllowed(requires: Capability[] | undefined, caps: Set<Capability>): boolean {
  if (!requires || requires.length === 0) return true;
  return requires.some((r) => caps.has(r));
}

/**
 * Wraps a rail row in a real anchor so middle-click / cmd-click open a new
 * tab. Oxygen's Sidebar already strips link underlines (`& a` in its root
 * styles), so no styling is needed here.
 */
function RouteItem({
  to,
  children,
}: {
  id: string;
  to: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <Link component={RouterLink} to={to} color="inherit" underline="none">
      {children}
    </Link>
  );
}

/**
 * One registry section: a collapsible app group, a single-child group
 * flattened to a leaf, or a plain leaf (route or scroll-anchor).
 *
 * Nesting in Oxygen 0.6.0 is expressed by placing child `Sidebar.Item`s
 * *inside* the parent's children — there is no `hasChildren` / `nested` prop
 * in this version, whatever the bundled docs show.
 */
function SectionNode({
  section,
  resolveVisible,
  locked,
}: {
  section: PerspectiveSection;
  resolveVisible: (section: PerspectiveSection) => boolean;
  // True while this group contains the current route. It is forced open (see
  // activeGroupIds) so toggling is a no-op — render it non-interactive rather
  // than leaving a click target that silently does nothing, which reads as
  // "the rail is broken".
  locked: boolean;
}): JSX.Element | null {
  if (section.children && section.children.length > 0) {
    const visible = section.children.filter((c) => resolveVisible(c));
    if (visible.length === 0) return null;

    // Single visible child → collapse the group to a plain leaf pointing
    // straight at it (e.g. Menu → its one Home item).
    //
    // Unless the app opts out. An app that is permanently one screen reads
    // better collapsed; one that is about to gain siblings does not, because the
    // child's name vanishes from the rail until the second one arrives.
    if (visible.length === 1 && !section.alwaysGroup) {
      const only = visible[0];
      return <LeafItem id={only.id} label={section.label} icon={section.icon} to={only.path} />;
    }

    return (
      <Sidebar.Item
        id={section.id}
        sx={locked ? { cursor: "default", "&:hover": { bgcolor: "transparent" } } : undefined}
      >
        <Sidebar.ItemIcon>{section.icon ? <section.icon /> : null}</Sidebar.ItemIcon>
        <Sidebar.ItemLabel>{section.label}</Sidebar.ItemLabel>
        {visible.map((c) => (
          <LeafItem key={c.id} id={c.id} label={c.label} to={c.path} />
        ))}
      </Sidebar.Item>
    );
  }

  if (!resolveVisible(section)) return null;
  return (
    <LeafItem
      id={section.id}
      label={section.label}
      icon={section.icon}
      to={section.path}
      href={section.externalUrl}
    />
  );
}

/** A single row. `href` → outbound; `to` → a route; otherwise a scroll-anchor. */
function LeafItem({
  id,
  label,
  icon: Icon,
  to,
  href,
}: {
  id: string;
  label: string;
  icon?: PerspectiveSection["icon"];
  to?: string;
  // An address outside One WSO2 — a new-tab anchor rather than a route. Never
  // active-highlighted: no route of ours is current once the user is over
  // there, and highlighting it would claim otherwise.
  href?: string;
}): JSX.Element {
  const item = (
    <Sidebar.Item id={id}>
      {Icon ? (
        <Sidebar.ItemIcon>
          <Icon />
        </Sidebar.ItemIcon>
      ) : null}
      {/* Plain string: Oxygen derives the collapsed-rail tooltip from
          String(ItemLabel.children). */}
      <Sidebar.ItemLabel>{label}</Sidebar.ItemLabel>
      {/* The one affordance that says this leaves the app. Without it an
          outbound item is indistinguishable from a route until it has already
          opened a tab. */}
      {href ? (
        <Sidebar.ItemBadge color="default">
          <ExternalLinkIcon size={11} />
        </Sidebar.ItemBadge>
      ) : null}
    </Sidebar.Item>
  );
  if (href) {
    return (
      <Link href={href} target="_blank" rel="noopener noreferrer" color="inherit" underline="none">
        {item}
      </Link>
    );
  }
  return to ? (
    <RouteItem id={id} to={to}>
      {item}
    </RouteItem>
  ) : (
    item
  );
}
