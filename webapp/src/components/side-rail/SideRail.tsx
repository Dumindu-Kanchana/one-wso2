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
import { matchSectionId } from "@components/side-rail/activeItem";
import { useUserInfo } from "@api/useUserInfo";
import { useFinanceGate } from "@features/finance/api/useFinanceGate";
import { useMarketingOpsGate } from "@features/marketing-ops/api/useMarketingOpsGate";
import { PAR_ITEM_IDS, useParGate } from "@features/par/api/useParGate";

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
/** Footer row, outside any perspective — it is a global page, not a section. */
const SETTINGS_ID = "settings";
const SETTINGS_PATH = "/settings";

// Left padding for a sub-item, so its label lines up with its parent's label
// rather than with the parent's icon.
//
// Oxygen indents a nested row by depth alone — `paddingLeft: spacing(2 + depth*2)`
// — which puts a depth-1 label 40px from the rail edge (8 margin + 32 padding).
// But a parent row carries an icon, so ITS label starts at 60px:
//   8 margin + 16 padding + 20 icon + 16 icon gutter.
// Left at the default, every sub-item hangs 20px to the left of the item it
// belongs to. spacing(6.5) = 52px, so 8 + 52 lands the sub-label at exactly 60.
//
// Only applies to expanded rows: Oxygen renders nested items through a popover,
// not this list, when the rail is collapsed.
const NESTED_LABEL_PL = 6.5;

