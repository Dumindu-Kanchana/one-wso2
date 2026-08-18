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

import type { Capability, MenuApp } from "@constants/appMenu";
import { WORKSPACE_APPS } from "@constants/workspaceApps";
import { FINANCE_APPS } from "@constants/financeApps";
import { ME_APPS } from "@constants/meApps";

export type PerspectiveGroup = "functional" | "cross";

export interface PerspectiveSection {
  id: string; // anchor id on the perspective's page (leaf sections)
  label: string;
  // App groups (Leave, Finance, Workspace) carry an emoji + nested children.
  // A section with `children` renders as a collapsible group in the rail; a
  // leaf section scrolls to its `id`.
  emoji?: string;
  // Visible when the caller has ANY of these capabilities (OR semantics).
  // Omitted = visible to everyone. Only app-menu registries (Leave, Finance,
  // Workspace) use this.
  requires?: Capability[];
  children?: PerspectiveSection[];
  // When set, a leaf item is a route (rail navigates) rather than a
  // scroll-anchor. Used by the native Leave screens.
  path?: string;
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

// People Ops's prior app menu (People/Visitor/Careers) was retired per
// restructuring feedback. These three leaf anchors are the reports planned
// to onboard next — each a "coming soon" card on the overview page (see
// PeopleOpsPage) until its backend lands.
const PEOPLE_OPS_SECTIONS: PerspectiveSection[] = [
  { id: "people-active-employee-report", label: "Active employee report", emoji: "🧍" },
  { id: "people-resignation-report", label: "Resignation report", emoji: "📤" },
  { id: "people-master-data", label: "Master data", emoji: "🗂️" },
];

const WORKSPACE_SECTIONS: PerspectiveSection[] = appsToSections(WORKSPACE_APPS);

// The Me home landing. The landing page itself already is the ported
// people-app "Me" profile view (General/Personal/Emergency/Connected, see
// features/my/pages/MyProfilePage) — no separate "Profile" rail entry
// needed for it. My Team mirrors people-app's lead-only nav item; it's a
// placeholder page for now (see MyTeamComingSoonPage). Then the apps that
// live here — things an employee does (and, for a lead/finance-approver
// subset of items, approves) for themself or their team, as opposed to
// People Ops' HR-team tools: Leave, then the digiops-finance claim apps
// (OPD/credit-card/expense — moved in from the retired Finance persona).
const ME_SECTIONS: PerspectiveSection[] = [
  { id: "me-my-team", label: "My Team", emoji: "🧑‍🤝‍🧑", path: "/me/my-team", requires: ["lead"] },
  ...appsToSections(ME_APPS),
  ...appsToSections(FINANCE_APPS),
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
  // Skeleton tile — clickable, lands on a "coming soon" page (see
  // FinancePage). The actual OPD/credit-card/expense claim apps live under
  // Me now (see ME_SECTIONS above); this just reserves the Finance spot in
  // the waffle/rail for whatever surfaces here next.
  {
    key: "finance",
    label: "Finance",
    emoji: "💰",
    group: "functional",
    access: true,
    path: "/finance",
  },
  // Cafeteria menu, feedback, dinner orders — split out of People Ops since
  // it's an office-amenity tool, not an HR-team one. More non-HR office
  // apps land here over time.
  {
    key: "workspace",
    label: "Workspace",
    emoji: "🧰",
    group: "functional",
    access: true,
    path: "/workspace",
    sections: WORKSPACE_SECTIONS,
  },
  { key: "csm", label: "CSM", emoji: "🛟", group: "functional", access: false },
  { key: "revops", label: "Rev Ops", emoji: "⚙️", group: "functional", access: false },
  { key: "legal", label: "Legal", emoji: "⚖️", group: "functional", access: false },
  { key: "marketing", label: "Marketing Ops", emoji: "📣", group: "functional", access: false },
  { key: "business", label: "Business", emoji: "💼", group: "functional", access: false },
  { key: "customer", label: "Customer", emoji: "🤝", group: "functional", access: false },

  // Cross-cutting (available to everyone).
  //
  // "Me" is the Home landing: the person's own profile plus the cross-app
  // aggregation (Connected apps).
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
