/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { Box, Card, Skeleton, Typography } from "@wso2/oxygen-ui";
import { ArrowRightIcon, CheckCheckIcon } from "@wso2/oxygen-ui-icons-react";
import { NavLink } from "react-router";
import PerspectiveHeader from "@components/perspective-header/PerspectiveHeader";
import { useFinanceGate } from "../api/useFinanceGate";
import { CLAIM_APPROVAL_PATH } from "../approvals/claimApprovalTabs";

// The Finance overview. It said "coming soon" while the perspective was empty;
// Claim approval is here now, so it says what is here instead.
//
// The card is gated by the same rule as the rail entry: someone who approves no
// claims should not be offered a link to a screen that will turn them away.
export default function FinancePage() {
  const gate = useFinanceGate();
  const canApprove = gate.canSee("claim-approval");

  return (
    <Box>
      <PerspectiveHeader
        eyebrow="Finance perspective"
        title="Finance"
        subtitle="Decisions on other people's claims. Filing your own, and looking up what you filed, stay under Me."
      />

      {gate.isResolving ? (
        <Skeleton variant="rectangular" height={132} sx={{ borderRadius: 1.5, maxWidth: 480 }} />
      ) : canApprove ? (
        <Card
          variant="outlined"
          component={NavLink}
          to={CLAIM_APPROVAL_PATH}
          sx={{
            p: 2.5,
            maxWidth: 480,
            display: "block",
            textDecoration: "none",
            color: "inherit",
            transition: "border-color .12s, background-color .12s",
            "&:hover": { borderColor: "primary.main", bgcolor: "action.hover" },
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.75 }}>
            <CheckCheckIcon size={16} />
            <Typography sx={{ fontSize: 15, fontWeight: 700, flex: 1 }}>Claim approval</Typography>
            <ArrowRightIcon size={15} />
          </Box>
          <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
            Expense and OPD claims waiting on your decision, and the ones already decided.
          </Typography>
        </Card>
      ) : (
        // Not an error, and not "coming soon" either: the perspective is built,
        // it just holds nothing this person is party to.
        <Card variant="outlined" sx={{ p: 2.5, maxWidth: 480 }}>
          <Typography sx={{ fontSize: 15, fontWeight: 700, mb: 0.75 }}>
            Nothing here for you yet
          </Typography>
          <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
            Finance holds the approval queues for expense and OPD claims. Your own claims are under
            Me.
          </Typography>
        </Card>
      )}
    </Box>
  );
}
