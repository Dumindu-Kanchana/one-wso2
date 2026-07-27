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

import { Box, Button, Chip, Stack, Typography } from "@wso2/oxygen-ui";
import SectionHeader from "../components/SectionHeader";
import InsightCard from "../components/InsightCard";
import KpiRow from "../components/KpiRow";
import OpenRequisitions from "../components/OpenRequisitions";
import InterviewsThisWeek from "../components/InterviewsThisWeek";
import CandidatesTable from "../components/CandidatesTable";
import PerformancePromotions from "../components/PerformancePromotions";
import RecentJoiners from "../components/RecentJoiners";
import EmployeeDirectory from "../components/EmployeeDirectory";
import OperationalServices from "../components/OperationalServices";
import { INSIGHT_TEXT, INSIGHT_SOURCE } from "../constants/data";

const CHIPS = ["Open a req", "Review candidates", "Publish a job", "Start review cycle", "✦ Ask Novera"];

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
      <Typography sx={{ fontSize: 23, fontWeight: 700, letterSpacing: "-0.02em", mb: 2.25 }}>
        People Operations
      </Typography>

      <InsightCard text={INSIGHT_TEXT} source={INSIGHT_SOURCE} />

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
        {CHIPS.map((c) => (
          <Button
            key={c}
            variant="outlined"
            size="small"
            sx={{ fontSize: 12, fontWeight: 500, borderRadius: 1.125 }}
          >
            {c}
          </Button>
        ))}
      </Stack>

      <KpiRow />

      <SectionHeader id="sec-hiring">Hiring</SectionHeader>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.75 }}>
        <OpenRequisitions />
        <InterviewsThisWeek />
      </Box>

      <SectionHeader id="sec-candidates">Candidates</SectionHeader>
      <CandidatesTable />

      <SectionHeader id="sec-performance">Performance &amp; promotions</SectionHeader>
      <PerformancePromotions />

      <SectionHeader id="sec-people">People</SectionHeader>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.75 }}>
        <RecentJoiners />
        <EmployeeDirectory />
      </Box>

      <SectionHeader id="sec-ops">Operational services</SectionHeader>
      <OperationalServices />
    </Box>
  );
}
