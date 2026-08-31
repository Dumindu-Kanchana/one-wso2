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
  Autocomplete,
  Box,
  Button,
  Skeleton,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Stack,
  Tabs,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { useDebouncedValue } from "@hooks/useDebouncedValue";
import { isOpdBackendConfigured } from "@config/apiConfig";
import { describeError } from "../../util/financeError";
import { money, formatNice } from "../../util/financeFormat";
import { useOpdClaims, useOpdEmployees, useOpdUserInfo } from "../useOpd";
import { OpdClaimDetailsDialog } from "../OpdClaimDetailsDialog";
import { OPD_ROLE, opdHasRole, opdStatusFilter, type OpdClaim, type OpdClaimStatus } from "../opdTypes";

type TabKey = "pending" | "approved" | "rejected";
const TAB_STATUS: Record<TabKey, OpdClaimStatus[]> = {
  pending: ["PENDING"],
  approved: ["APPROVED"],
  rejected: ["REJECTED"],
};

// The OPD tab of Claim approval. The page frame is the shell's now, but this
// screen still owns the one thing only it knows: whether its own backend is
// configured. Claim approval spans two backends and either may be missing, so
// the notice belongs per tab rather than around the whole screen.
export default function OpdApprovalsTab() {
  if (!isOpdBackendConfigured()) {
    return (
      <Alert severity="info">
        OPD claims aren&apos;t connected yet. Set <code>ONE_WSO2_OPD_BACKEND_URL</code> in{" "}
        <code>public/config.js</code> and reload.
      </Alert>
    );
  }
  return <ApprovalsBody />;
}

function ApprovalsBody() {
  const userInfo = useOpdUserInfo();
  const [tab, setTab] = useState<TabKey>("pending");
  const [selected, setSelected] = useState<OpdClaim | null>(null);

  const isFinance = opdHasRole(userInfo.data, OPD_ROLE.FINANCE_APPROVER);
  const currentYear = new Date().getFullYear();
  // FilterHolder.tsx:271-296,300-306 — the finance view can narrow the queue to
  // one employee or one claim id. Without them the only way to find a claim is
  // to scroll the whole company's.
  const [claimId, setClaimId] = useState("");
  // Debounced before it reaches the query: useOpdClaims keys on the whole
  // payload, so the raw value would fire a search per keystroke — and on the
  // finance view that search spans the company. The source batches the same
  // fields behind an Apply button (FilterHolder.tsx:53,81-82).
  const claimIdFilter = useDebouncedValue(claimId.trim());
  const [employee, setEmployee] = useState<string | null>(null);
  const employees = useOpdEmployees(isFinance);

  const claims = useOpdClaims(
    {
      status: opdStatusFilter(TAB_STATUS[tab]),
      // Pending spans all years; approved/rejected scope to this year.
      startYear: tab === "pending" ? undefined : currentYear,
      endYear: tab === "pending" ? undefined : currentYear,
      ids: claimIdFilter ? [claimIdFilter] : undefined,
      email: employee ?? undefined,
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

      <Stack direction="row" spacing={1.5} sx={{ mb: 2, flexWrap: "wrap", rowGap: 1.5 }}>
        <Autocomplete
          size="small"
          options={(employees.data ?? []).map((e) => e.workEmail)}
          value={employee}
          onChange={(_e, v) => setEmployee(v)}
          loading={employees.isLoading}
          sx={{ minWidth: 260 }}
          renderInput={(params) => <TextField {...params} label="Filter by email" />}
        />
        <TextField
          size="small"
          label="Filter by claim ID"
          value={claimId}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setClaimId(e.target.value)}
          sx={{ minWidth: 200 }}
        />
      </Stack>

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
