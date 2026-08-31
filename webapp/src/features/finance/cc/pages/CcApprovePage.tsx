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
import { useCcApprove, useCcSaveEdit } from "../useCcMutations";
import { CcEditDialog } from "../CcEditDialog";
import { useCcTransactions, useCcUserInfo } from "../useCc";
import { ccHasAccess, type CcTransaction } from "../ccTypes";
import { FINANCE_EYEBROW } from "@constants/financeApps";

export default function CcApprovePage() {
  return (
    <FinanceShell
      eyebrow={FINANCE_EYEBROW.cc}
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
  const email = userInfo.data?.workEmail;
  // Instantiate both stages so a user who holds BOTH roles can lead-approve
  // AND finance-approve — the previous single pinned stage left dual-role
  // users unable to action pending_lead rows at all. The stage per row is
  // derived from its status at submit time.
  const [editing, setEditing] = useState<CcTransaction | null>(null);
  const saveEdit = useCcSaveEdit();
  const leadApprove = useCcApprove("lead");
  const financeApprove = useCcApprove("finance");

  // A row is actionable if the user is a lead of it (pending_lead) or a
  // finance approver (pending_finance). Only actionable rows are shown.
  const isUserLeadOf = (t: CcTransaction) => {
    const leads = (t.leadEmail ?? "").split(",").map((s) => s.trim());
    return email != null && leads.includes(email);
  };
  const isSelectable = (t: CcTransaction) =>
    (isLead && t.status === "pending_lead" && isUserLeadOf(t)) ||
    (isFinance && t.status === "pending_finance");

  // approve-submissions/index.tsx:122-126 — finance's queue spans BOTH stages.
  // A row still with the lead is shown but not actionable (isRowSelectable,
  // ApproveTransactionsDataGrid.tsx:157-166), so finance can see what is
  // waiting upstream instead of it being invisible until the lead acts.
  const isVisible = (t: CcTransaction) =>
    isSelectable(t) || (isFinance && t.status === "pending_lead");

  const rows = useMemo(
    () => (txns.data ?? []).filter(isVisible),
    // isVisible closes over isLead/isFinance/email
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [txns.data, isLead, isFinance, email],
  );

  // Split the checked, still-selectable rows by stage — each goes to its own
  // approve endpoint.
  const selected = useMemo(
    () => rows.filter((t) => checked.has(t.id) && isSelectable(t)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, checked, isLead, isFinance, email],
  );
  const leadIds = selected.filter((t) => t.status === "pending_lead").map((t) => t.id);
  const financeIds = selected.filter((t) => t.status === "pending_finance").map((t) => t.id);
  const selectedCount = leadIds.length + financeIds.length;
  const approving = leadApprove.isPending || financeApprove.isPending;
  // An edit saved from this screen is a separate request. Approving before it
  // lands would book the row as it was before the correction, so the button
  // waits for it. (The source does not guard this; see the spec.)
  const busy = approving || saveEdit.isPending;

  const toggle = (id: number) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleApprove = () => {
    if (selectedCount === 0) return;
    const tasks: Promise<unknown>[] = [];
    if (leadIds.length) tasks.push(leadApprove.mutateAsync(leadIds));
    if (financeIds.length) tasks.push(financeApprove.mutateAsync(financeIds));
    Promise.all(tasks)
      .then(() => {
        showSuccess(`${selectedCount} transaction(s) approved`);
        setChecked(new Set());
      })
      .catch((err) => showError(describeError(err)));
  };

  if (userInfo.isLoading) {
    return <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 1.5 }} />;
  }
  if (userInfo.isError) {
    return <Alert severity="error">Couldn't load your finance profile. {describeError(userInfo.error)}</Alert>;
  }
  if (!isFinance && !isLead) {
    return <Alert severity="info">Approvals are limited to leads and finance approvers.</Alert>;
  }

  const roleLabel =
    isLead && isFinance ? "Lead & Finance approver" : isFinance ? "Finance approver" : "Lead";

  return (
    <Box>
      <Typography sx={{ fontSize: 12, color: "text.secondary", mb: 1.5 }}>
        Acting as <b>{roleLabel}</b> — approve the transactions awaiting your decision.
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
          <CcTxnTable
            txns={rows}
            showUser
            showCard
            selection={{ checked, onToggle: toggle, isSelectable }}
            // ApproveTransactionsDataGrid.tsx:372 — enableEdit is finance-only,
            // and EditPane.tsx:659-665 locks the fields while a row is still
            // with the lead, so finance corrects only what has reached them.
            edit={
              isFinance
                ? {
                    canEdit: (t) => t.status === "pending_finance",
                    onEdit: (t) => setEditing(t),
                  }
                : undefined
            }
          />
          <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
            <Button
              variant="contained"
              color="success"
              onClick={handleApprove}
              disabled={selectedCount === 0 || busy}
              sx={{ fontWeight: 600 }}
            >
              {approving ? "Approving…" : `Approve ${selectedCount || ""}`.trim()}
            </Button>
          </Box>
        </Stack>
      )}

      <CcEditDialog
        txn={editing}
        onClose={() => setEditing(null)}
        onSave={(patched) => {
          setEditing(null);
          saveEdit.mutate([patched], {
            onSuccess: () => showSuccess("Transaction updated"),
            onError: (err) => showError(describeError(err)),
          });
        }}
      />
    </Box>
  );
}
