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
import { Alert, Box, Button, Skeleton, Stack, Typography } from "@wso2/oxygen-ui";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { isCcBackendConfigured } from "@config/apiConfig";
import FinanceShell from "../../components/FinanceShell";
import { describeError } from "../../util/financeError";
import { CcTxnTable } from "../CcTxnTable";
import { useCcApprove } from "../useCcMutations";
import { useCcTransactions, useCcUserInfo } from "../useCc";
import { ccHasAccess, type CcTransaction } from "../ccTypes";

export default function CcApprovePage() {
  return (
    <FinanceShell
      eyebrow="💳 Credit Card Expenses"
      title="Approve submissions"
      subtitle="Review and approve card transactions submitted by your team. Leads approve pending-lead items; finance gives the final approval."
      configured={isCcBackendConfigured()}
      configKey="ONE_WSO2_CC_EXPENSES_BACKEND_URL"
    >
      <ApproveBody />
    </FinanceShell>
  );
}

function ApproveBody() {
  const userInfo = useCcUserInfo();
  const txns = useCcTransactions();
  const { showSuccess, showError } = useNotifications();
  const [checked, setChecked] = useState<Set<number>>(new Set());

  const isFinance = ccHasAccess(userInfo.data, "finance");
  const isLead = ccHasAccess(userInfo.data, "lead");
  // Finance acts first (final stage) when the user is both.
  const stage: "lead" | "finance" = isFinance ? "finance" : "lead";
  const approve = useCcApprove(stage);
  const email = userInfo.data?.workEmail;

  const targetStatus = stage === "finance" ? "pending_finance" : "pending_lead";
  const rows = useMemo(() => {
    return (txns.data ?? []).filter((t) => {
      if (stage === "lead") {
        const leads = (t.leadEmail ?? "").split(",").map((s) => s.trim());
        return t.status === "pending_lead" && email != null && leads.includes(email);
      }
      // finance sees both stages but can only action pending_finance
      return t.status === "pending_lead" || t.status === "pending_finance";
    });
  }, [txns.data, stage, email]);

  const isSelectable = (t: CcTransaction) => t.status === targetStatus;
  const selectedIds = Array.from(checked);

  const toggle = (id: number) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleApprove = () => {
    if (selectedIds.length === 0) return;
    approve.mutate(selectedIds, {
      onSuccess: () => {
        showSuccess(`${selectedIds.length} transaction(s) approved`);
        setChecked(new Set());
      },
      onError: (err) => showError(describeError(err)),
    });
  };

  if (userInfo.isLoading) {
    return <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 1.5 }} />;
  }
  if (!isFinance && !isLead) {
    return <Alert severity="info">Approvals are limited to leads and finance approvers.</Alert>;
  }

  return (
    <Box>
      <Typography sx={{ fontSize: 12, color: "text.secondary", mb: 1.5 }}>
        Acting as <b>{stage === "finance" ? "Finance approver" : "Lead"}</b> — you can approve{" "}
        {stage === "finance" ? "pending-finance" : "pending-lead"} transactions.
      </Typography>

      {txns.isLoading ? (
        <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 1.5 }} />
      ) : txns.isError ? (
        <Alert severity="error">Couldn't load transactions. {describeError(txns.error)}</Alert>
      ) : rows.length === 0 ? (
        <Typography sx={{ fontSize: 13, color: "text.secondary", py: 3 }}>
          Nothing to approve right now.
        </Typography>
      ) : (
        <Stack spacing={2}>
          <CcTxnTable txns={rows} showUser showCard selection={{ checked, onToggle: toggle, isSelectable }} />
          <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
            <Button
              variant="contained"
              color="success"
              onClick={handleApprove}
              disabled={selectedIds.length === 0 || approve.isPending}
              sx={{ fontWeight: 600 }}
            >
              {approve.isPending ? "Approving…" : `Approve ${selectedIds.length || ""}`.trim()}
            </Button>
          </Box>
        </Stack>
      )}
    </Box>
  );
}
