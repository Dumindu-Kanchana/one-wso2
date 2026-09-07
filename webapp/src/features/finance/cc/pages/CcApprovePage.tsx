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
import { Alert, Box, Button, MenuItem, Skeleton, Stack, TextField, Typography } from "@wso2/oxygen-ui";
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

type ApproveRole = "lead" | "finance";

// approve-submissions/index.tsx:192-194 capitalises the role for the heading.
const ROLE_TITLE: Record<ApproveRole, string> = { lead: "Lead", finance: "Finance" };

/**
 * Approving is a mode, not a per-row decision.
 *
 * The source derives one `approveRole` from the user's own roles with finance
 * winning (index.tsx:83-87), names it in the heading, and offers a switcher
 * only to someone who holds both (index.tsx:198). The mode decides what the
 * queue contains, so the heading has to say which mode is in force — a merged
 * list under a role-named heading would claim a filter it had not applied.
 *
 * Derived-with-override rather than the source's effect: `approveRole` is null
 * until someone picks, and the default is computed. Same behaviour, without a
 * state write on first render.
 */
export default function CcApprovePage() {
  const userInfo = useCcUserInfo();
  const isFinance = ccHasAccess(userInfo.data, "finance");
  const isLead = ccHasAccess(userInfo.data, "lead");
  const [picked, setPicked] = useState<ApproveRole | null>(null);
  const role: ApproveRole | null =
    picked ?? (isFinance ? "finance" : isLead ? "lead" : null);

  return (
    <FinanceShell
      eyebrow={FINANCE_EYEBROW.cc}
      // No suffix until the roles have loaded — the source renders no heading
      // at all until then, so there is nothing to be faithful to mid-flight.
      title={
        role
          ? `Approve Expense Submissions (${ROLE_TITLE[role]})`
          : "Approve Expense Submissions"
      }
      subtitle="Review and approve card transactions submitted by your team. Leads approve pending-lead items; finance gives the final approval."
      configured={isCcBackendConfigured()}
      configKey="ONE_WSO2_CC_EXPENSES_BACKEND_URL"
    >
      <ApproveBody
        userInfo={userInfo}
        isLead={isLead}
        isFinance={isFinance}
        role={role}
        onPickRole={setPicked}
      />
    </FinanceShell>
  );
}

function ApproveBody({
  userInfo,
  isLead,
  isFinance,
  role,
  onPickRole,
}: {
  userInfo: ReturnType<typeof useCcUserInfo>;
  isLead: boolean;
  isFinance: boolean;
  role: ApproveRole | null;
  onPickRole: (r: ApproveRole) => void;
}) {
  const txns = useCcTransactions();
  const { showSuccess, showError } = useNotifications();
  const [checked, setChecked] = useState<Set<number>>(new Set());

  const email = userInfo.data?.workEmail;
  const [editing, setEditing] = useState<CcTransaction | null>(null);
  const saveEdit = useCcSaveEdit();
  const leadApprove = useCcApprove("lead");
  const financeApprove = useCcApprove("finance");

  const isUserLeadOf = (t: CcTransaction) => {
    const leads = (t.leadEmail ?? "").split(",").map((s) => s.trim());
    return email != null && leads.includes(email);
  };

  // ApproveTransactionsDataGrid.tsx:157-166 — actionable is decided by the mode
  // alone: finance acts on pending_finance, a lead on pending_lead. Nothing is
  // actionable before the mode is known.
  const isSelectable = (t: CcTransaction) =>
    role === "finance"
      ? t.status === "pending_finance"
      : role === "lead"
        ? t.status === "pending_lead"
        : false;

  // index.tsx:116-127 — what the queue contains, per mode. As a lead you see
  // only your own reports' first-stage rows; as finance you see both stages,
  // anyone's, so what is still upstream is visible rather than absent.
  const isVisible = (t: CcTransaction) =>
    role === "finance"
      ? t.status === "pending_lead" || t.status === "pending_finance"
      : role === "lead"
        ? t.status === "pending_lead" && isUserLeadOf(t)
        : false;

  const rows = useMemo(
    () => (txns.data ?? []).filter(isVisible),
    // isVisible closes over role and email
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [txns.data, role, email],
  );

  // One stage per mode, so one endpoint — the source approves as the selected
  // role (handleApproveSelection, ApproveTransactionsDataGrid.tsx:171-180).
  const selected = useMemo(
    () => rows.filter((t) => checked.has(t.id) && isSelectable(t)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, checked, role],
  );
  const selectedIds = selected.map((t) => t.id);
  const selectedCount = selectedIds.length;
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
    if (selectedCount === 0 || !role) return;
    const approve = role === "finance" ? financeApprove : leadApprove;
    approve
      .mutateAsync(selectedIds)
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

  return (
    <Box>
      {/* index.tsx:198-210 — offered only to someone who holds both roles;
          everyone else has one mode and the heading already names it. */}
      {isLead && isFinance && role && (
        <Box sx={{ width: 220, mb: 2 }}>
          <TextField
            select
            size="small"
            fullWidth
            label="Approve Role"
            value={role}
            onChange={(e) => onPickRole(e.target.value as ApproveRole)}
          >
            {/* FilterMenu.tsx:51-60 — the source's own option wording. */}
            <MenuItem value="lead">Approve as Lead</MenuItem>
            <MenuItem value="finance">Approve as Finance</MenuItem>
          </TextField>
        </Box>
      )}

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
