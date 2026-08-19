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

// Central perspective registry. The waffle switcher and left rail both read
// from this — one edit here changes every entry point.

import { isIsacConfigured, isacUrl } from "@config/apiConfig";
import type { Capability, MenuApp } from "@constants/appMenu";
import { PEOPLE_OPS_APPS } from "@constants/peopleOpsApps";
import { FINANCE_APPS } from "@constants/financeApps";
import { MARKETING_OPS_APPS } from "@constants/marketingOpsApps";
import { ME_APPS } from "@constants/meApps";

export type PerspectiveGroup = "functional" | "cross";

export interface PerspectiveSection {
  id: string; // anchor id on the perspective's page (leaf sections)
  label: string;
  // App groups (People Ops) carry an emoji + nested children. A section
  // with `children` renders as a collapsible group in the rail; a leaf
  // section scrolls to its `id`.
  emoji?: string;
  // Visible when the caller has ANY of these capabilities (OR semantics).
  // Omitted = visible to everyone. Only the People Ops app menu uses this.
  requires?: Capability[];
  children?: PerspectiveSection[];
  // When set, a leaf item is a route (rail navigates) rather than a
  // scroll-anchor. Used by the native Leave screens.
  path?: string;
  // When set, a leaf item leaves One WSO2 entirely: it renders as an anchor
  // that opens in a new tab, and is never route-highlighted because no route
  // of ours is active while the user is over there. Mutually exclusive with
  // `path` — a section is either somewhere we host or somewhere we don't.
  externalUrl?: string;
}

// Turn an App → items registry into rail sections: one collapsible group
// per app, each with its top-level menu items as children (scroll-anchor
// or route). Derived from the single-source-of-truth registries so the
// rail and the pages can't drift.
function appsToSections(apps: readonly MenuApp[]): PerspectiveSection[] {
  return apps.map((app) => ({
    id: `sec-app-${app.key}`,
    label: app.name,
    emoji: app.emoji,
    children: app.items.map((it) => ({
      id: it.id,
      label: it.label,
      requires: it.requires,
      path: it.path,
    })),
  }));
}

const PEOPLE_OPS_SECTIONS: PerspectiveSection[] = [
  ...appsToSections(PEOPLE_OPS_APPS),
];

const FINANCE_SECTIONS: PerspectiveSection[] = appsToSections(FINANCE_APPS);

// Marketing Ops. Built from the registry now so the rail is ready, but the
// perspective itself stays locked (`access: false` below) until Phase 1
// (Utilities) lands — see "My Findings Marketing Ops.md" in the repo root.
//
// Note the two-layer gating here, which differs from every other perspective:
// the `requires` values these sections carry speak One WSO2's capability
// vocabulary, but the real decision is made by useMarketingOpsGate against the
// Marketing Ops backend's own /api/me. Whatever renders these sections must ask
// that gate, not just read `requires`.
//
// ISAC leads the rail. It is NOT in MARKETING_OPS_APPS, deliberately: that
// registry is the set of operations this webapp implements, and every item in it
// resolves to a route we own. ISAC is a separate application that One WSO2 only
// points at, so it belongs here — where the rail is assembled — rather than in a
// registry that also feeds the overview page's cards and the capability gate.
//
// It is omitted entirely when its URL isn't configured. A rail item that goes
// nowhere is worse than one that isn't there.
const MARKETING_OPS_SECTIONS: PerspectiveSection[] = [
  ...(isIsacConfigured()
    ? [{ id: "mops-isac", label: "ISAC", emoji: "🛰️", externalUrl: isacUrl }]
    : []),
  ...appsToSections(MARKETING_OPS_APPS),
];

// The Me home landing — leaf scroll-anchors matching the SectionHeader ids
// on the profile page (see features/my/pages/MyProfilePage), followed by
// the apps that live here (Leave — things an employee does for themself,
// as opposed to People Ops' HR-team tools).
const ME_SECTIONS: PerspectiveSection[] = [
  { id: "my-general", label: "General information", emoji: "🧾" },
  { id: "my-personal", label: "Personal information", emoji: "👤" },
  { id: "my-emergency", label: "Emergency contacts", emoji: "🆘" },
  { id: "my-connected", label: "Connected apps", emoji: "🔗" },
  ...appsToSections(ME_APPS),
];

