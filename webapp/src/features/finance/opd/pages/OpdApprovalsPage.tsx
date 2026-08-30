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
import {
  Alert,
  Box,
  Button,
  Skeleton,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  Typography,
} from "@wso2/oxygen-ui";
import { isOpdBackendConfigured } from "@config/apiConfig";
import FinanceShell from "../../components/FinanceShell";
import { describeError } from "../../util/financeError";
import { money, formatNice } from "../../util/financeFormat";
import { useOpdClaims, useOpdUserInfo } from "../useOpd";
import { OpdClaimDetailsDialog } from "../OpdClaimDetailsDialog";
import { OPD_ROLE, opdHasRole, type OpdClaim, type OpdClaimStatus } from "../opdTypes";
import { FINANCE_EYEBROW } from "@constants/financeApps";

type TabKey = "pending" | "approved" | "rejected";
const TAB_STATUS: Record<TabKey, OpdClaimStatus[]> = {
  // PENDING_OLD rides along with PENDING — filteredClaimsSlice.ts:82-89 adds it
  // whenever PENDING is the only status asked for. Claims filed before the
  // status was split carry PENDING_OLD, so asking for PENDING alone hides them
  // from the finance queue entirely and nobody can action them.
  pending: ["PENDING", "PENDING_OLD"],
  approved: ["APPROVED"],
  rejected: ["REJECTED"],
};

export default function OpdApprovalsPage() {
  return (
    <FinanceShell
      eyebrow={FINANCE_EYEBROW.opd}
      title="OPD approvals"
      subtitle="Finance review of OPD claims across the company. Open a pending claim to check its bills and approve or reject it."
      configured={isOpdBackendConfigured()}
      configKey="ONE_WSO2_OPD_BACKEND_URL"
    >
      <ApprovalsBody />
    </FinanceShell>
  );
}

function ApprovalsBody() {
  const userInfo = useOpdUserInfo();
  const [tab, setTab] = useState<TabKey>("pending");
  const [selected, setSelected] = useState<OpdClaim | null>(null);

  const isFinance = opdHasRole(userInfo.data, OPD_ROLE.FINANCE_APPROVER);
  const currentYear = new Date().getFullYear();
  const claims = useOpdClaims(
    {
      status: TAB_STATUS[tab],
      // Pending spans all years; approved/rejected scope to this year.
      startYear: tab === "pending" ? undefined : currentYear,
      endYear: tab === "pending" ? undefined : currentYear,
    },
    isFinance,
  );

  if (userInfo.isLoading) {
    return <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 1.5 }} />;
  }
  if (!isFinance) {
    return <Alert severity="info">OPD approvals are limited to finance approvers.</Alert>;
  }

  return (
    <Box>
      <Tabs
        value={tab}
        onChange={(_e, v) => setTab(v as TabKey)}
        sx={{ mb: 2, minHeight: 36, "& .MuiTab-root": { minHeight: 36, textTransform: "none", fontSize: 13, fontWeight: 600 } }}
      >
        <Tab value="pending" label="Pending" />
        <Tab value="approved" label="Approved" />
        <Tab value="rejected" label="Rejected" />
      </Tabs>

      {claims.isLoading ? (
        <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 1.5 }} />
      ) : claims.isError ? (
        <Alert severity="error">Couldn't load claims. {describeError(claims.error)}</Alert>
      ) : (claims.data?.length ?? 0) === 0 ? (
        <Typography sx={{ fontSize: 13, color: "text.secondary", py: 3 }}>
          No {tab} claims.
        </Typography>
      ) : (
        <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1.5, overflow: "hidden" }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ "& th": { fontSize: 11, fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.04em" } }}>
                <TableCell>Claim ID</TableCell>
                <TableCell>User</TableCell>
                <TableCell>Submitted</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell align="right">&nbsp;</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {claims.data!.map((c) => (
                <TableRow key={c.id} hover>
                  <TableCell sx={{ fontSize: 12.5, fontFamily: "monospace" }}>{c.id}</TableCell>
                  <TableCell sx={{ fontSize: 12.5 }}>{c.employeeEmail}</TableCell>
                  <TableCell sx={{ fontSize: 12.5 }}>{formatNice(c.createdDate)}</TableCell>
                  <TableCell align="right" sx={{ fontSize: 12.5, fontVariantNumeric: "tabular-nums" }}>
                    {money(c.totalAmount)}
                  </TableCell>
                  <TableCell align="right">
                    <Button size="small" variant={tab === "pending" ? "contained" : "outlined"} onClick={() => setSelected(c)} sx={{ textTransform: "none", fontWeight: 600 }}>
                      {tab === "pending" ? "Review" : "View"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}

      <OpdClaimDetailsDialog claim={selected} onClose={() => setSelected(null)} review={tab === "pending"} />
    </Box>
  );
}
