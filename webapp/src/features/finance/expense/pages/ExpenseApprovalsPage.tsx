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
  Skeleton,
  Stack,
  Tab,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { useDebouncedValue } from "@hooks/useDebouncedValue";
import { describeError } from "../../util/financeError";
import { useExpenseAppData, useExpenseClaims, useExpenseEmployees } from "../useExpense";
import { ExpenseClaimDetailsDialog } from "../ExpenseClaimDetailsDialog";
import { ClaimsTable } from "./ExpenseHistoryPage";
import {
  FINANCE_TABS,
  LEAD_TABS,
  type ApproverView,
  type ExpenseClaim,
} from "../expenseTypes";

// The expense tab of Claim approval. It used to be two menu entries under Me,
// one per stage; the stage is now a control on one screen, because the two
// backend flags are independent and a person holding both had to leave the
// screen to see the other half of their own queue.
export default function ExpenseApprovalsTab() {
  const appData = useExpenseAppData();
  const canLead = Boolean(appData.data?.enableLeadView);
  const canFinance = Boolean(appData.data?.enableFinanceView);

  // Opens on whichever stage this person actually holds. Someone with one flag
  // never sees the switch at all — there is nothing to switch to.
  const [view, setView] = useState<ApproverView>(canLead ? "LEAD" : "FINANCE");
  const stage: ApproverView = canLead && canFinance ? view : canLead ? "LEAD" : "FINANCE";

  return (
    <Box>
      {canLead && canFinance && (
        <ToggleButtonGroup
          size="small"
          exclusive
          value={stage}
          onChange={(_e, v) => v && setView(v as ApproverView)}
          sx={{ mb: 2 }}
        >
          <ToggleButton value="LEAD" sx={{ textTransform: "none" }}>
            As lead
          </ToggleButton>
          <ToggleButton value="FINANCE" sx={{ textTransform: "none" }}>
            As finance
          </ToggleButton>
        </ToggleButtonGroup>
      )}
      <ApprovalsBody view={stage} />
    </Box>
  );
}

function ApprovalsBody({ view }: { view: ApproverView }) {
  const appData = useExpenseAppData();
  const tabs = view === "LEAD" ? LEAD_TABS : FINANCE_TABS;
  const [tabKey, setTabKey] = useState(tabs[0].key);
  const [selected, setSelected] = useState<ExpenseClaim | null>(null);

  const allowed = view === "LEAD" ? appData.data?.enableLeadView : appData.data?.enableFinanceView;
  const activeTab = tabs.find((t) => t.key === tabKey) ?? tabs[0];
  const email = appData.data?.userInfo.workEmail ?? undefined;

  // FilterHolder.tsx:218-249 — an approver can narrow the queue to one
  // employee or one claim id. Without them the only way to find a claim is to
  // scroll everyone's.
  const [claimId, setClaimId] = useState("");
  // Debounced before it reaches the query: useExpenseClaims keys on the whole
  // payload, so the raw value would fire a search per keystroke — and on the
  // finance view that search spans the company. The source batches the same
  // fields behind an Apply button (FilterHolder.tsx:53,81-82).
  const claimIdFilter = useDebouncedValue(claimId.trim());
  const [employee, setEmployee] = useState<string | null>(null);
  const employees = useExpenseEmployees(Boolean(allowed));

  const claims = useExpenseClaims(
    {
      ...(view === "LEAD" ? { leadEmail: email } : {}),
      status: activeTab.statuses,
      ids: claimIdFilter ? [claimIdFilter] : undefined,
      email: employee ?? undefined,
    },
    Boolean(allowed),
  );

  if (appData.isLoading) {
    return <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 1.5 }} />;
  }
  if (appData.isError) {
    return <Alert severity="error">Couldn't load your finance profile. {describeError(appData.error)}</Alert>;
  }
  if (!allowed) {
    return (
      <Alert severity="info">
        {view === "LEAD"
          ? "You don't have any reports with expense claims to approve."
          : "Finance approvals are limited to finance approvers."}
      </Alert>
    );
  }

  const isPendingTab = activeTab.key === "pending";

  return (
    <Box>
      <Tabs
        value={tabKey}
        onChange={(_e, v) => setTabKey(String(v))}
        sx={{ mb: 2, minHeight: 36, "& .MuiTab-root": { minHeight: 36, textTransform: "none", fontSize: 13, fontWeight: 600 } }}
      >
        {tabs.map((t) => (
          <Tab key={t.key} value={t.key} label={t.label} />
        ))}
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
          No {activeTab.label.toLowerCase()} claims.
        </Typography>
      ) : (
        <ClaimsTable
          claims={claims.data!}
          onView={setSelected}
          userColumn
          actionLabel={isPendingTab ? "Review" : "View"}
          actionVariant={isPendingTab ? "contained" : "outlined"}
        />
      )}

      <ExpenseClaimDetailsDialog claim={selected} onClose={() => setSelected(null)} review={isPendingTab ? view : undefined} />
    </Box>
  );
}