export interface PerspectiveDef {
  key: string;
  label: string;
  emoji: string;
  group: PerspectiveGroup;
  access: boolean;
  path?: string; // route path (undefined for locked perspectives)
  sections?: PerspectiveSection[];
}

export const PERSPECTIVES: readonly PerspectiveDef[] = [
  // "Apps" (persona areas, locked or unlocked). Order here is the order
  // shown in the waffle's Apps group.
  {
    key: "people",
    label: "People Ops",
    emoji: "👥",
    group: "functional",
    access: true,
    path: "/people-ops",
    sections: PEOPLE_OPS_SECTIONS,
  },
  {
    key: "finance",
    label: "Finance",
    emoji: "💰",
    group: "functional",
    access: true,
    path: "/finance",
    sections: FINANCE_SECTIONS,
  },
  { key: "csm", label: "CSM", emoji: "🛟", group: "functional", access: false },
  { key: "revops", label: "Rev Ops", emoji: "⚙️", group: "functional", access: false },
  { key: "legal", label: "Legal", emoji: "⚖️", group: "functional", access: false },
  // Marketing Ops — UNLOCKED. Ported so far: Utilities (UTM + Asset Name
  // generators and their Marketing Admin panels) and Ad Campaigns → Analytics.
  // Still in Marketing Ops itself: Email Workbench, Events, CRM Upload — those
  // show on the overview as cards marked "not here yet".
  //
  // Two non-obvious things about this entry:
  //  - `access` controls whether the WAFFLE offers the perspective; `path` is
  //    what lets PerspectiveProvider recognise the route and give the perspective
  //    its own rail. BOTH are needed — `access` without `path` yields a tile that
  //    looks clickable and does nothing (WaffleOverlay bails on the click), and
  //    `path` without `access` makes it reachable by URL but unadvertised.
  //  - Its rail gates on the MARKETING OPS backend's own Asgardeo groups, not on
  //    people-app privileges — see useMarketingOpsGate and the wiring in
  //    SideRail. The `requires` on these sections is a coarse hint only.
  {
    key: "marketing",
    label: "Marketing Ops",
    emoji: "📣",
    group: "functional",
    access: true,
    path: "/marketing-ops",
    sections: MARKETING_OPS_SECTIONS,
  },
  { key: "business", label: "Business", emoji: "💼", group: "functional", access: false },
  { key: "customer", label: "Customer", emoji: "🤝", group: "functional", access: false },

  // Cross-cutting (available to everyone).
  //
  // "Me" is the Home landing: the person's own profile plus the cross-app
  // aggregation (Connected apps). The people-app profile sections are also
  // surfaced inside People Ops as People → Me, but slimmed (no Connected
  // apps) — see MyProfilePage's `variant`.
  {
    key: "me",
    label: "Me",
    emoji: "🏠",
    group: "cross",
    access: true,
    path: "/me",
    sections: ME_SECTIONS,
  },
  //
  // Locked until the Service Requests surface has real content — the page
  // was a static prototype and the persona was showing up as "clickable"
  // in the waffle even though it led nowhere useful. Flip access back to
  // true (and re-add the /service-requests route in App.tsx) when there's
  // something real to land on.
  {
    key: "requests",
    label: "Service Requests",
    emoji: "⚡",
    group: "cross",
    access: false,
  },
];

export const FUNCTIONAL_PERSPECTIVES = PERSPECTIVES.filter(
  (p) => p.group === "functional",
);
export const CROSS_PERSPECTIVES = PERSPECTIVES.filter(
  (p) => p.group === "cross",
);

export function findPerspectiveByPath(pathname: string): PerspectiveDef | undefined {
  return PERSPECTIVES.find((p) => p.path && pathname.startsWith(p.path));
}

export function findPerspectiveByKey(key: string): PerspectiveDef | undefined {
  return PERSPECTIVES.find((p) => p.key === key);
}
