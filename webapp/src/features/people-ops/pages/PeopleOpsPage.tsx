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

import { Box, Card, Typography } from "@wso2/oxygen-ui";
import PerspectiveHeader from "@components/perspective-header/PerspectiveHeader";
import { PEOPLE_OPS_SECTIONS } from "@constants/perspectives";
import SectionHeader from "../components/SectionHeader";

// This perspective's prior content (People/Visitor/Careers app menus, the
// mock hiring/performance dashboard) was retired per restructuring
// feedback. These three are the reports planned to onboard next — each a
// placeholder until its backend lands. Read straight from PEOPLE_OPS_SECTIONS
// rather than restating them here, so the rail's anchors and these cards
// cannot drift apart.
const REPORTS = PEOPLE_OPS_SECTIONS;

export default function PeopleOpsPage() {
  return (
    <Box>
      <PerspectiveHeader
        eyebrow="People Ops perspective"
        title="People Operations"
        subtitle="This perspective is being rebuilt. Here's what's coming next."
      />

      {REPORTS.map((r) => (
        <Box key={r.id}>
          <SectionHeader id={r.id}>
            {r.icon ? <r.icon size={14} /> : null}
            {r.label}
          </SectionHeader>
          <Card variant="outlined" sx={{ p: 3, maxWidth: 480 }}>
            <Typography sx={{ fontWeight: 600, mb: 0.75 }}>Coming soon</Typography>
            <Typography variant="body2" color="text.secondary">
              {r.label} isn't available yet — check back once it ships.
            </Typography>
          </Card>
        </Box>
      ))}
    </Box>
  );
}
