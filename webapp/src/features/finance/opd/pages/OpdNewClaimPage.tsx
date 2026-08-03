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
  IconButton,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { isOpdBackendConfigured } from "@config/apiConfig";
import FinanceShell from "../../components/FinanceShell";
import { DraftStatusChip } from "../../components/DraftStatusChip";
import { describeError } from "../../util/financeError";
import { money, todayIso, startOfYearIso, formatNice } from "../../util/financeFormat";
import { RECEIPT_ACCEPT, RECEIPT_MAX_BYTES } from "../../util/financeReceipts";
import { useDraftAutosave } from "../../util/useDraftAutosave";
import { useOpdAppData, useOpdUserInfo } from "../useOpd";
import { useOpdDraftSync, useOpdReceiptUpload, useSubmitOpdClaim } from "../useOpdMutations";
import { OPD_ROLE, opdHasRole, type OpdTransaction } from "../opdTypes";

const COMMENT_MAX = 100;

export default function OpdNewClaimPage() {
  return (
    <FinanceShell
      eyebrow="🏥 OPD Claims"
      title="New OPD claim"
      subtitle="Add each outpatient bill as a line — bill date, amount, a short description and its receipt — then submit the whole claim to finance. Your remaining OPD balance is shown as you go."
      configured={isOpdBackendConfigured()}
      configKey="ONE_WSO2_OPD_BACKEND_URL"
    >
      <NewClaimBody />
    </FinanceShell>
  );
}

function NewClaimBody() {
  const userInfo = useOpdUserInfo();
  const appData = useOpdAppData();
  const upload = useOpdReceiptUpload();
  const submit = useSubmitOpdClaim();
  const draft = useOpdDraftSync();
  const { showSuccess, showError } = useNotifications();

  const [items, setItems] = useState<OpdTransaction[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  const email = userInfo.data?.workEmail ?? "";
  const summary = appData.data?.claimSummary;
  const claimedInList = useMemo(() => items.reduce((s, it) => s + it.amount, 0), [items]);
  const remainingAfter =
    summary != null ? Math.max(summary.totalRemaining - claimedInList, 0) : undefined;

  // Seed the working list from any server-side draft, once, when app-data
  // first arrives and the list is still empty.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current) return;
    if (!appData.isSuccess) return;
    seeded.current = true;
    const drafted = appData.data?.draft?.transactions ?? [];
    if (drafted.length > 0) setItems(drafted);
  }, [appData.isSuccess, appData.data]);

  // Debounced autosave: POST the draft while there are items, DELETE it once
  // the list is emptied (e.g. after submit).
  const draftState = useDraftAutosave(
    JSON.stringify(items),
    appData.isSuccess,
    async () => {
      if (items.length > 0) await draft.save.mutateAsync(items);
      else await draft.remove.mutateAsync();
    },
  );

  if (userInfo.isLoading || appData.isLoading) {
    return (
      <Stack spacing={1.75} sx={{ maxWidth: 880 }}>
        <Skeleton variant="rectangular" height={96} sx={{ borderRadius: 1.5 }} />
        <Skeleton variant="rectangular" height={160} sx={{ borderRadius: 1.5 }} />
      </Stack>
    );
  }
  if (userInfo.isError) {
    return <Alert severity="error">Couldn't load your OPD profile. {describeError(userInfo.error)}</Alert>;
  }
  if (!opdHasRole(userInfo.data, OPD_ROLE.CLAIM_SUBMITTER)) {
    return (
      <Alert severity="info">
        OPD claim submission isn't available for your account (it's limited to permanent
        employees at eligible locations).
      </Alert>
    );
  }

  const handleSubmit = () => {
    if (items.length === 0) return;
    submit.mutate(
      { transactions: items },
      {
        onSuccess: () => {
          showSuccess("OPD claim submitted to finance");
          setItems([]);
        },
        onError: (err) => showError(describeError(err)),
      },
    );
  };

  return (
    <Stack spacing={1.75} sx={{ maxWidth: 880 }}>
      {/* Balance summary */}
      <Card variant="outlined" sx={{ p: 2 }}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(4, 1fr)" }, gap: 1.5 }}>
          <Stat label="Annual limit" value={summary ? money(summary.totalClaimLimit) : "—"} />
          <Stat label="Already claimed" value={summary ? money(summary.totalClaimedAmount) : "—"} />
          <Stat label="This claim" value={money(claimedInList)} />
          <Stat label="Remaining after" value={remainingAfter != null ? money(remainingAfter) : "—"} highlight />
        </Box>
      </Card>

      {/* Line items */}
      <Card variant="outlined" sx={{ p: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
          <FieldLabel>Bills in this claim</FieldLabel>
          <DraftStatusChip state={draftState} />
          <Box sx={{ flex: 1 }} />
          <Button size="small" variant="outlined" onClick={() => setDialogOpen(true)} sx={{ fontWeight: 600, textTransform: "none" }}>
            + Add bill
          </Button>
        </Stack>

        {items.length === 0 ? (
          <Typography sx={{ fontSize: 13, color: "text.secondary", py: 2, textAlign: "center" }}>
            No bills yet. Add your first outpatient bill to start the claim.
          </Typography>
        ) : (
          <Stack spacing={1}>
            {items.map((it, i) => (
              <Box
                key={i}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                  border: 1,
                  borderColor: "divider",
                  borderRadius: 1,
                  px: 1.5,
                  py: 1,
                }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 600 }} noWrap>
                    {it.comment}
                  </Typography>
                  <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>
                    {formatNice(it.date)} · {it.receiptUrl ? "receipt attached" : "no receipt"}
                  </Typography>
                </Box>
                <Typography sx={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                  {money(it.amount)}
                </Typography>
                <IconButton
                  size="small"
                  aria-label="Remove bill"
                  onClick={() => setItems((prev) => prev.filter((_, j) => j !== i))}
                  sx={{ color: "text.secondary", "&:hover": { color: "error.main" } }}
                >
                  ✕
                </IconButton>
              </Box>
            ))}
          </Stack>
        )}
      </Card>

      {submit.isError && <Alert severity="error">{describeError(submit.error)}</Alert>}

      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={items.length === 0 || submit.isPending}
          sx={{ fontWeight: 600 }}
        >
          {submit.isPending ? "Submitting…" : `Submit claim (${money(claimedInList)})`}
        </Button>
      </Box>

      <AddBillDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxAmount={remainingAfter}
        uploading={upload.isPending}
        onUpload={(file) => upload.mutateAsync({ email, file })}
        onAdd={(item) => {
          setItems((prev) => [...prev, item]);
          setDialogOpen(false);
        }}
      />
    </Stack>
  );
}

