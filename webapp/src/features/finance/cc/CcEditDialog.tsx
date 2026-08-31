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

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Stack,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { CheckIcon } from "@wso2/oxygen-ui-icons-react";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { describeError } from "../util/financeError";
import { money, formatNice } from "../util/financeFormat";
import { CC_ATTACHMENT_ACCEPT, CC_ATTACHMENT_MAX_BYTES, maxSizeLabel } from "../util/financeReceipts";
import { useCcJobNumberDetails, useCcMenus } from "./useCc";
import { useCcAttachment } from "./useCcMutations";
import { CcFundingSource,
  CC_MARKETING_CATEGORY,
  CC_TRAVEL_CATEGORY,
  ccTxnComplete,
  type CcTransaction,
} from "./ccTypes";

const COMMENT_MAX = 30;

// Categorise one credit-card transaction: expense category → type, comment,
// and the unit/region/job-number fields the chosen category requires.
export function CcEditDialog({
  txn,
  onClose,
  onSave,
}: {
  txn: CcTransaction | null;
  onClose: () => void;
  onSave: (patched: CcTransaction) => void;
}) {
  return txn ? <CcEditForm key={txn.id} txn={txn} onClose={onClose} onSave={onSave} /> : null;
}

function CcEditForm({
  txn,
  onClose,
  onSave,
}: {
  txn: CcTransaction;
  onClose: () => void;
  onSave: (patched: CcTransaction) => void;
}) {
  const menus = useCcMenus();
  const [category, setCategory] = useState(txn.expenseCategoryLabel ?? "");
  const [typeLabel, setTypeLabel] = useState(txn.expenseTypeLabel ?? "");
  const [comment, setComment] = useState(txn.txnComment ?? "");
  // Product/business unit is picked as an index into the aligned arrays;
  // starts blank (the arrays load async, so a prior value is re-selected).
  const [unitIndex, setUnitIndex] = useState<number | "">("");
  const [subRegion, setSubRegion] = useState(txn.subRegion ?? "");
  const [jobNumber, setJobNumber] = useState(txn.travelJobNumber ?? "");
  const [receiptFileName, setReceiptFileName] = useState(txn.receiptFileName);
  const [contractFileName, setContractFileName] = useState(txn.contractFileName);
  const attachment = useCcAttachment();

  const categories = menus.expenseTypes.data?.categories ?? [];
  const typeOptions = category ? menus.expenseTypes.data?.types[category] ?? [] : [];
  const subRegions = menus.subRegions.data?.subRegions ?? [];
  const jobNumbers = menus.jobNumbers.data?.jobNumbers ?? [];
  const productUnits = menus.units.data?.productUnits ?? [];
  const businessUnits = menus.units.data?.businessUnits ?? [];

  const unitOptions = useMemo(
    () => productUnits.map((pu, i) => ({ i, label: `${pu} — ${businessUnits[i] ?? ""}` })),
    [productUnits, businessUnits],
  );

  // Re-select the transaction's stored product/business unit once the
  // aligned unit arrays load. Without this, editing an already-categorised
  // non-travel transaction would blank the unit (Save stays disabled) until
  // the user re-picks it.
  useEffect(() => {
    if (unitIndex !== "" || !txn.productUnit) return;
    const i = productUnits.findIndex(
      (pu, idx) => pu === txn.productUnit && businessUnits[idx] === txn.businessUnit,
    );
    if (i >= 0) setUnitIndex(i);
  }, [productUnits, businessUnits, txn.productUnit, txn.businessUnit, unitIndex]);

  const isTravel = category === CC_TRAVEL_CATEGORY;
  // EditPane.tsx:364 matches with startsWith, so a sub-category such as
  // "Marketing - Digital" still needs a sub-region.
  const isMarketing = category?.startsWith(CC_MARKETING_CATEGORY) ?? false;

  // EditPane.tsx:560-600 — the job number decides a travel transaction's units.
  // Fetched only while Travel is selected; the row keeps its stored units until
  // the details arrive, so a slow lookup never blanks them.
  const jobDetails = useCcJobNumberDetails(isTravel && jobNumber ? jobNumber : undefined);
  const jobUnits = isTravel ? jobDetails.data : undefined;
  const fundingSources = jobUnits?.fundingSources ?? [];
  // :568-575 — a job with no funding sources cannot be charged against, so the
  // source refuses to apply it rather than filling in half the row.
  const jobUnusable = Boolean(jobUnits) && fundingSources.length === 0;
  // :591-598 — a job can also come back without units, which is worth saying
  // because it is why Save will not enable.
  const jobMissingUnits = Boolean(jobUnits) && !(jobUnits?.productUnit && jobUnits?.businessUnit);
  const jobUsable = Boolean(jobUnits) && fundingSources.length > 0;

  const patched: CcTransaction = {
    ...txn,
    expenseCategoryLabel: category || null,
    expenseTypeLabel: typeLabel || null,
    txnComment: comment || null,
    travelJobNumber: isTravel ? jobNumber || null : null,
    subRegion: isMarketing ? subRegion || null : null,
    // :577-590 — for travel the job's own units win; the user never picks them.
    productUnit: isTravel
      ? (jobUsable ? jobUnits?.productUnit ?? null : txn.productUnit)
      : unitIndex === ""
        ? null
        : productUnits[unitIndex] ?? null,
    businessUnit: isTravel
      ? (jobUsable ? jobUnits?.businessUnit ?? null : txn.businessUnit)
      : unitIndex === ""
        ? null
        : businessUnits[unitIndex] ?? null,
    receiptFileName,
    contractFileName,
  };
  // A job with no funding sources is not applied, so it cannot complete the row.
  const valid = ccTxnComplete(patched) && !jobUnusable;

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontSize: 17, fontWeight: 700 }}>
        Categorise transaction
        <Typography sx={{ fontSize: 12.5, color: "text.secondary", fontWeight: 400 }}>
          {txn.txnDescription} · {formatNice(txn.txnDate)} · {money(txn.txnAmount, "USD")}
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
            <Field label="Expense category">
              <Select
                value={category}
                onChange={(e) => {
                  setCategory(String(e.target.value));
                  setTypeLabel(""); // types depend on category
                }}
                displayEmpty
                renderValue={(v) => (v ? String(v) : <Placeholder />)}
              >
                {categories.map((c) => (
                  <MenuItem key={c} value={c}>
                    {c}
                  </MenuItem>
                ))}
              </Select>
            </Field>
            <Field label="Expense type">
              <Select
                value={typeLabel}
                onChange={(e) => setTypeLabel(String(e.target.value))}
                disabled={!category}
                displayEmpty
                renderValue={(v) => (v ? String(v) : <Placeholder />)}
              >
                {typeOptions.map((t) => (
                  <MenuItem key={t} value={t}>
                    {t}
                  </MenuItem>
                ))}
              </Select>
            </Field>
          </Box>

          {isTravel ? (
            <Field label="Travel job number">
              <Select
                value={jobNumber}
                onChange={(e) => setJobNumber(String(e.target.value))}
                displayEmpty
                renderValue={(v) => (v ? String(v) : <Placeholder />)}
              >
                {jobNumbers.map((j) => (
                  <MenuItem key={j} value={j}>
                    {j}
                  </MenuItem>
                ))}
              </Select>
            {/* EditPane.tsx:568-598 warns on both, because either one leaves
                the row uncompletable and neither is the user's fault. */}
            {jobUnusable && (
              <Alert severity="warning" sx={{ mt: 1, fontSize: 12.5 }}>
                No funding sources found for the selected Job number.
              </Alert>
            )}
            {!jobUnusable && jobMissingUnits && (
              <Alert severity="warning" sx={{ mt: 1, fontSize: 12.5 }}>
                No Product unit and/or Business unit found for the selected Job number.
              </Alert>
            )}
            {jobUsable && jobUnits && (
              <Box sx={{ mt: 1 }}>
                {/* :629-641 — the engagement a travel spend is charged to. */}
                <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>
                  {jobUnits.engagementCode} · {jobUnits.engagementType} · {jobUnits.country}
                </Typography>
                <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>
                  Units from this job: {jobUnits.productUnit} — {jobUnits.businessUnit}
                </Typography>
                <FundingSources sources={fundingSources} totalAmount={txn.txnAmount} />
              </Box>
            )}
            </Field>
          ) : (
            <Field label="Product unit">
              <Select<number | "">
                value={unitIndex}
                onChange={(e) => setUnitIndex(e.target.value === "" ? "" : Number(e.target.value))}
                displayEmpty
                renderValue={(v) => (v === "" ? <Placeholder /> : unitOptions[Number(v)]?.label ?? String(v))}
              >
                {unitOptions.map((o) => (
                  <MenuItem key={o.i} value={o.i}>
                    {o.label}
                  </MenuItem>
                ))}
              </Select>
            </Field>
          )}

          {isMarketing && (
            <Field label="Sub region">
              <Select
                value={subRegion}
                onChange={(e) => setSubRegion(String(e.target.value))}
                displayEmpty
                renderValue={(v) => (v ? String(v) : <Placeholder />)}
              >
                {subRegions.map((s) => (
                  <MenuItem key={s} value={s}>
                    {s}
                  </MenuItem>
                ))}
              </Select>
            </Field>
          )}

          <Box>
            <FieldLabel>Comment</FieldLabel>
            <TextField
              size="small"
              fullWidth
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, COMMENT_MAX))}
              placeholder="Short note for this transaction"
              helperText={`${comment.length}/${COMMENT_MAX}`}
              // The caption above is a plain Typography, so name the input.
              inputProps={{ "aria-label": "Comment" }}
            />
          </Box>

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
            <AttachmentField
              label="Receipt"
              fileName={receiptFileName}
              busy={attachment.upload.isPending}
              onPick={async (file) => {
                const name = await attachment.upload.mutateAsync({ id: txn.id, attachmentType: "receipt", file });
                setReceiptFileName(name || file.name);
              }}
            />
            <AttachmentField
              label="Contract (optional)"
              fileName={contractFileName}
              busy={attachment.upload.isPending}
              onPick={async (file) => {
                const name = await attachment.upload.mutateAsync({ id: txn.id, attachmentType: "contract", file });
                setContractFileName(name || file.name);
              }}
            />
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button size="small" onClick={onClose}>
          Cancel
        </Button>
        <Button size="small" variant="contained" disabled={!valid} onClick={() => onSave(patched)}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  // The visible caption is a plain Typography, so without this the control has
  // no accessible name at all — a screen reader reads "combo box" and nothing
  // else. MUI names a Select through aria-labelledby, so the caption gets an id
  // and the control is pointed at it. Done here, so every field gets one.
  const labelId = React.useId();
  // Only the first element child is the control; a field may render helper
  // content after it (the travel job number carries its warnings inside).
  const items = React.Children.toArray(children);
  const controlIndex = items.findIndex((c) => React.isValidElement(c));
  const named = items.map((child, i) =>
    i === controlIndex && React.isValidElement(child)
      ? React.cloneElement(child as React.ReactElement<{ labelId?: string }>, { labelId })
      : child,
  );
  return (
    <Box>
      <FieldLabel id={labelId}>{label}</FieldLabel>
      <FormControl size="small" fullWidth>
        {named}
      </FormControl>
    </Box>
  );
}

