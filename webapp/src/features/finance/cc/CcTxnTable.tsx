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
  Box,
  Button,
  Checkbox,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@wso2/oxygen-ui";
import { useAccessToken } from "@hooks/useAccessToken";
import { ccServiceUrls } from "@config/apiConfig";
import { StatusChip, ccStatusMeta } from "../components/FinanceChips";
import { ReceiptViewer } from "../components/ReceiptViewer";
import { money, formatNice } from "../util/financeFormat";
import { fetchBase64Attachment, type ReceiptSource } from "../util/financeReceipts";
import type { CcAttachmentType, CcTransaction } from "./ccTypes";

// Shared read-only / selectable transaction table used by Pending, Approve
// and History. Columns flex on the show* flags.
export function CcTxnTable({
  txns,
  showUser,
  showCard,
  selection,
}: {
  txns: CcTransaction[];
  showUser?: boolean;
  showCard?: boolean;
  selection?: {
    checked: Set<number>;
    onToggle: (id: number) => void;
    isSelectable: (t: CcTransaction) => boolean;
  };
}) {
  const getAccessToken = useAccessToken();
  const [load, setLoad] = useState<(() => Promise<ReceiptSource>) | null>(null);

  const th = {
    fontSize: 11,
    fontWeight: 700,
    color: "text.secondary",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  } as const;

  const view = (id: number, attachmentType: CcAttachmentType) => {
    setLoad(() => async () => {
      const accessToken = await getAccessToken();
      return fetchBase64Attachment(ccServiceUrls.attachment(id, attachmentType), accessToken);
    });
  };

  return (
    <>
    <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1.5, overflow: "hidden" }}>
      <Table size="small">
        <TableHead>
          <TableRow sx={{ "& th": th }}>
            {selection && <TableCell padding="checkbox" />}
            <TableCell>Description</TableCell>
            {showUser && <TableCell>User</TableCell>}
            {showCard && <TableCell>Card</TableCell>}
            <TableCell>Date</TableCell>
            <TableCell align="right">Amount</TableCell>
            <TableCell>Files</TableCell>
            <TableCell>Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {txns.map((t) => {
            const meta = ccStatusMeta(t.status);
            return (
              <TableRow key={t.id} hover selected={selection?.checked.has(t.id)}>
                {selection && (
                  <TableCell padding="checkbox">
                    <Checkbox
                      size="small"
                      checked={selection.checked.has(t.id)}
                      disabled={!selection.isSelectable(t)}
                      onChange={() => selection.onToggle(t.id)}
                    />
                  </TableCell>
                )}
                <TableCell sx={{ fontSize: 12.5 }}>{t.txnDescription}</TableCell>
                {showUser && <TableCell sx={{ fontSize: 12.5 }}>{t.employeeEmail}</TableCell>}
                {showCard && (
                  <TableCell sx={{ fontSize: 12.5, fontFamily: "monospace" }}>•••• {t.ccNumber.slice(-4)}</TableCell>
                )}
                <TableCell sx={{ fontSize: 12.5 }}>{formatNice(t.txnDate)}</TableCell>
                <TableCell align="right" sx={{ fontSize: 12.5, fontVariantNumeric: "tabular-nums" }}>
                  {money(t.txnAmount, "USD")}
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5}>
                    {t.receiptFileName && (
                      <Button size="small" variant="text" onClick={() => view(t.id, "receipt")} sx={{ textTransform: "none", minWidth: 0, px: 0.75 }}>
                        Receipt
                      </Button>
                    )}
                    {t.contractFileName && (
                      <Button size="small" variant="text" onClick={() => view(t.id, "contract")} sx={{ textTransform: "none", minWidth: 0, px: 0.75 }}>
                        Contract
                      </Button>
                    )}
                    {!t.receiptFileName && !t.contractFileName && (
                      <Box component="span" sx={{ fontSize: 12, color: "text.disabled" }}>—</Box>
                    )}
                  </Stack>
                </TableCell>
                <TableCell>
                  <StatusChip label={meta.label} color={meta.color} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Box>
    <ReceiptViewer title="Attachment" load={load} onClose={() => setLoad(null)} />
    </>
  );
}
