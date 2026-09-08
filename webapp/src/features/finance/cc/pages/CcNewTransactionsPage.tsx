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
  Skeleton,
  Typography,
} from "@wso2/oxygen-ui";
import { FINANCE_GRID_SX } from "../../util/financeGridSx";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { isCcBackendConfigured } from "@config/apiConfig";
import FinanceShell from "../../components/FinanceShell";
import { describeError } from "../../util/financeError";
import { bareAmount, formatNice } from "../../util/financeFormat";
import { CardMenu } from "../components/CardMenu";
import { CcEditDialog } from "../CcEditDialog";
import { ToolbarNoExport as NewTxnToolbar } from "../ccGridToolbar";
import { CC_SNACK } from "../ccCopy";
import { useCcCardLabel, useCcEmployeeSubmit, useCcSaveDraft } from "../useCcMutations";
import { useDraftAutosave } from "../../util/useDraftAutosave";
import { DraftStatusChip } from "../../components/DraftStatusChip";
import { useCcTransactions, useCcUserInfo, useCreditCards } from "../useCc";
import { ccTxnComplete, type CcTransaction } from "../ccTypes";
import { FINANCE_EYEBROW } from "@constants/financeApps";

export default function CcNewTransactionsPage() {
  return (
    <FinanceShell
      eyebrow={FINANCE_EYEBROW.cc}
      title="Pending Submissions"
      subtitle="Categorise your unsubmitted card transactions — expense type, comment and the unit or job number — then submit the completed ones for lead approval."
      configured={isCcBackendConfigured()}
      configKey="ONE_WSO2_CC_EXPENSES_BACKEND_URL"
    >
      <NewTxnBody />
    </FinanceShell>
  );
}

