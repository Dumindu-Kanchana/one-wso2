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

import { Box, Card, Chip, Typography } from "@wso2/oxygen-ui";
import SectionHeader from "../components/SectionHeader";

// This perspective's prior content (People/Visitor/Careers app menus, the
// mock hiring/performance dashboard) was retired per restructuring
// feedback. These three are the reports planned to onboard next — each a
// placeholder until its backend lands. Ids match PEOPLE_OPS_SECTIONS in
// @constants/perspectives so the left rail scrolls to the right card.
const REPORTS = [
  { id: "people-active-employee-report", emoji: "🧍", label: "Active employee report" },
  { id: "people-resignation-report", emoji: "📤", label: "Resignation report" },
  { id: "people-master-data", emoji: "🗂️", label: "Master data" },
] as const;

export default function PeopleOpsPage() {
  return (
    <Box>
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
        This perspective is being rebuilt. Here's what's coming next.
      </Typography>

      {REPORTS.map((r) => (
        <Box key={r.id}>
          <SectionHeader id={r.id}>
            <span style={{ fontSize: 14 }}>{r.emoji}</span>
            {r.label}
          </SectionHeader>
          <Card variant="outlined" sx={{ p: 3, maxWidth: 480 }}>
            <Typography sx={{ fontSize: 15, fontWeight: 700, mb: 0.75 }}>Coming soon</Typography>
            <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
              {r.label} isn't available yet — check back once it ships.
            </Typography>
          </Card>
        </Box>
      ))}
    </Box>
  );
}