function AddBillDialog({
  open,
  onClose,
  maxAmount,
  uploading,
  onUpload,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  maxAmount: number | undefined;
  uploading: boolean;
  onUpload: (file: File) => Promise<string>;
  onAdd: (item: OpdTransaction) => void;
}) {
  const { showError } = useNotifications();
  const [date, setDate] = useState(todayIso());
  const [amount, setAmount] = useState("");
  const [comment, setComment] = useState("");
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const fileInput = useRef<HTMLInputElement>(null);

  const reset = () => {
    setDate(todayIso());
    setAmount("");
    setComment("");
    setReceiptUrl(null);
    setFileName("");
  };

  const amountNum = Number(amount);
  const amountValid = Number.isFinite(amountNum) && amountNum > 0 && (maxAmount == null || amountNum <= maxAmount);
  const valid = amountValid && comment.trim().length > 0 && comment.length <= COMMENT_MAX && Boolean(receiptUrl);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > RECEIPT_MAX_BYTES) {
      showError("Receipt must be 10 MB or smaller.");
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
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontSize: 17, fontWeight: 700 }}>Add a bill</DialogTitle>
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
                inputProps={{ min: startOfYearIso(new Date().getFullYear()), max: todayIso() }}
              />
            </Box>
            <Box>
              <FieldLabel>Amount (LKR)</FieldLabel>
              <TextField
                type="number"
                size="small"
                fullWidth
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                error={amount !== "" && !amountValid}
                helperText={
                  amount !== "" && !amountValid
                    ? maxAmount != null && amountNum > maxAmount
                      ? `Exceeds remaining balance (${money(maxAmount)})`
                      : "Enter an amount greater than 0"
                    : " "
                }
                inputProps={{ min: 0, step: "0.01" }}
              />
            </Box>
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
              placeholder="e.g. GP consultation + prescription"
              helperText={`${comment.length}/${COMMENT_MAX}`}
            />
          </Box>

          <Box>
            <FieldLabel>Receipt</FieldLabel>
            <input
              ref={fileInput}
              type="file"
              accept={RECEIPT_ACCEPT}
              onChange={handleFile}
              style={{ display: "none" }}
            />
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
                {receiptUrl ? `✓ ${fileName}` : "JPG, PNG or PDF · max 10 MB"}
              </Typography>
            </Stack>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button
          size="small"
          onClick={() => {
            reset();
            onClose();
          }}
        >
          Cancel
        </Button>
        <Button
          size="small"
          variant="contained"
          disabled={!valid}
          onClick={() => {
            onAdd({ date, amount: amountNum, comment: comment.trim(), receiptUrl });
            reset();
          }}
        >
          Add bill
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

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <Box sx={{ border: 1, borderColor: highlight ? "primary.main" : "divider", borderRadius: 1, px: 1.5, py: 1 }}>
      <Typography sx={{ fontSize: 10, color: "text.disabled", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: highlight ? "primary.main" : "text.primary" }}>
        {value}
      </Typography>
    </Box>
  );
}
