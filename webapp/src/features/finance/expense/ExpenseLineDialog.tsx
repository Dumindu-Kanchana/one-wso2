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


import { useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { CheckIcon } from "@wso2/oxygen-ui-icons-react";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { describeError } from "../util/financeError";
import { money, todayIso, daysAgoIso } from "../util/financeFormat";
import { RECEIPT_ACCEPT, EXPENSE_RECEIPT_MAX_BYTES, maxSizeLabel } from "../util/financeReceipts";
import { useExchangeRates, useExpenseTypes } from "./useExpense";
import type { ExpenseAppData, ExpenseTransactionPayload } from "./expenseTypes";

export const COMMENT_MAX = 100;
export const NO_JOB = "N/A";

/**
 * A line as the form holds it: the wire payload plus the figures the form
 * derives for display (the backend recomputes them on submit).
 */
export interface DraftLine extends ExpenseTransactionPayload {
  reimbursementAmount: number;
  reimbursementCurrency: string;
  expenseType: string;
}

// One expense line, added or corrected. Shared by the New Claim screen and the
// resubmission of a rejected claim, the way the source shares ExpenseForm
// between NewClaim and ClaimDetails.
export function AddExpenseDialog({
  appData,
  editing,
  uploading,
  onUpload,
  onClose,
  onAdd,
}: {
  appData: ExpenseAppData;
  /** The line being corrected, if any — otherwise a new one is being added. */
  editing: DraftLine | undefined;
  uploading: boolean;
  onUpload: (file: File) => Promise<string>;
  onClose: () => void;
  onAdd: (line: DraftLine) => void;
}) {
  const { showError } = useNotifications();
  const reimbursementCurrency = appData.currencyCode;
  const minDate = appData.pastDateRestrictionDays != null ? daysAgoIso(appData.pastDateRestrictionDays) : undefined;

  // Seeded from the line being edited, so the dialog opens on its values.
  // ExpenseForm.tsx:81-97 does the same via initialFormData.
  const [date, setDate] = useState(editing?.date.substring(0, 10) ?? todayIso());
  const [currency, setCurrency] = useState(editing?.currency ?? reimbursementCurrency);
  const [amount, setAmount] = useState(editing ? String(editing.amount) : "");
  const [jobNumber, setJobNumber] = useState(editing?.travelJobNumber ?? NO_JOB);
  const [expenseTypeId, setExpenseTypeId] = useState<number | "">(editing?.expenseTypeId ?? "");
  const [comment, setComment] = useState(editing?.comment ?? "");
  const [receiptUrl, setReceiptUrl] = useState<string | null>(editing?.receiptUrl ?? null);
  const [fileName, setFileName] = useState(editing?.receiptUrl ?? "");
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
      <DialogTitle sx={{ fontSize: 17, fontWeight: 700 }}>{editing ? "Edit expense" : "Add an expense"}</DialogTitle>
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
          {editing ? "Save expense" : "Add expense"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      sx={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em", color: "text.disabled", fontWeight: 600, mb: 0.75 }}
    >
      {children}
    </Typography>
  );
}
