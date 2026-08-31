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
  InputLabel,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  Typography,
} from "@wso2/oxygen-ui";
import { isCcBackendConfigured } from "@config/apiConfig";
import FinanceShell from "../../components/FinanceShell";
import { describeError } from "../../util/financeError";
import { daysAgoIso } from "../../util/financeFormat";
import { CcTxnTable } from "../CcTxnTable";
import { CcTxnDetailsDialog } from "../CcTxnDetailsDialog";
import { useCcTransactions, useCcUserInfo } from "../useCc";
import { type CcTransaction, ccHasAccess, type CcTxnStatus } from "../ccTypes";
import { FINANCE_EYEBROW } from "@constants/financeApps";

// FILTER_ALL in submission-history/index.tsx.
const ALL = "all";

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
  // submission-history/index.tsx:73 opens on 7 days.
  const [days, setDays] = useState(7);
  const [status, setStatus] = useState<CcTxnStatus | "all">("submitted");
  // submission-history/index.tsx:74-76 — a lead or finance also narrows by
  // person, by card and by lead. Without them the only way to find one
  // person's spend is to read the whole table.
  const [user, setUser] = useState(ALL);
  const [card, setCard] = useState(ALL);
  const [lead, setLead] = useState(ALL);
  const [selected, setSelected] = useState<CcTransaction | null>(null);

  const txns = useCcTransactions({ dateFrom: daysAgoIso(days), includeInactive: true });
  const email = userInfo.data?.workEmail;
  const canSeeOthers = ccHasAccess(userInfo.data, "lead") || ccHasAccess(userInfo.data, "finance");

  const all = useMemo(() => txns.data ?? [], [txns.data]);

  // :98-113 — the option lists come from what is actually on screen, so they
  // never offer a person or card with nothing to show.
  const users = useMemo(
    () => [...new Set(all.map((t) => t.employeeEmail))].sort(),
    [all],
  );
  const cards = useMemo(() => [...new Set(all.map((t) => t.ccNumber))].sort(), [all]);
  const leads = useMemo(
    () =>
      [...new Set(all.flatMap((t) => (t.leadEmail ?? "").split(",").map((l) => l.trim())))]
        .filter(Boolean)
        .sort(),
    [all],
  );

  const rows = useMemo(() => {
    let list = all;
    if (!canSeeOthers) list = list.filter((t) => t.employeeEmail === email);
    if (status !== "all") list = list.filter((t) => t.status === status);
    if (user !== ALL) list = list.filter((t) => t.employeeEmail === user);
    if (card !== ALL) list = list.filter((t) => t.ccNumber === card);
    // :152 — a card can carry several leads, so match within the list.
    if (lead !== ALL)
      list = list.filter((t) =>
        (t.leadEmail ?? "").split(",").map((l) => l.trim()).includes(lead),
      );
    return list;
  }, [all, status, canSeeOthers, email, user, card, lead]);

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

        {/* :175-178,218-249 — offered only to someone who can see other
            people's spend; for everyone else the list is already their own. */}
        {canSeeOthers && (
          <>
            <PickOne label="User" value={user} onChange={setUser} options={users} />
            <PickOne label="Card" value={card} onChange={setCard} options={cards} />
            <PickOne label="Lead" value={lead} onChange={setLead} options={leads} />
          </>
        )}
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
        <CcTxnTable txns={rows} showCard showUser={canSeeOthers} onOpen={setSelected} />
      )}

      <CcTxnDetailsDialog txn={selected} onClose={() => setSelected(null)} />
    </Box>
  );
}

/** One "All / …" narrowing select, built from what is on screen. */
function PickOne({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  const labelId = `cc-history-${label.toLowerCase()}`;
  return (
    <FormControl size="small">
      <InputLabel id={labelId}>{label}</InputLabel>
      <Select
        labelId={labelId}
        label={label}
        value={value}
        onChange={(e) => onChange(String(e.target.value))}
        sx={{ minWidth: 170 }}
      >
        <MenuItem value="all">All</MenuItem>
        {options.map((o) => (
          <MenuItem key={o} value={o}>
            {o}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