// Oxygen's ItemLabel sets `overflow: hidden; white-space: nowrap` but no
// `text-overflow`, so a label wider than the rail is cut mid-glyph — it reads
// as a typo ("Active employee repor") rather than as truncation. Rail labels
// should be short enough not to need this, but it's the difference between a
// graceful degrade and a bug report the next time one grows.
// `display: block` is load-bearing, not tidying: MUI renders the primary text
// as an inline <span>, and `text-overflow` has no effect on an inline box — the
// property applies but never renders an ellipsis. Verified in a browser.
const ELLIPSIS_SX = {
  "& .MuiListItemText-primary": {
    display: "block",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
} as const;

export default function SideRail({ collapsed }: SideRailProps): JSX.Element {
  const active = useActivePerspective();
  const userInfo = useUserInfo();
  const caps = capabilitiesFromPrivileges(userInfo.data?.privileges);
  const navigate = useNavigate();
  const location = useLocation();

  // Memoised because `?? []` would otherwise hand a fresh array to the
  // dependency lists below on every render, defeating both useMemos.
  const sections = useMemo(() => active.sections ?? [], [active.sections]);

  // Finance items (OPD/credit-card/expense, surfaced under Me) gate on each
  // finance app's OWN backend roles, not the coarse people-app capabilities
  // — so someone who is a people-app lead but not a cc-expenses lead/finance
  // doesn't see "Approve Submissions". Dispatched per item id rather than
  // per perspective since Finance items are just some of Me's sections now.
  // Only fetch those roles while Me is active.
  const financeGate = useFinanceGate(active.key === "me");

  // Marketing Ops is the same shape of problem and needs the same treatment:
  // its rail gates on the MARKETING OPS backend's own Asgardeo groups
  // (app-marketingops-*), which bear no relation to the people-app privilege
  // numbers `caps` is built from. Reading `requires` against `caps` would show
  // a people-app admin every marketing screen — including ones the marketing
  // backend then 403s — and hide them from an actual Marketing Ops admin who
  // happens not to be a people-app admin. The registry says as much at
  // @constants/perspectives: the `requires` on those sections is a coarse hint,
  // and whatever renders them has to ask this gate.
  const isMarketingOps = active.key === "marketing";
  const marketingOpsGate = useMarketingOpsGate(isMarketingOps);

  // PAR is a third variation on the same theme, and the third role vocabulary:
  // its admin screens gate on an Asgardeo group, its lead screens on a flag in
  // PAR's own employee record. Neither has anything to do with `caps`.
  //
  // Keyed off whether this perspective actually lists a PAR screen rather than
  // off `active.key === "me"`. Same effect once the screens exist, but it also
  // means the gate asks the PAR backend nothing at all until they do — the
  // dispatch below can be wired ahead of the registry entries (so a new admin
  // screen can never appear before the gate that hides it) without spending a
  // request per page load in the meantime.
  const hasParSections = useMemo(() => sections.some((s) => PAR_ITEM_IDS.has(s.id)), [sections]);
  const parGate = useParGate(hasParSections);

  const resolveVisible = (s: PerspectiveSection): boolean => {
    if (FINANCE_ITEM_IDS.has(s.id)) return financeGate.canSee(s.id);
    if (PAR_ITEM_IDS.has(s.id)) return parGate.canSee(s.id);
    if (isMarketingOps) return marketingOpsGate.canSee(s.id);
    return sectionAllowed(s.requires, caps);
  };


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
    // Settings sits outside the registry, so it is matched before the sections.
    if (matchPath(SETTINGS_PATH, location.pathname)) return SETTINGS_ID;
    const exact = matchSectionId(sections, location.pathname);
    if (exact) return exact;

    if (active.path && matchPath(active.path, location.pathname)) return OVERVIEW_ID;

    // Nothing matched exactly, so try again allowing descendants: a detail
    // route like /me/my-team/E123 should keep its own section lit rather than
    // clearing the rail. Deliberately a SECOND pass — an exact match must
    // always win, or an item whose path prefixes another's would steal it.
    return matchSectionId(sections, location.pathname, { allowDescendants: true });
  }, [sections, active.path, location.pathname]);

  // Scroll a canvas anchor into view. If we're on a sub-route of the
  // perspective (e.g. a Leave screen) rather than its overview page, jump to
  // the overview first, then scroll once its DOM has mounted.
  const scrollToSection = (id: string) => {
    const tryScroll = () => {
      const el = document.getElementById(id);
      if (!el) return false;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      return true;
    };
    // Retry across frames rather than guessing a delay. A fixed timeout has to
    // be long enough for the slowest render, and when it isn't, the scroll
    // silently never happens and the user just lands at the top of the
    // overview. This also stays correct when routes become lazy-loaded, which
    // is exactly when a guessed delay would start being too short. Bounded so
    // an id that never mounts can't spin forever.
    const scrollWhenReady = (attemptsLeft: number) => {
      if (tryScroll() || attemptsLeft === 0) return;
      requestAnimationFrame(() => scrollWhenReady(attemptsLeft - 1));
    };
    if (active.path && location.pathname !== active.path) {
      navigate(active.path);
      scrollWhenReady(30);
    } else {
      tryScroll();
    }
  };

  // Every routable id in the current perspective, so `onSelect` can navigate
  // for rows that aren't wrapped in an anchor (see LeafItem: nested rows can't
  // be, because Oxygen clones them to inject `depth`).
  const pathById = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of sections) {
      if (s.path) map.set(s.id, s.path);
      for (const c of s.children ?? []) {
        if (c.path) map.set(c.id, c.path);
      }
    }
    return map;
  }, [sections]);

  // Top-level route rows navigate through their own wrapping anchor; nested
  // rows and scroll-anchors arrive here.
  const onSelect = (id: string) => {
    // Not in pathById: Settings belongs to no perspective, so it is routed here
    // rather than through the registry.
    if (id === SETTINGS_ID) {
      navigate(SETTINGS_PATH);
      return;
    }
    if (id === OVERVIEW_ID || id.startsWith("cross-")) return;
    const path = pathById.get(id);
    if (path) {
      navigate(path);
      return;
    }
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
              containsActiveRoute={activeGroupIds.has(s.id)}
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
                  <Sidebar.ItemLabel sx={ELLIPSIS_SX}>{p.label}</Sidebar.ItemLabel>
                </Sidebar.Item>
              </RouteItem>
            ))}
          </Sidebar.Category>
        )}
      </Sidebar.Nav>

      <Sidebar.Footer showDivider>
        <Sidebar.Item id={SETTINGS_ID}>
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
  containsActiveRoute,
}: {
  section: PerspectiveSection;
  resolveVisible: (section: PerspectiveSection) => boolean;
  /**
   * True while this group holds the current route. Drives two things that used
   * to be tracked separately but are the same fact:
   *
   *  - The header is forced open (see activeGroupIds), so toggling is a no-op.
   *    Render it non-interactive rather than leaving a click target that
   *    silently does nothing, which reads as "the rail is broken".
   *  - Its icon is tinted, so an expanded group signals that you are inside it.
   *    Oxygen computes an equivalent internally but only spends it when the rail
   *    is collapsed, and the child row carrying the highlight has no icon.
   */
  containsActiveRoute: boolean;
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
        // `aria-disabled` alongside the visual treatment: the row stays a
        // focusable button whose activation is a no-op (onToggleExpand refuses
        // to collapse the group you're browsing), and without this a keyboard
        // or screen-reader user gets no signal that pressing it does nothing.
        aria-disabled={containsActiveRoute || undefined}
        sx={
          containsActiveRoute
            ? { cursor: "default", "&:hover": { bgcolor: "transparent" } }
            : undefined
        }
      >
        <Sidebar.ItemIcon
          sx={containsActiveRoute ? { color: "primary.main" } : undefined}
        >
          {section.icon ? <section.icon /> : null}
        </Sidebar.ItemIcon>
        <Sidebar.ItemLabel sx={ELLIPSIS_SX}>{section.label}</Sidebar.ItemLabel>
        {/* Literal Sidebar.Item elements, NOT a wrapper component. Oxygen
            renders a group's children with
            `cloneElement(child, { depth: depth + 1 })` and separately reads
            `child.props.id` / `extractItemContent(child.props.children)` to
            build the collapsed-rail flyout. Any wrapper — a Link, or one of
            our own components — swallows the injected `depth` and hides the
            label from that flyout. These rows navigate via `onSelect`. */}
        {visible.map((c) => (
          <Sidebar.Item key={c.id} id={c.id} sx={{ pl: NESTED_LABEL_PL }}>
            <Sidebar.ItemLabel sx={ELLIPSIS_SX}>{c.label}</Sidebar.ItemLabel>
          </Sidebar.Item>
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

/**
 * A single TOP-LEVEL row. `href` → outbound; `to` → a route; otherwise a
 * scroll-anchor.
 *
 * Only safe at the top level: this is a wrapper component, and Oxygen clones a
 * group's children to inject `depth`, which a wrapper would swallow. Nested
 * rows are written as literal `Sidebar.Item` elements at the call site instead.
 */
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
      <Sidebar.ItemLabel sx={ELLIPSIS_SX}>{label}</Sidebar.ItemLabel>
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
