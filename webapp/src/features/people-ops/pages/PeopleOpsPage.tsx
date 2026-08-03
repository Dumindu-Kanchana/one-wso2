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

import { Box, Chip, Typography } from "@wso2/oxygen-ui";
import InsightCard from "../components/InsightCard";
import KpiRow from "../components/KpiRow";
import AppMenuBoard from "@components/app-menu/AppMenuBoard";
import { PEOPLE_OPS_APPS } from "@constants/peopleOpsApps";
import { INSIGHT_TEXT, INSIGHT_SOURCE } from "../constants/data";

export default function PeopleOpsPage() {
  return (
    <Box>
      {/* Perspective tag */}
      <Chip
        label="✦ People Ops perspective"
        color="primary"
        size="small"
        sx={{ mb: 0.5, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}
      />
      <Typography sx={{ fontSize: 23, fontWeight: 700, letterSpacing: "-0.02em", mb: 0.5 }}>
        People Operations
      </Typography>
      <Typography sx={{ fontSize: 13, color: "text.secondary", mb: 2.25, maxWidth: "68ch" }}>
        Every people-ops-suite app in one place — jump to any app's section from the
        left rail. What you see is scoped to your role.
      </Typography>

      <InsightCard text={INSIGHT_TEXT} source={INSIGHT_SOURCE} />

      <KpiRow />

      <AppMenuBoard apps={PEOPLE_OPS_APPS} />
    </Box>
  );
}
