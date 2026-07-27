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

export type PerspectiveGroup = "functional" | "cross";

export interface PerspectiveSection {
  id: string; // anchor id on the perspective's page
  label: string;
}

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
    sections: [
      { id: "sec-hiring", label: "Hiring" },
      { id: "sec-candidates", label: "Candidates" },
      { id: "sec-performance", label: "Performance & promotions" },
      { id: "sec-people", label: "People" },
      { id: "sec-ops", label: "Operational services" },
    ],
  },
  { key: "sales", label: "Sales", emoji: "📈", group: "functional", access: false },
  { key: "revops", label: "Rev Ops", emoji: "⚙️", group: "functional", access: false },
  { key: "marketing", label: "Marketing", emoji: "📣", group: "functional", access: false },
  { key: "finance", label: "Finance", emoji: "💰", group: "functional", access: false },
  { key: "leadership", label: "Leadership", emoji: "🧭", group: "functional", access: false },

  // Cross-cutting (available to everyone)
  {
    key: "my",
    label: "My",
    emoji: "🙋",
    group: "cross",
    access: true,
    path: "/my",
    sections: [
      { id: "my-general", label: "General" },
      { id: "my-personal", label: "Personal" },
      { id: "my-emergency", label: "Emergency contacts" },
      { id: "my-connected", label: "Connected apps" },
    ],
  },
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
