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

import { useState } from "react";
import { Box } from "@wso2/oxygen-ui";
import PeopleOpsShell from "../components/PeopleOpsShell";
import OrgEntityTab from "../masterdata/OrgEntityTab";
import { ORG_ENTITY_CONFIG, ORG_ENTITY_KINDS } from "../api/useOrgChartEntities";
import { MASTER_DATA_EYEBROW } from "../reports/reportRoutes";
import type { OrgEntityKind } from "../api/peopleOpsTypes";

// Master Data → Org Structure, ported from people-app's MasterDataView.
//
// People App has five tabs here; this is the four entity tabs (business
// units, teams, sub teams, units). Its fifth, the Hierarchy drill-down that
// maps children onto parents, is a separate piece of work — these four are
// what you use to add or rename an entity, which is the common case.
//
// All four render the same OrgEntityTab: the kinds share a shape, a pair of
// endpoints and a set of rules, so the tab takes a `kind` and looks its
// wiring up rather than being written out four times.
//
// The tab bar is hand-rolled to match AdCampaignsAnalyticsPage, which is how
// tabs already look in this app.
export default function OrgStructurePage() {
  const [activeKind, setActiveKind] = useState<OrgEntityKind>("businessUnit");

  return (
    <PeopleOpsShell
      eyebrow={MASTER_DATA_EYEBROW}
      title="Org structure"
      subtitle="The business units, teams, sub teams and units employees are assigned to. Changes here affect every filter and assignment list across the app."
    >
      <Box
        role="tablist"
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          mb: 2.5,
          borderBottom: 1,
          borderColor: "divider",
          flexWrap: "wrap",
        }}
      >
        {ORG_ENTITY_KINDS.map((kind) => {
          const active = activeKind === kind;
          return (
            <Box
              key={kind}
              component="button"
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveKind(kind)}
              sx={{
                px: 2,
                py: 1.25,
                border: 0,
                bgcolor: "transparent",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 14,
                fontWeight: active ? 700 : 500,
                color: active ? "primary.main" : "text.secondary",
                position: "relative",
                transition: "color .12s ease",
                "&:hover": { color: active ? "primary.main" : "text.primary" },
                "&::after": active
                  ? {
                      content: '""',
                      position: "absolute",
                      left: 0,
                      right: 0,
                      bottom: -1,
                      height: 3,
                      borderRadius: "2px 2px 0 0",
                      bgcolor: "primary.main",
                    }
                  : {},
              }}
            >
              {ORG_ENTITY_CONFIG[kind].pluralLabel}
            </Box>
          );
        })}
      </Box>

      {/* Keyed, so switching tabs resets the search and status filter rather
          than carrying one kind's filters onto another's list. */}
      <OrgEntityTab key={activeKind} kind={activeKind} />
    </PeopleOpsShell>
  );
}
