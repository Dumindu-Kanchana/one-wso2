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
// Same App → items shape as @constants/financeApps / workspaceApps; see
// that file's header for the general rationale.

import {
  ClipboardCheckIcon,
  TreePalmIcon,
} from "@wso2/oxygen-ui-icons-react";
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
  {
    key: "par",
    name: "PAR",
    icon: ClipboardCheckIcon,
    purpose: "Your performance appraisal review — write it, ask colleagues for 360° feedback, and read your lead's.",
    // These ids are what SideRail routes to PAR's own gate (PAR_ITEM_IDS in
    // features/par/util/parItems.ts), NOT to `requires`. Adding an item here
    // without listing it there would resolve it against people-app privileges
    // instead — the wrong vocabulary. The gate fails closed, so an unlisted id
    // stays hidden rather than leaking.
    items: [
      { id: "par-my", label: "My PAR", desc: "Your appraisal for the current cycle.", path: "/me/par" },
      { id: "par-history", label: "History", desc: "Your appraisals from closed cycles.", path: "/me/par/history" },
    ],
  },
];
