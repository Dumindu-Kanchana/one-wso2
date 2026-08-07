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
import { PEOPLE_OPS_APPS } from "@constants/peopleOpsApps";
import { FINANCE_APPS } from "@constants/financeApps";

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
  { id: "sec-dashboard", label: "Dashboard", emoji: "📊", path: "/people-ops/dashboard" },
  ...appsToSections(PEOPLE_OPS_APPS),
];

const FINANCE_SECTIONS: PerspectiveSection[] = appsToSections(FINANCE_APPS);

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
  // Functional (persona-based, locked or unlocked)
  { key: "csm", label: "CSM", emoji: "🛟", group: "functional", access: false },
  {
    key: "people",
    label: "People Ops",
    emoji: "👥",
    group: "functional",
    access: true,
    path: "/people-ops",
    sections: PEOPLE_OPS_SECTIONS,
  },
  { key: "sales", label: "Sales", emoji: "📈", group: "functional", access: false },
  { key: "revops", label: "Rev Ops", emoji: "⚙️", group: "functional", access: false },
  { key: "marketing", label: "Marketing", emoji: "📣", group: "functional", access: false },
  {
    key: "finance",
    label: "Finance",
    emoji: "💰",
    group: "functional",
    access: true,
    path: "/finance",
    sections: FINANCE_SECTIONS,
  },
  { key: "leadership", label: "Leadership", emoji: "🧭", group: "functional", access: false },

  // Cross-cutting (available to everyone). "My" used to live here as its
  // own perspective; it now lives inside People Ops as People → Me (the
  // default landing), so it's no longer a separate rail/waffle entry.
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