function FieldLabel({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <Typography
      id={id}
      sx={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em", color: "text.disabled", fontWeight: 600, mb: 0.75 }}
    >
      {children}
    </Typography>
  );
}

function AttachmentField({
  label,
  fileName,
  busy,
  onPick,
}: {
  label: string;
  fileName: string | null;
  busy: boolean;
  onPick: (file: File) => Promise<void>;
}) {
  const { showError } = useNotifications();
  const input = useRef<HTMLInputElement>(null);
  const handle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > CC_ATTACHMENT_MAX_BYTES) {
      showError(`File must be ${maxSizeLabel(CC_ATTACHMENT_MAX_BYTES)} or smaller.`);
      return;
    }
    try {
      await onPick(file);
    } catch (err) {
      showError(describeError(err));
    } finally {
      if (input.current) input.current.value = "";
    }
  };
  return (
    <Box>
      <FieldLabel>{label}</FieldLabel>
      <input ref={input} type="file" accept={CC_ATTACHMENT_ACCEPT} onChange={handle} style={{ display: "none" }} />
      <Stack direction="row" alignItems="center" spacing={1}>
        <Button
          size="small"
          variant="outlined"
          onClick={() => input.current?.click()}
          disabled={busy}
          sx={{ textTransform: "none", fontWeight: 600 }}
        >
          {busy ? "Uploading…" : fileName ? "Replace" : "Upload"}
        </Button>
        <Typography sx={{ fontSize: 12, color: fileName ? "success.main" : "text.disabled" }} noWrap>
          {fileName && (
            <CheckIcon size={13} style={{ color: "var(--oxygen-palette-success-main)", flexShrink: 0 }} />
          )}
          {fileName ? "attached" : "none"}
        </Typography>
      </Stack>
    </Box>
  );
}

