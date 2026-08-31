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
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { useDebouncedValue } from "@hooks/useDebouncedValue";
import { isExpenseBackendConfigured } from "@config/apiConfig";
import FinanceShell from "../../components/FinanceShell";
import { describeError } from "../../util/financeError";
import { useExpenseAppData, useExpenseClaims, useExpenseEmployees } from "../useExpense";
import { ExpenseClaimDetailsDialog } from "../ExpenseClaimDetailsDialog";
import { ClaimsTable } from "./ExpenseHistoryPage";
import { FINANCE_EYEBROW } from "@constants/financeApps";
import {
  FINANCE_TABS,
  LEAD_TABS,
  type ApproverView,
  type ExpenseClaim,
} from "../expenseTypes";

// Both approval screens are this component, parameterized by stage.
export function ExpenseLeadApprovalsPage() {
  return (
    <ApprovalsScreen
      view="LEAD"
      title="Expense — Lead approvals"
      subtitle="Review and approve expense claims submitted by your reports. Approving forwards a claim to finance."
    />
  );
}

export function ExpenseFinanceApprovalsPage() {
  return (
    <ApprovalsScreen
      view="FINANCE"
      title="Expense — Finance approvals"
      subtitle="Give the final decision on lead-approved expense claims across the company."
    />
  );
}

function ApprovalsScreen({ view, title, subtitle }: { view: ApproverView; title: string; subtitle: string }) {
  return (
    <FinanceShell
      eyebrow={FINANCE_EYEBROW.expense}
      title={title}
      subtitle={subtitle}
      configured={isExpenseBackendConfigured()}
      configKey="ONE_WSO2_EXPENSE_CLAIMS_BACKEND_URL"
    >
      <ApprovalsBody view={view} />
    </FinanceShell>
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
