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

// Skeleton for the Finance perspective — the OPD/credit-card/expense claim
// apps that used to live here moved under Me (an employee submits/tracks
// these for themself, same rationale as Leave). This is just a placeholder
// until something new is designed for this spot.
export default function FinancePage() {
  return (
    <Box>
      <PerspectiveHeader
        eyebrow="Finance perspective"
        title="Finance"
        subtitle="This perspective is being rebuilt."
      />

      <Card variant="outlined" sx={{ p: 3, maxWidth: 480 }}>
        <Typography sx={{ fontSize: 15, fontWeight: 700, mb: 0.75 }}>Coming soon</Typography>
      </Card>
    </Box>
  );
}