function Placeholder() {
  return <span style={{ opacity: 0.6 }}>Select…</span>;
}

/**
 * The shares a travel job is funded from, and what this transaction costs each
 * of them — `FundingSourceTable.tsx`, whose Amount column is
 * `(percentage / 100) * txnAmount`.
 */
function FundingSources({
  sources,
  totalAmount,
}: {
  sources: CcFundingSource[];
  totalAmount: number;
}) {
  return (
    <Box sx={{ mt: 1, border: 1, borderColor: "divider", borderRadius: 1, overflowX: "auto" }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            {["Region", "Sub Region", "Business Unit", "Product Unit", "Percentage", "Amount"].map(
              (h) => (
                <TableCell key={h} sx={{ fontSize: 10.5, fontWeight: 700, color: "text.disabled" }}>
                  {h}
                </TableCell>
              ),
            )}
          </TableRow>
        </TableHead>
        <TableBody>
          {sources.map((f, i) => (
            <TableRow key={i}>
              <TableCell sx={{ fontSize: 11.5 }}>{f.region}</TableCell>
              <TableCell sx={{ fontSize: 11.5 }}>{f.subRegion}</TableCell>
              <TableCell sx={{ fontSize: 11.5 }}>{f.businessUnit}</TableCell>
              <TableCell sx={{ fontSize: 11.5 }}>{f.productUnit}</TableCell>
              <TableCell sx={{ fontSize: 11.5, fontVariantNumeric: "tabular-nums" }}>
                {f.percentage}%
              </TableCell>
              <TableCell sx={{ fontSize: 11.5, fontVariantNumeric: "tabular-nums" }}>
                {money((f.percentage / 100) * totalAmount, "USD")}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}
