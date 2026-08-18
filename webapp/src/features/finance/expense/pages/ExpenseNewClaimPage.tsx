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

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { CheckIcon, XIcon } from "@wso2/oxygen-ui-icons-react";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { isExpenseBackendConfigured } from "@config/apiConfig";
import FinanceShell from "../../components/FinanceShell";
import { DraftStatusChip } from "../../components/DraftStatusChip";
import { describeError } from "../../util/financeError";
import { money, todayIso, formatNice, daysAgoIso } from "../../util/financeFormat";
import { RECEIPT_ACCEPT, EXPENSE_RECEIPT_MAX_BYTES, maxSizeLabel } from "../../util/financeReceipts";
import { useDraftAutosave } from "../../util/useDraftAutosave";
import { useExchangeRates, useExpenseAppData, useExpenseTypes } from "../useExpense";
import { useExpenseDraftSync, useExpenseReceiptUpload, useSubmitExpenseClaim } from "../useExpenseMutations";
import type { ExpenseAppData, ExpenseTransactionPayload } from "../expenseTypes";
import { FINANCE_EYEBROW } from "@constants/financeApps";

const COMMENT_MAX = 100;
const NO_JOB = "N/A";

export default function ExpenseNewClaimPage() {
  return (
    <FinanceShell
      eyebrow={FINANCE_EYEBROW.expense}
      title="New expense claim"
      subtitle="Add each out-of-pocket expense as a line — date, amount and currency, expense type and its receipt — then submit the claim to your lead. Amounts are converted to your reimbursement currency automatically."
      configured={isExpenseBackendConfigured()}
      configKey="ONE_WSO2_EXPENSE_CLAIMS_BACKEND_URL"
    >
      <NewClaimBody />
    </FinanceShell>
  );
}

interface DraftLine extends ExpenseTransactionPayload {
  reimbursementAmount: number;
  reimbursementCurrency: string;
  expenseType: string;
}

