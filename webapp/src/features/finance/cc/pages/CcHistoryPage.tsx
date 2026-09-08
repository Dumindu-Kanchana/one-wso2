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
import {
  Alert,
  Box,
  Button,
  DataGrid,
  FormControl,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  Typography,
} from "@wso2/oxygen-ui";
import { FINANCE_GRID_SX } from "../../util/financeGridSx";
import { isCcBackendConfigured } from "@config/apiConfig";
import FinanceShell from "../../components/FinanceShell";
import { describeError } from "../../util/financeError";
import { bareAmount, daysAgoIso, formatNice } from "../../util/financeFormat";
import { CcTxnDetailsDialog } from "../CcTxnDetailsDialog";
import { CcPickOne as PickOne } from "../CcPickOne";
import { ReceiptViewer } from "../../components/ReceiptViewer";
import { StatusChip, ccStatusMeta } from "../../components/FinanceChips";
import { fetchBase64Attachment, type ReceiptSource } from "../../util/financeReceipts";
import { ccServiceUrls } from "@config/apiConfig";
import { useAccessToken } from "@hooks/useAccessToken";
import { useCcTransactions, useCcUserInfo, useCreditCards } from "../useCc";
import { type CcAttachmentType, type CcTransaction, ccHasAccess, type CcTxnStatus } from "../ccTypes";
import { FINANCE_EYEBROW } from "@constants/financeApps";

// FILTER_ALL in submission-history/index.tsx.
const ALL = "all";

// submission-history/index.tsx uses three distinct placeholders and they are
// not interchangeable: an approver who has not been assigned is a different
// state from a field nobody filled in, and a date that has not happened yet is
// a third. The port had collapsed all of it to "(not provided)".
const NOT_ASSIGNED = "(Not assigned)";   // :281, :289 — approver columns
const NOT_AVAILABLE = "(Not Available)"; // :297 onward — category, units, region
const NO_DATE = "N/A";                   // :348, :357, :366 — the three dates

// :559-571 — ten columns off at the start. `employeeEmail` is not in here: the
// source gates it on the viewer being a lead or finance (:560), so it is set
// per render below.
const HIDDEN_BY_DEFAULT: Record<string, boolean> = {
  financeApproverEmail: false,
  financeApprovedDate: false,
  expenseCategoryLabel: false,
  expenseTypeLabel: false,
  productUnit: false,
  businessUnit: false,
  travelJobNumber: false,
  subRegion: false,
  leadEmail: false,
  leadApprovedDate: false,
};

const PERIODS = [
  { days: 7, label: "Last 7 days" },
  { days: 30, label: "Last 30 days" },
  { days: 90, label: "Last 90 days" },
  { days: 365, label: "Last year" },
];

const STATUSES: { value: CcTxnStatus | "all"; label: string }[] = [
  { value: "submitted", label: "Submitted" },
  { value: "pending_lead", label: "Pending Lead" },
  { value: "pending_finance", label: "Pending Finance" },
  { value: "new", label: "New" },
  { value: "all", label: "All statuses" },
];

export default function CcHistoryPage() {
  return (
    <FinanceShell
      eyebrow={FINANCE_EYEBROW.cc}
      title="Expense Submissions History"
      subtitle="Your past card submissions, filterable by status and period."
      configured={isCcBackendConfigured()}
      configKey="ONE_WSO2_CC_EXPENSES_BACKEND_URL"
    >
      <HistoryBody />
    </FinanceShell>
  );
}