function NewTxnBody() {
  const userInfo = useCcUserInfo();
  const cards = useCreditCards();
  const txns = useCcTransactions();
  const submit = useCcEmployeeSubmit();
  const renameCard = useCcCardLabel();
  const { showSuccess, showError } = useNotifications();

  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [editing, setEditing] = useState<CcTransaction | null>(null);
  // Client-side categorisation overlay, keyed by txn id, applied until submit.
  const [edits, setEdits] = useState<Record<number, CcTransaction>>({});
  const [checked, setChecked] = useState<Set<number>>(new Set());

  const email = userInfo.data?.workEmail;
  const ownCards = useMemo(
    () => (cards.data ?? []).filter((c) => c.employeeEmail === email),
    [cards.data, email],
  );
  const activeCard = selectedCard ?? ownCards[0]?.ccNumber ?? null;

  // `new` transactions on the active card, with any local edits applied.
  const rows = useMemo(() => {
    const base = (txns.data ?? []).filter(
      (t) => t.status === "new" && (!activeCard || t.ccNumber === activeCard),
    );
    return base.map((t) => edits[t.id] ?? t);
  }, [txns.data, activeCard, edits]);

  const completeChecked = rows.filter((t) => checked.has(t.id) && ccTxnComplete(t));

  // NewTransactionsDataGrid.tsx:105-139. Its last column is a bare green tick
  // when the required fields are filled; this one names the categorisation
  // instead, which says the same thing and also what was chosen.
  const columns = useMemo<DataGrid.GridColDef<CcTransaction>[]>(
    () => [
      { field: "id", headerName: "ID", width: 80 },
      { field: "txnDescription", headerName: "Description", flex: 1, minWidth: 200 },
      {
        field: "txnDate",
        headerName: "Date",
        width: 130,
        renderCell: (p) => formatNice(p.value as string),
      },
      {
        field: "txnAmount",
        headerName: "Amount($)",
        type: "number",
        width: 120,
        renderCell: (p) => bareAmount(p.value as number),
      },
      {
        field: "category",
        headerName: "Category",
        flex: 1,
        minWidth: 200,
        sortable: false,
        valueGetter: (_v, row) =>
          ccTxnComplete(row) ? `${row.expenseCategoryLabel} · ${row.expenseTypeLabel}` : "Needs details",
        renderCell: (p) => (
          <Box component="span" sx={{ color: ccTxnComplete(p.row) ? "success.main" : "text.disabled" }}>
            {p.value as string}
          </Box>
        ),
      },
      {
        field: "actions",
        headerName: "",
        width: 130,
        sortable: false,
        filterable: false,
        align: "right",
        headerAlign: "right",
        renderCell: (p) => (
          <Button size="small" variant="outlined" onClick={() => setEditing(p.row)} sx={{ textTransform: "none", fontWeight: 600 }}>
            {ccTxnComplete(p.row) ? "Edit" : "Categorise"}
          </Button>
        ),
      },
    ],
    [],
  );

  // Keep a part-finished categorisation on the server, as EditPane.tsx:444-467
  // does. Without it, closing the tab after categorising a batch threw the lot
  // away: `edits` above is component state and nothing posted until Submit.
  //
  // Five seconds, the source's own autoSaveDelay (EditPane.tsx:150), rather
  // than the util's 1s default — this posts whole transaction rows, not
  // keystrokes.
  const draft = useCcSaveDraft();
  const edited = useMemo(() => Object.values(edits), [edits]);
  const draftState = useDraftAutosave(
    JSON.stringify(edited),
    txns.isSuccess,
    async () => {
      if (edited.length > 0) await draft.mutateAsync(edited);
    },
    5000,
  );

  const toggle = (id: number) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleSubmit = () => {
    if (completeChecked.length === 0) return;
    const submittedIds = new Set(completeChecked.map((t) => t.id));
    submit.mutate(completeChecked, {
      onSuccess: () => {
        showSuccess(CC_SNACK.success.submitTransaction);
        // Prune only the submitted rows — clearing all of `edits`/`checked`
        // would discard categorisation the user did on rows they didn't tick.
        setChecked((prev) => new Set([...prev].filter((id) => !submittedIds.has(id))));
        setEdits((prev) => {
          const next = { ...prev };
          submittedIds.forEach((id) => delete next[id]);
          return next;
        });
      },
      onError: (err) => showError(describeError(err)),
    });
  };

  if (userInfo.isLoading || cards.isLoading) {
    return <Skeleton variant="rectangular" height={220} sx={{ borderRadius: 1.5 }} />;
  }
  if (userInfo.isError || cards.isError) {
    return (
      <Alert severity="error">
        Couldn't load your cards. {describeError(userInfo.error ?? cards.error)}
      </Alert>
    );
  }
  if (ownCards.length === 0) {
    return <Alert severity="info">You don't have a corporate credit card assigned.</Alert>;
  }

  return (
    <Box>
      <CardMenu
        cards={ownCards}
        active={activeCard}
        onSelect={setSelectedCard}
        badge="countNew"
        onRename={(card, label) =>
          renameCard.mutate(
            { id: card.id, label },
            {
              onSuccess: () => showSuccess(CC_SNACK.success.updateCardLabel),
              onError: (err) => showError(describeError(err)),
            },
          )
        }
      />

      {txns.isLoading ? (
        <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 1.5, mt: 2 }} />
      ) : txns.isError ? (
        <Alert severity="error" sx={{ mt: 2 }}>Couldn't load transactions. {describeError(txns.error)}</Alert>
      ) : rows.length === 0 ? (
        <Typography sx={{ fontSize: 13, color: "text.secondary", py: 3 }}>
          No new transactions on this card.
        </Typography>
      ) : (
        <Box sx={{ height: 520, width: "100%" }}>
          {/* NewTransactionsDataGrid.tsx — on the grid, so this screen has the
              search, sorting and paging the source's has. No export: nothing
              here is submitted yet, and the source offers it only on history. */}
          <DataGrid.DataGrid
            rows={rows}
            columns={columns}
            showToolbar
            slots={{ toolbar: NewTxnToolbar }}
            density="compact"
            disableRowSelectionOnClick
            checkboxSelection
            rowSelectionModel={{ type: "include", ids: new Set(checked) }}
            onRowSelectionModelChange={(model) => {
              const next = model.ids as Set<DataGrid.GridRowId>;
              for (const t of rows) {
                if (next.has(t.id) !== checked.has(t.id)) toggle(t.id);
              }
            }}
            initialState={{ pagination: { paginationModel: { pageSize: 20, page: 0 } } }}
            pageSizeOptions={[5, 10, 20, 25, 50]}
            sx={FINANCE_GRID_SX}
          />
        </Box>
      )}

      {submit.isError && <Alert severity="error" sx={{ mt: 2 }}>{describeError(submit.error)}</Alert>}

      {/* EditPane.tsx:1523-1532 shows the autosave state in the action row, so
          the reader can see their part-finished work is being kept. */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 1.5, mt: 2 }}>
        {edited.length > 0 && <DraftStatusChip state={draftState} />}
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={completeChecked.length === 0 || submit.isPending}
          sx={{ fontWeight: 600 }}
        >
          {submit.isPending ? "Submitting…" : `Submit ${completeChecked.length || ""} for approval`.trim()}
        </Button>
      </Box>

      <CcEditDialog
        txn={editing}
        onClose={() => setEditing(null)}
        onSave={(patched) => {
          setEdits((prev) => ({ ...prev, [patched.id]: patched }));
          setEditing(null);
        }}
      />
    </Box>
  );
}
