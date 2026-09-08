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
  Box,
  Button,
  Card,
  FormControl,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  Tab,
  DataGrid,
  Tabs,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { FINANCE_GRID_SX } from "../../util/financeGridSx";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { isCcBackendConfigured } from "@config/apiConfig";
import FinanceShell from "../../components/FinanceShell";
import { describeError } from "../../util/financeError";
import { CC_SNACK } from "../ccCopy";
import { CcStatementDropZone } from "../CcStatementDropZone";

// StatementDataGrid.tsx:43 — the source writes N/A here, not a dash.
const NOT_AVAILABLE = "N/A";
import { money, formatNice } from "../../util/financeFormat";
import { useCcProcessStatement, useCcUploadTransactions } from "../useCcMutations";
import { useCcUserInfo } from "../useCc";
import { ccHasAccess, type CcBankCode, type CcNewTransaction, type CcTransactionUploadGroup } from "../ccTypes";
import { FINANCE_EYEBROW } from "@constants/financeApps";

export default function CcSettingsPage() {
  return (
    <FinanceShell
      eyebrow={FINANCE_EYEBROW.cc}
      title="Bank Statement Upload"
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
  // The file as chosen, so the zone can show its name and size.
  const [chosen, setChosen] = useState<File | null>(null);

  const isFinance = ccHasAccess(userInfo.data, "finance");

  if (userInfo.isLoading) {
    return <Skeleton variant="rectangular" height={160} sx={{ borderRadius: 1.5 }} />;
  }
  if (!isFinance) {
    return <Alert severity="info">Statement ingestion is limited to finance approvers.</Alert>;
  }

  // The drop zone has already checked the extension and shown its own
  // message if it was wrong, so by here the file is a CSV.
  const handlePicked = (file: File) => {
    setChosen(file);
    const bankCode = bank;
    const fileName = file.name;
    process.mutate(
      { bankCode, fileName, file },
      {
        onSuccess: (g) => {
          showSuccess(CC_SNACK.success.processBankStatement);
          setParsed({ group: g, bankCode, fileName });
          setTab("new");
        },
        onError: (err) => showError(describeError(err)),
      },
    );
  };

  const handleSave = () => {
    if (!parsed) return;
    upload.mutate(
      { bankCode: parsed.bankCode, fileName: parsed.fileName, group: parsed.group },
      {
        onSuccess: () => {
          showSuccess(CC_SNACK.success.uploadNewTransactions);
          setParsed(null);
          // And the file itself, or the drop zone keeps showing a statement
          // that has already been saved as though it were still waiting.
          setChosen(null);
        },
        onError: (err) => showError(describeError(err)),
      },
    );
  };

  // StatementDataGrid.tsx:38-67, in its order and its wording. Lead Email is
  // the column that says who each row will go to for approval.
  const statementColumns: DataGrid.GridColDef<CcNewTransaction>[] = [
    { field: "txnReferenceNo", headerName: "Reference No", flex: 1, minWidth: 130 },
    {
      field: "employeeEmail",
      headerName: "Card Owner",
      flex: 1,
      minWidth: 180,
      renderCell: (p) => (p.value as string) || NOT_AVAILABLE,
    },
    { field: "ccNumber", headerName: "Card Number", flex: 1, minWidth: 130 },
    {
      field: "leadEmail",
      headerName: "Lead Email",
      flex: 1.5,
      minWidth: 200,
      renderCell: (p) => (p.value as string) || NOT_AVAILABLE,
    },
    {
      field: "txnDate",
      headerName: "Transaction Date",
      flex: 1,
      minWidth: 150,
      renderCell: (p) => formatNice(p.value as string),
    },
    { field: "txnDescription", headerName: "Description", flex: 1.5, minWidth: 180 },
    {
      field: "txnAmount",
      headerName: "Amount",
      flex: 0.8,
      minWidth: 110,
      type: "number",
      // Not bare here: the source's header is "Amount" with no currency, and
      // a statement row carries its own txnCurrency.
      renderCell: (p) => money(p.value as number, p.row.txnCurrency),
    },
  ];

  const tabRows: Record<typeof tab, CcNewTransaction[]> = {
    new: group?.newItems ?? [],
    duplicate: group?.duplicateItems ?? [],
    invalid: group?.invalidItems ?? [],
  };

  return (
    <Box>
      <Card variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
            <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>Select a Bank</Typography>
            <FormControl size="small">
              <Select
                value={bank}
                inputProps={{ "aria-label": "Select a Bank" }}
                onChange={(e) => setBank(e.target.value as CcBankCode)}
                sx={{ minWidth: 120 }}
              >
                <MenuItem value="svb">SVB</MenuItem>
                <MenuItem value="amex">Amex</MenuItem>
              </Select>
            </FormControl>
          </Stack>
          {/* FileUpload.tsx — the source drops a file here, or clicks. */}
          <CcStatementDropZone
            file={chosen}
            disabled={process.isPending}
            onPick={handlePicked}
            onClear={() => {
              setChosen(null);
              setParsed(null);
            }}
          />
          {process.isPending && (
            <Typography sx={{ fontSize: 12, color: "text.secondary" }}>Parsing…</Typography>
          )}
        </Stack>
      </Card>

      {process.isError && <Alert severity="error" sx={{ mb: 2 }}>{describeError(process.error)}</Alert>}

      {/* index.tsx:232-236 — say what to do before anything is uploaded,
          rather than showing an empty frame. */}
      {!group && !process.isPending && (
        <Box sx={{ textAlign: "center", py: 6 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 600 }}>Upload a bank statement</Typography>
          <Typography sx={{ fontSize: 13, color: "text.secondary", mt: 0.5 }}>
            Upload a statement to view transactions
          </Typography>
        </Box>
      )}

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
            <Box sx={{ height: 460, width: "100%" }}>
              {/* StatementDataGrid.tsx:70-95 — on the grid, with the all-in-one
                  toolbar it uses: columns, filters, density, quick filter and
                  export. Export is right here where it is withheld on the
                  transaction grids — this is finance reconciling a statement they
                  uploaded themselves, and the source offers it. */}
              <DataGrid.DataGrid
                rows={tabRows[tab]}
                columns={statementColumns}
                getRowId={(r) => r.txnReferenceNo}
                showToolbar
                density="compact"
                disableRowSelectionOnClick
                initialState={{ pagination: { paginationModel: { pageSize: 10, page: 0 } } }}
                pageSizeOptions={[10, 25, 50, 100]}
                sx={FINANCE_GRID_SX}
              />
            </Box>
          )}

          <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, mt: 2 }}>
            <Button onClick={() => setParsed(null)} disabled={upload.isPending}>
              Discard
            </Button>
            {/* index.tsx:151-160 — a disabled Save says why it is disabled. */}
            <Tooltip title={group.newItems.length === 0 ? "No new items to save" : ""}>
              <span>
                <Button
                  variant="contained"
                  onClick={handleSave}
                  disabled={group.newItems.length === 0 || upload.isPending}
                  sx={{ fontWeight: 600 }}
                >
                  {upload.isPending ? "Saving…" : `Save ${group.newItems.length} new`}
                </Button>
              </span>
            </Tooltip>
          </Box>
        </Box>
      )}
    </Box>
  );
}