function HistoryBody() {
  const userInfo = useCcUserInfo();
  // submission-history/index.tsx:73 opens on 7 days.
  const [days, setDays] = useState(7);
  const [status, setStatus] = useState<CcTxnStatus | "all">("submitted");
  // submission-history/index.tsx:74-76 — a lead or finance also narrows by
  // person, by card and by lead. Without them the only way to find one
  // person's spend is to read the whole table.
  const [user, setUser] = useState(ALL);
  const [card, setCard] = useState(ALL);
  const [lead, setLead] = useState(ALL);
  const [selected, setSelected] = useState<CcTransaction | null>(null);

  const txns = useCcTransactions({ dateFrom: daysAgoIso(days), includeInactive: true });
  const email = userInfo.data?.workEmail;
  const canSeeOthers = ccHasAccess(userInfo.data, "lead") || ccHasAccess(userInfo.data, "finance");

  const all = useMemo(() => txns.data ?? [], [txns.data]);

  // :98-113 — the option lists come from what is actually on screen, so they
  // never offer a person or card with nothing to show.
  const users = useMemo(
    () => [...new Set(all.map((t) => t.employeeEmail))].sort(),
    [all],
  );
  const cards = useMemo(() => [...new Set(all.map((t) => t.ccNumber))].sort(), [all]);
  const leads = useMemo(
    () =>
      [...new Set(all.flatMap((t) => (t.leadEmail ?? "").split(",").map((l) => l.trim())))]
        .filter(Boolean)
        .sort(),
    [all],
  );

  const getAccessToken = useAccessToken();
  // A loader, not a loaded source: ReceiptViewer fetches when it opens, and
  // setState needs the extra arrow or it would treat the thunk as an updater.
  const [load, setLoad] = useState<(() => Promise<ReceiptSource>) | null>(null);
  // Cards including closed ones, so a transaction on a closed card can say so.
  const cards_all = useCreditCards(true);
  const cardStatus = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of cards_all.data ?? []) m.set(c.ccNumber, c.status ?? "");
    return m;
  }, [cards_all.data]);

  const columns = useMemo<DataGrid.GridColDef<CcTransaction>[]>(() => {
    // A loader, not a loaded source: ReceiptViewer fetches when it opens, and
    // setState needs the extra arrow or it would treat the thunk as an updater.
    const view = (id: number, attachmentType: CcAttachmentType) => {
      setLoad(() => async () =>
        fetchBase64Attachment(ccServiceUrls.attachment(id, attachmentType), await getAccessToken()),
      );
    };
    const dateCol = (field: string, headerName: string): DataGrid.GridColDef<CcTransaction> => ({
      field,
      headerName,
      flex: 0.05,
      align: "center",
      headerAlign: "center",
      minWidth: 130,
      // :348 — a date that has not happened reads N/A, not blank.
      renderCell: (p) => (p.value ? formatNice(p.value as string) : NO_DATE),
    });
    const orNotAvailable = (field: string, headerName: string): DataGrid.GridColDef<CcTransaction> => ({
      field,
      headerName,
      flex: 0.05,
      minWidth: 130,
      renderCell: (p) => (p.value as string | null) ?? NOT_AVAILABLE,
    });

    return [
      { field: "id", headerName: "ID", flex: 0.05, minWidth: 70 },
      // :231 — not sortable in the source either.
      { field: "reportSequenceNumber", headerName: "NetSuite Report No.", flex: 0.1, minWidth: 150, sortable: false },
      { field: "txnDescription", headerName: "Description", flex: 0.1, minWidth: 180 },
      dateCol("txnDate", "Date"),
      {
        field: "txnAmount",
        headerName: "Amount($)",
        type: "number",
        flex: 0.05,
        minWidth: 110,
        // Bare, because the header says ($) — as the source does.
        renderCell: (p) => bareAmount(p.value as number),
      },
      {
        field: "ccNumber",
        headerName: "CC Number",
        flex: 0.05,
        minWidth: 130,
        align: "center",
        headerAlign: "center",
        // :262-269 — a transaction on a closed card says so on the row. The
        // port only marked it in the card picker, so history gave no sign.
        renderCell: (p) => {
          const status = cardStatus.get(p.value as string);
          return `${p.value}${status && status !== "Active" ? " (Inactive)" : ""}`;
        },
      },
      { field: "employeeEmail", headerName: "Submitted User", flex: 0.05, minWidth: 180 },
      {
        field: "leadEmail",
        headerName: "Lead Approver",
        flex: 0.05,
        minWidth: 180,
        renderCell: (p) => (p.value as string | null) ?? NOT_ASSIGNED,
      },
      {
        field: "financeApproverEmail",
        headerName: "Finance Approver",
        flex: 0.05,
        minWidth: 180,
        renderCell: (p) => (p.value as string | null) ?? NOT_ASSIGNED,
      },
      orNotAvailable("expenseCategoryLabel", "Expense Category"),
      orNotAvailable("expenseTypeLabel", "Expense Type"),
      orNotAvailable("productUnit", "Product Unit"),
      orNotAvailable("businessUnit", "Business Unit"),
      orNotAvailable("travelJobNumber", "Job Number"),
      orNotAvailable("subRegion", "Sub Region"),
      dateCol("empPostedDate", "Submitted Date"),
      dateCol("leadApprovedDate", "Lead Approved Date"),
      dateCol("financeApprovedDate", "Finance Approved Date"),
      {
        field: "attachments",
        headerName: "Attachments",
        width: 150,
        align: "center",
        headerAlign: "center",
        sortable: false,
        filterable: false,
        renderCell: (p) => {
          const t = p.row;
          if (!t.receiptFileName && !t.contractFileName) {
            return <Box component="span" sx={{ color: "text.disabled" }}>—</Box>;
          }
          return (
            <Stack direction="row" spacing={0.5} justifyContent="center">
              {t.receiptFileName && (
                <Button size="small" variant="text" onClick={() => view(t.id, "receipt")} sx={{ textTransform: "none", minWidth: 0, px: 0.5 }}>
                  Receipt
                </Button>
              )}
              {t.contractFileName && (
                <Button size="small" variant="text" onClick={() => view(t.id, "contract")} sx={{ textTransform: "none", minWidth: 0, px: 0.5 }}>
                  Contract
                </Button>
              )}
            </Stack>
          );
        },
      },
      {
        field: "status",
        headerName: "Status",
        flex: 0.05,
        minWidth: 140,
        align: "center",
        headerAlign: "center",
        renderCell: (p) => {
          const meta = ccStatusMeta(p.row.status);
          return <StatusChip label={meta.label} color={meta.color} />;
        },
      },
      {
        // :410 — the source's own details column, which is what the dialog is.
        field: "details",
        headerName: "View Details",
        flex: 0.05,
        minWidth: 120,
        sortable: false,
        filterable: false,
        renderCell: (p) => (
          <Button size="small" variant="text" onClick={() => setSelected(p.row)} sx={{ textTransform: "none", fontWeight: 600 }}>
            Details
          </Button>
        ),
      },
    ];
  }, [cardStatus, getAccessToken]);

  const rows = useMemo(() => {
    let list = all;
    if (!canSeeOthers) list = list.filter((t) => t.employeeEmail === email);
    if (status !== "all") list = list.filter((t) => t.status === status);
    if (user !== ALL) list = list.filter((t) => t.employeeEmail === user);
    if (card !== ALL) list = list.filter((t) => t.ccNumber === card);
    // :152 — a card can carry several leads, so match within the list.
    if (lead !== ALL)
      list = list.filter((t) =>
        (t.leadEmail ?? "").split(",").map((l) => l.trim()).includes(lead),
      );
    return list;
  }, [all, status, canSeeOthers, email, user, card, lead]);

  return (
    <Box>
      <Stack direction="row" spacing={1.5} sx={{ mb: 2, flexWrap: "wrap" }}>
        <FormControl size="small">
          <Select value={days} onChange={(e) => setDays(Number(e.target.value))} sx={{ minWidth: 150 }}>
            {PERIODS.map((p) => (
              <MenuItem key={p.days} value={p.days}>
                {p.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small">
          <Select value={status} onChange={(e) => setStatus(e.target.value as CcTxnStatus | "all")} sx={{ minWidth: 170 }}>
            {STATUSES.map((s) => (
              <MenuItem key={s.value} value={s.value}>
                {s.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* :175-178,218-249 — offered only to someone who can see other
            people's spend; for everyone else the list is already their own. */}
        {canSeeOthers && (
          <>
            <PickOne label="User" value={user} onChange={setUser} options={users} />
            <PickOne label="Card" value={card} onChange={setCard} options={cards} />
            <PickOne label="Lead" value={lead} onChange={setLead} options={leads} />
          </>
        )}
      </Stack>

      {userInfo.isLoading || txns.isLoading ? (
        <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 1.5 }} />
      ) : userInfo.isError || txns.isError ? (
        <Alert severity="error">Couldn't load history. {describeError(userInfo.error ?? txns.error)}</Alert>
      ) : rows.length === 0 ? (
        <Typography sx={{ fontSize: 13, color: "text.secondary", py: 3 }}>
          No transactions match this filter.
        </Typography>
      ) : (
        <Box sx={{ height: 620, width: "100%" }}>
          {/*
            The source's own grid, column for column (submission-history
            /index.tsx:221-415). It defines twenty-one and hides ten by
            default (:557-572), so the reader opens on a short table and
            reaches the rest through the column picker.

            `showToolbar` is v8's one-prop toolbar: column picker, filter
            panel, density, CSV and print export, and a quick-filter search
            box. The source assembles the same set by hand from the v6-era
            GridToolbar* components; those still ship, but the composed
            toolbar is what this version of the grid wants.
          */}
          <DataGrid.DataGrid
            rows={rows}
            columns={columns}
            showToolbar
            density="compact"
            disableRowSelectionOnClick
            initialState={{
              columns: {
                // :560 — Submitted User only for someone who can see other
                // people's spend. For everyone else the list is their own
                // already, so the column would repeat the same address on
                // every row.
                columnVisibilityModel: { ...HIDDEN_BY_DEFAULT, employeeEmail: canSeeOthers },
              },
              pagination: { paginationModel: { pageSize: 20, page: 0 } },
            }}
            pageSizeOptions={[5, 10, 20, 25, 50]}
            sx={FINANCE_GRID_SX}
          />
        </Box>
      )}

      <CcTxnDetailsDialog txn={selected} onClose={() => setSelected(null)} />
      <ReceiptViewer title="Attachment" load={load} onClose={() => setLoad(null)} />
    </Box>
  );
}

/** One "All / …" narrowing select, built from what is on screen. */

