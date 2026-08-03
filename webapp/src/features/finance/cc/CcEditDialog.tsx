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
import { useNotifications } from "@context/notifications/NotificationsContext";
import { describeError } from "../util/financeError";
import { money, formatNice } from "../util/financeFormat";
import { RECEIPT_ACCEPT, RECEIPT_MAX_BYTES } from "../util/financeReceipts";
import { useCcMenus } from "./useCc";
import { useCcAttachment } from "./useCcMutations";
import {
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

  const isTravel = category === CC_TRAVEL_CATEGORY;
  const isMarketing = category === CC_MARKETING_CATEGORY;

  const patched: CcTransaction = {
    ...txn,
    expenseCategoryLabel: category || null,
    expenseTypeLabel: typeLabel || null,
    txnComment: comment || null,
    travelJobNumber: isTravel ? jobNumber || null : null,
    subRegion: isMarketing ? subRegion || null : null,
    productUnit: isTravel ? txn.productUnit : unitIndex === "" ? null : productUnits[unitIndex] ?? null,
    businessUnit: isTravel ? txn.businessUnit : unitIndex === "" ? null : businessUnits[unitIndex] ?? null,
    receiptFileName,
    contractFileName,
  };
  const valid = ccTxnComplete(patched);

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
  return (
    <Box>
      <FieldLabel>{label}</FieldLabel>
      <FormControl size="small" fullWidth>
        {children}
      </FormControl>
    </Box>
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
    if (file.size > RECEIPT_MAX_BYTES) {
      showError("File must be 10 MB or smaller.");
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
      <input ref={input} type="file" accept={RECEIPT_ACCEPT} onChange={handle} style={{ display: "none" }} />
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
          {fileName ? "✓ attached" : "none"}
        </Typography>
      </Stack>
    </Box>
  );
}

function Placeholder() {
  return <span style={{ opacity: 0.6 }}>Select…</span>;
}
