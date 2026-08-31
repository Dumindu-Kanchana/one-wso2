/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Typography,
} from "@wso2/oxygen-ui";
import { useAccessToken } from "@hooks/useAccessToken";
import { ccServiceUrls } from "@config/apiConfig";
import { StatusChip, ccStatusMeta } from "../components/FinanceChips";
import { ReceiptViewer } from "../components/ReceiptViewer";
import { fetchReceiptObjectUrl, type ReceiptSource } from "../util/financeReceipts";
import { money, formatNice } from "../util/financeFormat";
import type { CcAttachmentType, CcTransaction } from "./ccTypes";

// What a submitted transaction became — ported from
// view/submission-history/components/TransactionDetailsDialog.tsx.
//
// The port already carried leadApprovedDate, financeApprovedDate,
// financeApproverEmail and reportSequenceNumber on its DTO and rendered none of
// them, so there was no way to see who approved a transaction or when.
export function CcTxnDetailsDialog({
  txn,
  onClose,
}: {
  txn: CcTransaction | null;
  onClose: () => void;
}) {
  const getAccessToken = useAccessToken();
  const [load, setLoad] = useState<(() => Promise<ReceiptSource>) | null>(null);

  if (!txn) return null;
  const meta = ccStatusMeta(txn.status);

  const view = (attachmentType: CcAttachmentType) =>
    setLoad(() => async () =>
      fetchReceiptObjectUrl(ccServiceUrls.attachment(txn.id, attachmentType), await getAccessToken()),
    );

  return (
    <>
      <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontSize: 17, fontWeight: 700 }}>
          {txn.txnDescription}
          <Typography sx={{ fontSize: 12.5, color: "text.secondary", fontWeight: 400 }}>
            {formatNice(txn.txnDate)} · {money(txn.txnAmount, "USD")} · •••• {txn.ccNumber.slice(-4)}
          </Typography>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.5}>
            <Box>
              <StatusChip label={meta.label} color={meta.color} />
            </Box>

            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.25 }}>
              <Detail label="Submitted User" value={txn.employeeEmail} />
              <Detail label="Expense Category" value={txn.expenseCategoryLabel} />
              <Detail label="Expense Type" value={txn.expenseTypeLabel} />
              <Detail label="Job Number" value={txn.travelJobNumber} />
              <Detail label="Product Unit" value={txn.productUnit} />
              <Detail label="Business Unit" value={txn.businessUnit} />
              <Detail label="Sub Region" value={txn.subRegion} />
              <Detail label="Comment" value={txn.txnComment} />
            </Box>

            <Divider />

            {/* :265-340 — who has it been past, and when. */}
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.25 }}>
              <Detail label="Submitted Date" value={dateOrDash(txn.empPostedDate)} />
              <Detail label="Lead approver" value={txn.leadEmail} />
              <Detail label="Lead Approved Date" value={dateOrDash(txn.leadApprovedDate)} />
              <Detail label="Finance approver" value={txn.financeApproverEmail} />
              <Detail label="Finance Approved Date" value={dateOrDash(txn.financeApprovedDate)} />
            </Box>

            {(txn.receiptFileName || txn.contractFileName) && (
              <>
                <Divider />
                <Stack direction="row" spacing={1}>
                  {txn.receiptFileName && (
                    <Button size="small" variant="outlined" onClick={() => view("receipt")} sx={{ textTransform: "none" }}>
                      Receipt
                    </Button>
                  )}
                  {txn.contractFileName && (
                    <Button size="small" variant="outlined" onClick={() => view("contract")} sx={{ textTransform: "none" }}>
                      Contract
                    </Button>
                  )}
                </Stack>
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button size="small" onClick={onClose}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
      <ReceiptViewer title="Attachment" load={load} onClose={() => setLoad(null)} />
    </>
  );
}

const dateOrDash = (d: string | null) => (d ? formatNice(d) : null);

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <Box>
      <Typography sx={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em", color: "text.disabled", fontWeight: 600 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 12.5 }}>{value || "—"}</Typography>
    </Box>
  );
}
