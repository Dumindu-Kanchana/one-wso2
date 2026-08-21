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

// Registry of the Workspace perspective's apps. Split out of People Ops —
// menu-app is an office-amenity tool, not an HR-team one, so it gets its
// own perspective. More non-HR office apps land here over time. Same
// App → items shape as @constants/financeApps; see that file's header for
// the general rationale.

import { UtensilsIcon } from "@wso2/oxygen-ui-icons-react";
import type { MenuApp } from "@constants/appMenu";

export const WORKSPACE_APPS: readonly MenuApp[] = [
  {
    key: "menu",
    name: "Menu",
    icon: UtensilsIcon,
    purpose: "Cafeteria menu, feedback, and dinner orders.",
    items: [
      { id: "menu-home", label: "Home", desc: "View the cafeteria menu, submit feedback, order dinner." },
    ],
  },
];