function NewClaimBody() {
  const appData = useExpenseAppData();
  const upload = useExpenseReceiptUpload();
  const submit = useSubmitExpenseClaim();
  const draft = useExpenseDraftSync();
  const { showSuccess, showError } = useNotifications();

  const [items, setItems] = useState<DraftLine[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  const email = appData.data?.userInfo.workEmail ?? "";
  const reimbursementCurrency = appData.data?.currencyCode ?? "LKR";
  const total = useMemo(() => items.reduce((s, it) => s + it.reimbursementAmount, 0), [items]);

  // Trim a form line down to the wire payload (drops derived fields).
  const toPayload = (line: DraftLine): ExpenseTransactionPayload => ({
    date: line.date,
    amount: line.amount,
    currency: line.currency,
    expenseTypeId: line.expenseTypeId,
    comment: line.comment,
    receiptUrl: line.receiptUrl,
    travelJobNumber: line.travelJobNumber ?? null,
  });

  // Seed the working list from a server draft once app-data arrives.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current) return;
    if (!appData.isSuccess) return;
    seeded.current = true;
    const drafted = appData.data?.draft?.transactions ?? [];
    if (drafted.length > 0) {
      setItems(
        // We send drafts as the trimmed payload (no derived fields), so don't
        // assume the echoed draft carries reimbursementAmount / currency /
        // expenseType — recompute them if absent, or the restored total is
        // NaN and renders as "Rs. 0.00".
        drafted.map((t) => {
          const rate = Number.isFinite(t.currencyConversionRate) ? t.currencyConversionRate : 1;
          const reimbursementAmount = Number.isFinite(t.reimbursementAmount)
            ? t.reimbursementAmount
            : Math.round(t.amount * rate * 100) / 100;
          return {
            date: t.date,
            amount: t.amount,
            currency: t.currency,
            expenseTypeId: t.expenseTypeId,
            comment: t.comment ?? null,
            receiptUrl: t.receiptUrl ?? null,
            travelJobNumber: t.travelJobNumber ?? null,
            reimbursementAmount,
            reimbursementCurrency: t.reimbursementCurrency ?? reimbursementCurrency,
            expenseType: t.expenseType ?? "",
          };
        }),
      );
    }
  }, [appData.isSuccess, appData.data]);

  const draftState = useDraftAutosave(JSON.stringify(items), appData.isSuccess, async () => {
    if (items.length > 0) await draft.save.mutateAsync(items.map(toPayload));
    else await draft.remove.mutateAsync();
  });

  if (appData.isLoading) {
    return (
      <Stack spacing={1.75} sx={{ maxWidth: 880 }}>
        <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 1.5 }} />
        <Skeleton variant="rectangular" height={160} sx={{ borderRadius: 1.5 }} />
      </Stack>
    );
  }
  if (appData.isError) {
    return <Alert severity="error">Couldn't load your expense profile. {describeError(appData.error)}</Alert>;
  }

  const handleSubmit = () => {
    if (items.length === 0) return;
    submit.mutate(
      { transactions: items.map(toPayload) },
      {
        onSuccess: () => {
          showSuccess("Expense claim submitted to your lead");
          // Delete the draft synchronously (see OPD note) so a fast unmount
          // can't leave it to be re-seeded and submitted as a duplicate.
          draft.remove.mutate();
          setItems([]);
        },
        onError: (err) => showError(describeError(err)),
      },
    );
  };

  return (
    <Stack spacing={1.75} sx={{ maxWidth: 880 }}>
      <Card variant="outlined" sx={{ p: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
          <FieldLabel>Expenses in this claim</FieldLabel>
          <DraftStatusChip state={draftState} />
          <Box sx={{ flex: 1 }} />
          <Button size="small" variant="outlined" onClick={() => setDialogOpen(true)} sx={{ fontWeight: 600, textTransform: "none" }}>
            + Add expense
          </Button>
        </Stack>

        {items.length === 0 ? (
          <Typography sx={{ fontSize: 13, color: "text.secondary", py: 2, textAlign: "center" }}>
            No expenses yet. Add your first line to start the claim.
          </Typography>
        ) : (
          <Stack spacing={1}>
            {items.map((it, i) => (
              <Box
                key={i}
                sx={{ display: "flex", alignItems: "center", gap: 1.5, border: 1, borderColor: "divider", borderRadius: 1, px: 1.5, py: 1 }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 600 }} noWrap>
                    {it.expenseType}
                  </Typography>
                  <Typography sx={{ fontSize: 11.5, color: "text.secondary" }} noWrap>
                    {formatNice(it.date)}
                    {it.travelJobNumber ? ` · ${it.travelJobNumber}` : ""}
                    {it.receiptUrl ? " · receipt attached" : ""}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: "right" }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                    {money(it.reimbursementAmount, it.reimbursementCurrency)}
                  </Typography>
                  {it.currency !== it.reimbursementCurrency && (
                    <Typography sx={{ fontSize: 11, color: "text.disabled" }}>{money(it.amount, it.currency)}</Typography>
                  )}
                </Box>
                <IconButton
                  size="small"
                  aria-label="Remove expense"
                  onClick={() => setItems((prev) => prev.filter((_, j) => j !== i))}
                  sx={{ color: "text.secondary", "&:hover": { color: "error.main" } }}
                >
                  <XIcon size={15} />
                </IconButton>
              </Box>
            ))}
          </Stack>
        )}
      </Card>

      {submit.isError && <Alert severity="error">{describeError(submit.error)}</Alert>}

      <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
        <Button variant="contained" onClick={handleSubmit} disabled={items.length === 0 || submit.isPending} sx={{ fontWeight: 600 }}>
          {submit.isPending ? "Submitting…" : `Submit claim (${money(total, reimbursementCurrency)})`}
        </Button>
      </Box>

      {dialogOpen && appData.data && (
        <AddExpenseDialog
          appData={appData.data}
          uploading={upload.isPending}
          onUpload={(file) => upload.mutateAsync({ email, file })}
          onClose={() => setDialogOpen(false)}
          onAdd={(line) => {
            setItems((prev) => [...prev, line]);
            setDialogOpen(false);
          }}
        />
      )}
    </Stack>
  );
}

