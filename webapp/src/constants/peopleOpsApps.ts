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

// Registry of the people-ops-suite apps and their top-level menu items,
// surfaced inside the One WSO2 People Ops perspective as a nested
// App → items left-rail menu (and as scroll-anchored sections on the
// People Ops canvas).
//
// This is data-driven, not live-fetched: the four apps
// (people-app, menu-app, visitor-app, careers-app) are each deployed
// separately, so we can't read their route configs at runtime. Leave
// lives under the Me perspective instead — see @constants/meApps — since
// it's something every employee does for themselves, not an HR-team tool.
// This registry mirrors the top-level nav items each app's own webapp
// renders (src/route.ts / layout/sidebar), transcribed here as the single
// source of truth for both the rail and the page. When an app adds a
// menu item, add it here. The generic shape + capability model live in
// @constants/appMenu.

import type { MenuApp } from "@constants/appMenu";

export const PEOPLE_OPS_APPS: readonly MenuApp[] = [
  {
    key: "people",
    name: "People",
    emoji: "👥",
    purpose: "HR & people operations — employee records, org structure, onboarding.",
    items: [
      { id: "people-me", label: "Me", desc: "Your own employee record and profile.", path: "/people-ops/me" },
      { id: "people-employees", label: "Employees", desc: "Directory of all employees.", requires: ["admin"] },
      { id: "people-onboarding", label: "Onboarding", desc: "Onboard new joiners and bulk-provision accounts.", requires: ["admin"] },
      { id: "people-my-team", label: "My Team", desc: "Your direct and indirect reports.", requires: ["lead"] },
      { id: "people-reports", label: "Reports", desc: "Active/inactive employee reports and QR codes.", requires: ["admin", "serviceDesk"] },
      { id: "people-master-data", label: "Master Data", desc: "Org master data — business units, teams, designations.", requires: ["admin"] },
    ],
  },
  {
    key: "menu",
    name: "Menu",
    emoji: "🍽️",
    purpose: "Cafeteria menu, feedback, and dinner orders.",
    items: [
      { id: "menu-home", label: "Home", desc: "View the cafeteria menu, submit feedback, order dinner." },
    ],
  },
  {
    key: "visitor",
    name: "Visitor",
    emoji: "🛂",
    purpose: "Register visitors and manage on-site visits.",
    items: [
      { id: "visitor-visit", label: "Visit", desc: "Register a visitor and create a visit." },
      { id: "visitor-admin", label: "Admin Panel", desc: "Administer visitors and visit records.", requires: ["admin"] },
      { id: "visitor-scanner", label: "Scanner", desc: "Scan visitor passes at reception.", requires: ["admin"] },
    ],
  },
  {
    key: "careers",
    name: "Careers",
    emoji: "💼",
    purpose: "Browse internal vacancies and track applications.",
    items: [
      { id: "careers-dashboard", label: "Dashboard", desc: "Your careers overview." },
      { id: "careers-profile", label: "My Profile", desc: "Your candidate profile." },
      { id: "careers-jobs", label: "Browse Jobs", desc: "Open WSO2 vacancies." },
      { id: "careers-applications", label: "My Applications", desc: "Track applications you've submitted." },
      { id: "careers-saved", label: "Saved Jobs", desc: "Jobs you've bookmarked." },
      { id: "careers-help", label: "Help", desc: "Careers portal help." },
    ],
  },
];
