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

import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { useAsgardeo } from "@asgardeo/react";
import { expenseServiceUrls } from "@config/apiConfig";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { StatusChip, expenseStatusMeta } from "../components/FinanceChips";
import { ReceiptViewer } from "../components/ReceiptViewer";
import { describeError } from "../util/financeError";
import { money, formatNice } from "../util/financeFormat";
import { fetchReceiptObjectUrl, type ReceiptSource } from "../util/financeReceipts";
import { useExpenseClaimStatus } from "./useExpenseMutations";
import { nextStatus, type ApproverView, type ExpenseClaim } from "./expenseTypes";

// Expense claim detail slide-over — read-only for History, or with
// stage-appropriate Approve/Reject for Lead / Finance approvals.
export function ExpenseClaimDetailsDialog({
  claim,
  onClose,
  review,
}: {
  claim: ExpenseClaim | null;
  onClose: () => void;
  review?: ApproverView;
}) {
  const { getAccessToken } = useAsgardeo();
  const { showError, showSuccess } = useNotifications();
  const status = useExpenseClaimStatus();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [receiptLoad, setReceiptLoad] = useState<(() => Promise<ReceiptSource>) | null>(null);

  // Reset transient state when the target claim changes — the dialog stays
  // mounted, so a typed reason / open reject panel would otherwise carry
  // over into the next claim.
  const claimId = claim?.id;
  useEffect(() => {
    setRejecting(false);
    setReason("");
    setReceiptLoad(null);
  }, [claimId]);

  const meta = expenseStatusMeta(claim?.statusDetails.status);
  const pendingForView =
    review === "LEAD"
      ? claim?.statusDetails.status === "PENDING_LEAD"
      : review === "FINANCE"
        ? claim?.statusDetails.status === "PENDING_FINANCE"
        : false;

  const openReceipt = (fileName: string) => {
    setReceiptLoad(() => async () => {
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error("No access_token available from Asgardeo");
      return fetchReceiptObjectUrl(expenseServiceUrls.receiptFile(fileName), accessToken);
    });
  };

  const decide = (decision: "approve" | "reject") => {
    if (!claim || !review) return;
    status.mutate(
      {
        claimId: claim.id,
        body: {
          status: nextStatus(review, decision),
          reason: decision === "reject" ? reason.trim() : undefined,
        },
      },
      {
        onSuccess: () => {
          showSuccess(decision === "approve" ? "Claim approved" : "Claim rejected");
          setRejecting(false);
          setReason("");
          onClose();
        },
        onError: (err) => showError(describeError(err)),
      },
    );
  };

  const cur = claim?.currencyCode ?? "LKR";

  return (
    <>
    <Dialog open={!!claim} onClose={status.isPending ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontSize: 17, fontWeight: 700, display: "flex", alignItems: "center", gap: 1 }}>
        <span>Claim {claim?.id}</span>
        <StatusChip label={meta.label} color={meta.color} />
      </DialogTitle>
      <DialogContent dividers>
        {claim && (
          <Stack spacing={1.5}>
            <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
              <Meta label="Employee" value={claim.employeeEmail} />
              <Meta label="Submitted" value={formatNice(claim.createdDate)} />
              <Meta label="Total" value={money(claim.totalAmount, cur)} />
            </Box>
            {claim.statusDetails.leadRejectedReason && (
              <Typography sx={{ fontSize: 12.5, color: "error.main" }}>
                Lead rejection: {claim.statusDetails.leadRejectedReason}
              </Typography>
            )}
            <Divider />
            <Stack spacing={1}>
              {claim.transactions.map((t, i) => (
                <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 600 }} noWrap>
                      {t.expenseType || t.comment || "Expense"}
                    </Typography>
                    <Typography sx={{ fontSize: 11.5, color: "text.secondary" }} noWrap>
                      {formatNice(t.date)}
                      {t.travelJobNumber ? ` · ${t.travelJobNumber}` : ""}
                      {t.comment ? ` · ${t.comment}` : ""}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: "right" }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                      {money(t.reimbursementAmount, t.reimbursementCurrency)}
                    </Typography>
                    {t.currency !== t.reimbursementCurrency && (
                      <Typography sx={{ fontSize: 11, color: "text.disabled" }}>
                        {money(t.amount, t.currency)}
                      </Typography>
                    )}
                  </Box>
                  {t.receiptUrl && (
                    <Button size="small" variant="text" onClick={() => openReceipt(t.receiptUrl!)} sx={{ textTransform: "none" }}>
                      Receipt
                    </Button>
                  )}
                </Box>
              ))}
            </Stack>

            {pendingForView && rejecting && (
              <TextField
                size="small"
                fullWidth
                multiline
                minRows={2}
                autoFocus
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason for rejection…"
                sx={{ mt: 1 }}
              />
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        {pendingForView ? (
          rejecting ? (
            <>
              <Button size="small" onClick={() => setRejecting(false)} disabled={status.isPending}>
                Back
              </Button>
              <Button
                size="small"
                color="error"
                variant="contained"
                disabled={status.isPending || reason.trim().length === 0}
                onClick={() => decide("reject")}
              >
                {status.isPending ? "Rejecting…" : "Confirm reject"}
              </Button>
            </>
          ) : (
            <>
              <Button size="small" onClick={onClose} disabled={status.isPending}>
                Close
              </Button>
              <Button size="small" color="error" onClick={() => setRejecting(true)} disabled={status.isPending}>
                Reject
              </Button>
              <Button size="small" color="success" variant="contained" onClick={() => decide("approve")} disabled={status.isPending}>
                {status.isPending ? "Approving…" : "Approve"}
              </Button>
            </>
          )
        ) : (
          <Button size="small" onClick={onClose}>
            Close
          </Button>
        )}
      </DialogActions>
    </Dialog>
    <ReceiptViewer load={receiptLoad} onClose={() => setReceiptLoad(null)} />
    </>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography sx={{ fontSize: 10, color: "text.disabled", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{value}</Typography>
    </Box>
  );
}