function AddExpenseDialog({
  appData,
  uploading,
  onUpload,
  onClose,
  onAdd,
}: {
  appData: ExpenseAppData;
  uploading: boolean;
  onUpload: (file: File) => Promise<string>;
  onClose: () => void;
  onAdd: (line: DraftLine) => void;
}) {
  const { showError } = useNotifications();
  const reimbursementCurrency = appData.currencyCode;
  const minDate = appData.pastDateRestrictionDays != null ? daysAgoIso(appData.pastDateRestrictionDays) : undefined;

  const [date, setDate] = useState(todayIso());
  const [currency, setCurrency] = useState(reimbursementCurrency);
  const [amount, setAmount] = useState("");
  const [jobNumber, setJobNumber] = useState(NO_JOB);
  const [expenseTypeId, setExpenseTypeId] = useState<number | "">("");
  const [comment, setComment] = useState("");
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const rates = useExchangeRates(reimbursementCurrency, date);
  const expenseTypes = useExpenseTypes(jobNumber === NO_JOB ? undefined : jobNumber);

  // Conversion rate for the chosen currency: 1 when it's already the
  // reimbursement currency; null when a foreign currency has no rate in the
  // fetched list (missing, or the list is stale/loading after a date change).
  // null must NOT collapse to 1 — that would let the user submit the raw
  // foreign amount as if it were already converted.
  const rate = useMemo<number | null>(() => {
    if (currency === reimbursementCurrency) return 1;
    const found = (rates.data ?? []).find((r) => r.currencyCode === currency);
    return found ? found.exchangeRate : null;
  }, [currency, reimbursementCurrency, rates.data]);

  const currencyOptions = useMemo(() => {
    const set = new Set<string>([reimbursementCurrency, ...(rates.data ?? []).map((r) => r.currencyCode)]);
    return Array.from(set);
  }, [reimbursementCurrency, rates.data]);

  const amountNum = Number(amount);
  const amountValid = Number.isFinite(amountNum) && amountNum > 0;
  const rateReady = rate != null;
  const reimbursementAmount = amountValid && rateReady ? Math.round(amountNum * rate * 100) / 100 : 0;
  const selectedType = (expenseTypes.data ?? []).find((t) => t.id === expenseTypeId);
  const valid =
    amountValid &&
    rateReady &&
    expenseTypeId !== "" &&
    comment.trim().length > 0 &&
    comment.length <= COMMENT_MAX &&
    Boolean(receiptUrl);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > EXPENSE_RECEIPT_MAX_BYTES) {
      showError(`Receipt must be ${maxSizeLabel(EXPENSE_RECEIPT_MAX_BYTES)} or smaller.`);
      return;
    }
    try {
      const name = await onUpload(file);
      setReceiptUrl(name);
      setFileName(file.name);
    } catch (err) {
      showError(describeError(err));
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontSize: 17, fontWeight: 700 }}>Add an expense</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
            <Box>
              <FieldLabel>Bill date</FieldLabel>
              <TextField
                type="date"
                size="small"
                fullWidth
                value={date}
                onChange={(e) => setDate(e.target.value)}
                inputProps={{ min: minDate, max: todayIso() }}
              />
            </Box>
            <Box>
              <FieldLabel>Job number</FieldLabel>
              <FormControl size="small" fullWidth>
                <Select
                  value={jobNumber}
                  onChange={(e) => {
                    setJobNumber(String(e.target.value));
                    setExpenseTypeId(""); // type list depends on the job number
                  }}
                >
                  <MenuItem value={NO_JOB}>N/A (non-travel)</MenuItem>
                  {appData.travels.map((t) => (
                    <MenuItem key={t.jobNumber} value={t.jobNumber}>
                      {t.jobNumber}
                      {t.customerName ? ` — ${t.customerName}` : ""}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </Box>

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr 1fr" }, gap: 1.5, alignItems: "end" }}>
            <Box>
              <FieldLabel>Currency</FieldLabel>
              <FormControl size="small" fullWidth>
                <Select value={currency} onChange={(e) => setCurrency(String(e.target.value))} disabled={rates.isLoading}>
                  {currencyOptions.map((c) => (
                    <MenuItem key={c} value={c}>
                      {c}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            <Box>
              <FieldLabel>Amount</FieldLabel>
              <TextField
                type="number"
                size="small"
                fullWidth
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                inputProps={{ min: 0, step: "0.01" }}
              />
            </Box>
            <Box>
              <FieldLabel>Reimbursement (est.)</FieldLabel>
              <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, px: 1.25, py: 0.9 }}>
                <Typography sx={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                  {rateReady ? money(reimbursementAmount, reimbursementCurrency) : "—"}
                </Typography>
              </Box>
              {!rateReady && (
                <Typography sx={{ fontSize: 11, color: "warning.main", mt: 0.5 }}>
                  {rates.isLoading
                    ? "Fetching exchange rate…"
                    : `No exchange rate available for ${currency} on ${date}.`}
                </Typography>
              )}
            </Box>
          </Box>

          <Box>
            <FieldLabel>Expense type</FieldLabel>
            <FormControl size="small" fullWidth>
              <Select<number | "">
                value={expenseTypeId}
                onChange={(e) => setExpenseTypeId(e.target.value === "" ? "" : Number(e.target.value))}
                disabled={expenseTypes.isLoading}
                displayEmpty
                renderValue={(v) => (v === "" ? <span style={{ opacity: 0.6 }}>Select a type…</span> : selectedType?.type ?? String(v))}
              >
                {(expenseTypes.data ?? []).map((t) => (
                  <MenuItem key={t.id} value={t.id}>
                    {t.type}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <Box>
            <FieldLabel>Description</FieldLabel>
            <TextField
              size="small"
              fullWidth
              multiline
              minRows={2}
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, COMMENT_MAX))}
              placeholder="What was this expense for?"
              helperText={`${comment.length}/${COMMENT_MAX}`}
            />
          </Box>

          <Box>
            <FieldLabel>Receipt</FieldLabel>
            <input ref={fileInput} type="file" accept={RECEIPT_ACCEPT} onChange={handleFile} style={{ display: "none" }} />
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Button
                size="small"
                variant="outlined"
                onClick={() => fileInput.current?.click()}
                disabled={uploading}
                sx={{ textTransform: "none", fontWeight: 600 }}
              >
                {uploading ? "Uploading…" : receiptUrl ? "Replace file" : "Upload receipt"}
              </Button>
              <Typography sx={{ fontSize: 12, color: receiptUrl ? "success.main" : "text.disabled" }} noWrap>
                {receiptUrl && (
                  <CheckIcon size={13} style={{ color: "var(--oxygen-palette-success-main)", flexShrink: 0 }} />
                )}
                {receiptUrl ? fileName : `JPG, PNG or PDF · max ${maxSizeLabel(EXPENSE_RECEIPT_MAX_BYTES)}`}
              </Typography>
            </Stack>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button size="small" onClick={onClose}>
          Cancel
        </Button>
        <Button
          size="small"
          variant="contained"
          disabled={!valid}
          onClick={() =>
            onAdd({
              date,
              amount: amountNum,
              currency,
              expenseTypeId: Number(expenseTypeId),
              comment: comment.trim(),
              receiptUrl,
              travelJobNumber: jobNumber === NO_JOB ? null : jobNumber,
              reimbursementAmount,
              reimbursementCurrency,
              expenseType: selectedType?.type ?? "Expense",
            })
          }
        >
          Add expense
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      sx={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em", color: "text.disabled", fontWeight: 600, mb: 0.75 }}
    >
      {children}
    </Typography>
  );
}
