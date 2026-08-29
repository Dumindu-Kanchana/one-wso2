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

// Registry of apps surfaced under the "Me" perspective — things every
// employee does for themselves, as opposed to People Ops' HR-team tools.
// Same App → items shape as @constants/financeApps; see
// that file's header for the general rationale.

import { TreePalmIcon, UtensilsIcon } from "@wso2/oxygen-ui-icons-react";
import type { MenuApp } from "@constants/appMenu";

export const ME_APPS: readonly MenuApp[] = [
  {
    key: "leave",
    name: "Leave",
    icon: TreePalmIcon,
    purpose: "Apply for and track leave; leads and people-ops approve and report.",
    items: [
      { id: "leave-apply", label: "Apply", desc: "Request general leave.", path: "/me/leave/apply" },
      { id: "leave-history", label: "My History", desc: "Your past and upcoming leave.", path: "/me/leave/history" },
      { id: "leave-reports", label: "Reports", desc: "Leave usage reports across the org.", requires: ["lead", "admin"], path: "/me/leave/reports" },
      // Sabbatical use cases (apply/approve/report) are on hold this
      // iteration — placeholder links out to the Leave app instead.
      { id: "leave-sabbatical", label: "Sabbatical", desc: "Coming soon — apply via the Leave app for now.", path: "/me/leave/sabbatical" },
    ],
  },
  // Moved out of its own Workspace perspective, which existed for this one
  // screen: a waffle tile, a rail entry and a landing option, all to reach a
  // single page. It sits with Leave and the finance apps because it is the same
  // kind of thing — an everyday app any employee uses. If more office apps
  // arrive (room booking, IT requests), Workspace can come back with something
  // in it; reinstating it is the same size of change as removing it was.
  {
    key: "menu",
    name: "Menu",
    icon: UtensilsIcon,
    purpose: "Cafeteria menu, feedback, and dinner orders.",
    items: [
      {
        id: "menu-home",
        label: "Home",
        desc: "View the cafeteria menu, submit feedback, order dinner.",
        path: "/me/menu",
      },
    ],
  },
];
