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

import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  FormControl,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  Typography,
} from "@wso2/oxygen-ui";
import { isCcBackendConfigured } from "@config/apiConfig";
import FinanceShell from "../../components/FinanceShell";
import { describeError } from "../../util/financeError";
import { daysAgoIso, todayIso } from "../../util/financeFormat";
import { CcTxnTable } from "../CcTxnTable";
import { useCcTransactions, useCcUserInfo } from "../useCc";
import { ccHasAccess, type CcTxnStatus } from "../ccTypes";
import { FINANCE_EYEBROW } from "@constants/financeApps";

const PERIODS = [
  { days: 7, label: "Last 7 days" },
  { days: 30, label: "Last 30 days" },
  { days: 90, label: "Last 90 days" },
  { days: 365, label: "Last year" },
];

const STATUSES: { value: CcTxnStatus | "all"; label: string }[] = [
  { value: "submitted", label: "Submitted" },
  { value: "pending_lead", label: "Pending Lead" },
  { value: "pending_finance", label: "Pending Finance" },
  { value: "new", label: "New" },
  { value: "all", label: "All statuses" },
];

export default function CcHistoryPage() {
  return (
    <FinanceShell
      eyebrow={FINANCE_EYEBROW.cc}
      title="Card transaction history"
      subtitle="Your past card submissions, filterable by status and period."
      configured={isCcBackendConfigured()}
      configKey="ONE_WSO2_CC_EXPENSES_BACKEND_URL"
    >
      <HistoryBody />
    </FinanceShell>
  );
}

function HistoryBody() {
  const userInfo = useCcUserInfo();
  const [days, setDays] = useState(30);
  const [status, setStatus] = useState<CcTxnStatus | "all">("submitted");

  const txns = useCcTransactions({ dateFrom: daysAgoIso(days), dateTo: todayIso(), includeInactive: true });
  const email = userInfo.data?.workEmail;
  const canSeeOthers = ccHasAccess(userInfo.data, "lead") || ccHasAccess(userInfo.data, "finance");

  const rows = useMemo(() => {
    let list = txns.data ?? [];
    if (!canSeeOthers) list = list.filter((t) => t.employeeEmail === email);
    if (status !== "all") list = list.filter((t) => t.status === status);
    return list;
  }, [txns.data, status, canSeeOthers, email]);

  return (
    <Box>
      <Stack direction="row" spacing={1.5} sx={{ mb: 2, flexWrap: "wrap" }}>
        <FormControl size="small">
          <Select value={days} onChange={(e) => setDays(Number(e.target.value))} sx={{ minWidth: 150 }}>
            {PERIODS.map((p) => (
              <MenuItem key={p.days} value={p.days}>
                {p.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small">
          <Select value={status} onChange={(e) => setStatus(e.target.value as CcTxnStatus | "all")} sx={{ minWidth: 170 }}>
            {STATUSES.map((s) => (
              <MenuItem key={s.value} value={s.value}>
                {s.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      {userInfo.isLoading || txns.isLoading ? (
        <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 1.5 }} />
      ) : userInfo.isError || txns.isError ? (
        <Alert severity="error">Couldn't load history. {describeError(userInfo.error ?? txns.error)}</Alert>
      ) : rows.length === 0 ? (
        <Typography sx={{ fontSize: 13, color: "text.secondary", py: 3 }}>
          No transactions match this filter.
        </Typography>
      ) : (
        <CcTxnTable txns={rows} showCard showUser={canSeeOthers} />
      )}
    </Box>
  );
}
