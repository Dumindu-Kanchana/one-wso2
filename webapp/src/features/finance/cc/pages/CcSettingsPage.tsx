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

import { useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  FormControl,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  Typography,
} from "@wso2/oxygen-ui";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { isCcBackendConfigured } from "@config/apiConfig";
import FinanceShell from "../../components/FinanceShell";
import { describeError } from "../../util/financeError";
import { money, formatNice } from "../../util/financeFormat";
import { useCcProcessStatement, useCcUploadTransactions } from "../useCcMutations";
import { useCcUserInfo } from "../useCc";
import { ccHasAccess, type CcBankCode, type CcNewTransaction, type CcTransactionUploadGroup } from "../ccTypes";
import { FINANCE_EYEBROW } from "@constants/financeApps";

export default function CcSettingsPage() {
  return (
    <FinanceShell
      eyebrow={FINANCE_EYEBROW.cc}
      title="Statement ingestion"
      subtitle="Finance-only. Upload a bank statement CSV; the system parses it into new, duplicate and invalid transactions for review, then saves the new ones as pending submissions."
      configured={isCcBackendConfigured()}
      configKey="ONE_WSO2_CC_EXPENSES_BACKEND_URL"
    >
      <SettingsBody />
    </FinanceShell>
  );
}

function SettingsBody() {
  const userInfo = useCcUserInfo();
  const process = useCcProcessStatement();
  const upload = useCcUploadTransactions();
  const { showSuccess, showError } = useNotifications();

  const [bank, setBank] = useState<CcBankCode>("svb");
  // The bank code + file name are captured at parse time and kept WITH the
  // parsed group, so changing the bank Select afterwards can't make Save
  // post the group under a different bankCode than it was parsed with.
  const [parsed, setParsed] = useState<
    { group: CcTransactionUploadGroup; bankCode: CcBankCode; fileName: string } | null
  >(null);
  const group = parsed?.group ?? null;
  const [tab, setTab] = useState<"new" | "duplicate" | "invalid">("new");
  const fileInput = useRef<HTMLInputElement>(null);

  const isFinance = ccHasAccess(userInfo.data, "finance");

  if (userInfo.isLoading) {
    return <Skeleton variant="rectangular" height={160} sx={{ borderRadius: 1.5 }} />;
  }
  if (!isFinance) {
    return <Alert severity="info">Statement ingestion is limited to finance approvers.</Alert>;
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const bankCode = bank;
    const fileName = file.name;
    process.mutate(
      { bankCode, fileName, file },
      {
        onSuccess: (g) => {
          setParsed({ group: g, bankCode, fileName });
          setTab("new");
        },
        onError: (err) => showError(describeError(err)),
      },
    );
    if (fileInput.current) fileInput.current.value = "";
  };

  const handleSave = () => {
    if (!parsed) return;
    upload.mutate(
      { bankCode: parsed.bankCode, fileName: parsed.fileName, group: parsed.group },
      {
        onSuccess: () => {
          showSuccess(`${parsed.group.newItems.length} transaction(s) saved as pending`);
          setParsed(null);
        },
        onError: (err) => showError(describeError(err)),
      },
    );
  };

  const tabRows: Record<typeof tab, CcNewTransaction[]> = {
    new: group?.newItems ?? [],
    duplicate: group?.duplicateItems ?? [],
    invalid: group?.invalidItems ?? [],
  };

  return (
    <Box>
      <Card variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
          <FormControl size="small">
            <Select value={bank} onChange={(e) => setBank(e.target.value as CcBankCode)} sx={{ minWidth: 120 }}>
              <MenuItem value="svb">SVB</MenuItem>
              <MenuItem value="amex">Amex</MenuItem>
            </Select>
          </FormControl>
          <input ref={fileInput} type="file" accept=".csv,text/csv" onChange={handleFile} style={{ display: "none" }} />
          <Button
            variant="outlined"
            onClick={() => fileInput.current?.click()}
            disabled={process.isPending}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            {process.isPending ? "Parsing…" : "Upload statement CSV"}
          </Button>
          <Typography sx={{ fontSize: 12, color: "text.disabled" }}>
            {parsed ? parsed.fileName : "Select a bank, then choose the statement file."}
          </Typography>
        </Stack>
      </Card>

      {process.isError && <Alert severity="error" sx={{ mb: 2 }}>{describeError(process.error)}</Alert>}

      {group && (
        <Box>
          <Tabs
            value={tab}
            onChange={(_e, v) => setTab(v as typeof tab)}
            sx={{ mb: 2, minHeight: 36, "& .MuiTab-root": { minHeight: 36, textTransform: "none", fontSize: 13, fontWeight: 600 } }}
          >
            <Tab value="new" label={`New (${group.newItems.length})`} />
            <Tab value="duplicate" label={`Duplicate (${group.duplicateItems.length})`} />
            <Tab value="invalid" label={`Invalid (${group.invalidItems.length})`} />
          </Tabs>

          {tabRows[tab].length === 0 ? (
            <Typography sx={{ fontSize: 13, color: "text.secondary", py: 3 }}>None in this group.</Typography>
          ) : (
            <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1.5, overflow: "hidden" }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ "& th": { fontSize: 11, fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.04em" } }}>
                    <TableCell>Reference</TableCell>
                    <TableCell>Card</TableCell>
                    <TableCell>Owner</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell align="right">Amount</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tabRows[tab].map((t) => (
                    <TableRow key={t.txnReferenceNo} hover>
                      <TableCell sx={{ fontSize: 12, fontFamily: "monospace" }}>{t.txnReferenceNo}</TableCell>
                      <TableCell sx={{ fontSize: 12.5, fontFamily: "monospace" }}>•••• {t.ccNumber.slice(-4)}</TableCell>
                      <TableCell sx={{ fontSize: 12.5 }}>{t.employeeEmail || "—"}</TableCell>
                      <TableCell sx={{ fontSize: 12.5 }}>{formatNice(t.txnDate)}</TableCell>
                      <TableCell sx={{ fontSize: 12.5 }}>{t.txnDescription}</TableCell>
                      <TableCell align="right" sx={{ fontSize: 12.5, fontVariantNumeric: "tabular-nums" }}>
                        {money(t.txnAmount, t.txnCurrency)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}

          <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, mt: 2 }}>
            <Button onClick={() => setParsed(null)} disabled={upload.isPending}>
              Discard
            </Button>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={group.newItems.length === 0 || upload.isPending}
              sx={{ fontWeight: 600 }}
            >
              {upload.isPending ? "Saving…" : `Save ${group.newItems.length} new`}
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
}
