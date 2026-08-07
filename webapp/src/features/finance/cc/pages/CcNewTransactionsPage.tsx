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
  Checkbox,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@wso2/oxygen-ui";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { isCcBackendConfigured } from "@config/apiConfig";
import FinanceShell from "../../components/FinanceShell";
import { describeError } from "../../util/financeError";
import { money, formatNice } from "../../util/financeFormat";
import { CardMenu } from "../components/CardMenu";
import { CcEditDialog } from "../CcEditDialog";
import { useCcEmployeeSubmit } from "../useCcMutations";
import { useCcTransactions, useCcUserInfo, useCreditCards } from "../useCc";
import { ccTxnComplete, type CcTransaction } from "../ccTypes";

export default function CcNewTransactionsPage() {
  return (
    <FinanceShell
      eyebrow="💳 Credit Card Expenses"
      title="New card transactions"
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
        showSuccess(`${completeChecked.length} transaction(s) submitted for lead approval`);
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
      <CardMenu cards={ownCards} active={activeCard} onSelect={setSelectedCard} badge="countNew" />

      {txns.isLoading ? (
        <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 1.5, mt: 2 }} />
      ) : txns.isError ? (
        <Alert severity="error" sx={{ mt: 2 }}>Couldn't load transactions. {describeError(txns.error)}</Alert>
      ) : rows.length === 0 ? (
        <Typography sx={{ fontSize: 13, color: "text.secondary", py: 3 }}>
          No new transactions on this card.
        </Typography>
      ) : (
        <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1.5, overflow: "hidden", mt: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ "& th": { fontSize: 11, fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.04em" } }}>
                <TableCell padding="checkbox" />
                <TableCell>Description</TableCell>
                <TableCell>Date</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell>Category</TableCell>
                <TableCell align="right">&nbsp;</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((t) => {
                const complete = ccTxnComplete(t);
                return (
                  <TableRow key={t.id} hover selected={checked.has(t.id)}>
                    <TableCell padding="checkbox">
                      <Checkbox
                        size="small"
                        checked={checked.has(t.id)}
                        disabled={!complete}
                        onChange={() => toggle(t.id)}
                      />
                    </TableCell>
                    <TableCell sx={{ fontSize: 12.5 }}>{t.txnDescription}</TableCell>
                    <TableCell sx={{ fontSize: 12.5 }}>{formatNice(t.txnDate)}</TableCell>
                    <TableCell align="right" sx={{ fontSize: 12.5, fontVariantNumeric: "tabular-nums" }}>
                      {money(t.txnAmount, "USD")}
                    </TableCell>
                    <TableCell sx={{ fontSize: 12.5, color: complete ? "success.main" : "text.disabled" }}>
                      {complete ? `${t.expenseCategoryLabel} · ${t.expenseTypeLabel}` : "Needs details"}
                    </TableCell>
                    <TableCell align="right">
                      <Button size="small" variant="outlined" onClick={() => setEditing(t)} sx={{ textTransform: "none", fontWeight: 600 }}>
                        {complete ? "Edit" : "Categorise"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>
      )}

      {submit.isError && <Alert severity="error" sx={{ mt: 2 }}>{describeError(submit.error)}</Alert>}

      <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 2 }}>
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
