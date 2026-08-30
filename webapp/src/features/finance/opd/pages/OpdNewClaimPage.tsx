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
import { useLocation } from "react-router";
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
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { CheckIcon, PencilIcon, XIcon } from "@wso2/oxygen-ui-icons-react";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { isOpdBackendConfigured } from "@config/apiConfig";
import FinanceShell from "../../components/FinanceShell";
import { DraftStatusChip } from "../../components/DraftStatusChip";
import { describeError } from "../../util/financeError";
import { money, todayIso, startOfYearIso, endOfYearIso, formatNice } from "../../util/financeFormat";
import { RECEIPT_ACCEPT, OPD_RECEIPT_MAX_BYTES, maxSizeLabel } from "../../util/financeReceipts";
import { useDraftAutosave } from "../../util/useDraftAutosave";
import { useOpdAppData, useOpdUserInfo } from "../useOpd";
import { useOpdDraftSync, useOpdReceiptUpload, useSubmitOpdClaim } from "../useOpdMutations";
import { OPD_ROLE, opdHasRole, type OpdTransaction } from "../opdTypes";
import { FINANCE_EYEBROW } from "@constants/financeApps";

const COMMENT_MAX = 100;

// ExpenseForm.tsx:138 — verbatim.
const SAME_YEAR_MESSAGE = "All transactions in a claim must belong to the same year.";

/** Which year's balance this claim is being filed against. */
type ClaimYear = "current" | "last";

export default function OpdNewClaimPage() {
  return (
    <FinanceShell
      eyebrow={FINANCE_EYEBROW.opd}
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
  // ExpenseForm.tsx:59 — the dialog doubles as the edit form for one row.
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [confirmingSubmit, setConfirmingSubmit] = useState(false);
  const [confirmingDraftLoss, setConfirmingDraftLoss] = useState(false);
  // NewClaim.tsx:51-53 — a claim is filed against one year, and the backend
  // still carries last year's remaining balance while it is claimable.
  const [pickedYear, setPickedYear] = useState<ClaimYear>("current");
  const [pendingYear, setPendingYear] = useState<ClaimYear | null>(null);

  const email = userInfo.data?.workEmail ?? "";
  const lastYearSummary = appData.data?.lastYearClaimSummary ?? null;
  const currentYear = new Date().getFullYear();

  // :57-63 — the tab follows the bills already in the list, so a seeded or
  // restored last-year draft opens on the right year rather than on "current"
  // with dates the picker would then refuse. Derived rather than pushed into
  // state by an effect: the two cannot disagree, even for a render.
  const claimYear: ClaimYear =
    items.length > 0
      ? items[0].date.substring(0, 4) === String(currentYear)
        ? "current"
        : "last"
      : pickedYear;
  const yearOfClaim = claimYear === "current" ? currentYear : currentYear - 1;

  // :271-272 — the figures on screen follow the tab, so the limit you are
  // spending against is the one for the year you are claiming for.
  const summary = claimYear === "current" ? appData.data?.claimSummary : lastYearSummary;
  const claimedInList = useMemo(() => items.reduce((s, it) => s + it.amount, 0), [items]);
  const remainingAfter =
    summary != null ? Math.max(summary.totalRemaining - claimedInList, 0) : undefined;
  // ExpenseForm.tsx:79-87 — while editing, the row's own amount is not spent
  // yet, so it must not count against the limit it is being checked against.
  const editingItem = editingIndex != null ? items[editingIndex] : undefined;
  const maxForDialog =
    remainingAfter != null && editingItem ? remainingAfter + editingItem.amount : remainingAfter;

  // Bills carried over from a rejected claim via "Resubmit as New Claim"
  // (OpdHistoryPage). ClaimDetails.tsx:187-192 adds them to the working list
  // and navigates here; autosave then persists them, replacing the old draft.
  const location = useLocation();
  const carriedOver = (location.state as { resubmitTransactions?: OpdTransaction[] } | null)
    ?.resubmitTransactions;

  // Bills carried over from a resubmit go straight in; a saved draft does not.
  // NewClaim.tsx:249-266 offers it as an explicit "Restore Draft" choice beside
  // "Add OPD Claim" — restoring silently would make a stale draft look like
  // work in progress, and there would be no way to start fresh without first
  // deleting bills you never entered this session.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current) return;
    if (carriedOver && carriedOver.length > 0) {
      seeded.current = true;
      setItems(carriedOver);
    }
  }, [carriedOver]);

  const savedDraft = appData.data?.draft?.transactions ?? [];
  const draftOffered = items.length === 0 && savedDraft.length > 0;

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

  // NewClaim.tsx:74-116. Two things stop a restore, both because a claim is
  // filed against a single year: a draft spanning years, and a draft from a
  // different year than the bills already entered.
  const handleRestoreDraft = () => {
    const draftYear = savedDraft[0]?.date.substring(0, 4);
    if (!savedDraft.every((it) => it.date.substring(0, 4) === draftYear)) {
      showError("Draft contains transactions from multiple years. Restore aborted.");
      return;
    }
    if (items.length > 0 && items[0].date.substring(0, 4) !== draftYear) {
      showError("Cannot restore draft: existing claim contains a different transaction year.");
      return;
    }
    setItems(savedDraft);
    showSuccess("Draft restored successfully");
  };

  const handleSubmit = () => {
    if (items.length === 0) return;
    setConfirmingSubmit(false);
    submit.mutate(
      { transactions: items },
      {
        onSuccess: () => {
          showSuccess("OPD claim submitted to finance");
          // Delete the server draft NOW rather than relying on the autosave
          // debounce — that timer is cleared on unmount, so navigating away
          // within the debounce window would leave the draft to be re-seeded
          // and submitted again as a duplicate. mutate() starts the request
          // synchronously, so it survives an immediate unmount.
          draft.remove.mutate();
          setItems([]);
        },
        onError: (err) => showError(describeError(err)),
      },
    );
  };

  return (
    <Stack spacing={1.75} sx={{ maxWidth: 880 }}>
      {/* NewClaim.tsx:129-172,382 — only offered when the backend still reports
          a last-year balance; otherwise there is nothing to claim against. */}
      {lastYearSummary && (
        <Tabs
          value={claimYear}
          onChange={(_e, v: ClaimYear) => {
            // :65-72 — switching with bills in the list needs consent, because
            // confirming clears them.
            if (items.length > 0) {
              setPendingYear(v);
              return;
            }
            setPickedYear(v);
          }}
          sx={{ minHeight: 36, "& .MuiTab-root": { minHeight: 36, textTransform: "none", fontSize: 13, fontWeight: 600 } }}
        >
          <Tab value="current" label="This Year" />
          <Tab value="last" label="Last Year" />
        </Tabs>
      )}

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
          <Button
            size="small"
            variant="outlined"
            onClick={() => {
              // :236-241 — starting a new bill discards the saved draft, so say
              // so while it can still be restored instead.
              if (draftOffered) {
                setConfirmingDraftLoss(true);
                return;
              }
              setDialogOpen(true);
            }}
            sx={{ fontWeight: 600, textTransform: "none" }}
          >
            + Add bill
          </Button>
        </Stack>

        {items.length === 0 ? (
          <Stack alignItems="center" spacing={1.25} sx={{ py: 2 }}>
            <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
              No bills yet. Add your first outpatient bill to start the claim.
            </Typography>
            {draftOffered && (
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>
                  You have a saved draft.
                </Typography>
                <Button size="small" color="success" variant="outlined" onClick={handleRestoreDraft} sx={{ textTransform: "none", fontWeight: 600 }}>
                  Restore Draft
                </Button>
              </Stack>
            )}
          </Stack>
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
                {/* AccessMode.EDIT_DELETE (NewClaim.tsx:185) — a bill can be
                    corrected in place, not just removed and retyped. */}
                <IconButton
                  size="small"
                  aria-label="Edit bill"
                  onClick={() => {
                    setEditingIndex(i);
                    setDialogOpen(true);
                  }}
                  sx={{ color: "text.secondary", "&:hover": { color: "primary.main" } }}
                >
                  <PencilIcon size={14} />
                </IconButton>
                <IconButton
                  size="small"
                  aria-label="Remove bill"
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

      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
        <Button
          variant="contained"
          onClick={() => setConfirmingSubmit(true)}
          disabled={items.length === 0 || submit.isPending}
          sx={{ fontWeight: 600 }}
        >
          {submit.isPending ? "Submitting…" : `Submit claim (${money(claimedInList)})`}
        </Button>
      </Box>

      <AddBillDialog
        open={dialogOpen}
        editing={editingItem}
        onClose={() => {
          setDialogOpen(false);
          setEditingIndex(null);
        }}
        maxAmount={maxForDialog}
        year={yearOfClaim}
        isCurrentYear={claimYear === "current"}
        uploading={upload.isPending}
        onUpload={(file) => upload.mutateAsync({ email, file })}
        onAdd={(item) => {
          // ExpenseForm.tsx:129-144 — a claim cannot mix years. The picker's
          // bounds already steer this, but the field is typeable, so the rule
          // is enforced rather than implied. The row being edited is not its
          // own reference point (:131-133).
          const others = items.filter((_, j) => j !== editingIndex);
          const existing = others[0];
          if (existing && existing.date.substring(0, 4) !== item.date.substring(0, 4)) {
            showError(SAME_YEAR_MESSAGE);
            return false;
          }
          setItems((prev) =>
            editingIndex != null
              ? prev.map((it, j) => (j === editingIndex ? item : it))
              : [...prev, item],
          );
          setDialogOpen(false);
          setEditingIndex(null);
          return true;
        }}
      />

      {/* NewClaim.tsx:411-427 — a claim goes to finance for review, so it is
          confirmed rather than sent on a single click. */}
      <Dialog open={confirmingSubmit} onClose={() => setConfirmingSubmit(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: 17, fontWeight: 700 }}>Claim Submission Confirmation</DialogTitle>
        <DialogContent dividers>
          <Typography sx={{ fontSize: 13.5 }}>
            Are you sure you want to submit this claim? Once submitted, it will be sent to the
            finance team for review.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button size="small" onClick={() => setConfirmingSubmit(false)}>
            Cancel
          </Button>
          <Button size="small" variant="contained" onClick={handleSubmit} disabled={submit.isPending}>
            {submit.isPending ? "Submitting…" : "Submit"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* :429-440 — the saved draft is dropped the moment a new bill is added. */}
      <Dialog open={confirmingDraftLoss} onClose={() => setConfirmingDraftLoss(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: 17, fontWeight: 700 }}>Draft Deletion Warning</DialogTitle>
        <DialogContent dividers>
          <Typography sx={{ fontSize: 13.5 }}>
            Adding a new claim will delete your draft. Are you sure you want to proceed?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button size="small" onClick={() => setConfirmingDraftLoss(false)}>
            Cancel
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={() => {
              setConfirmingDraftLoss(false);
              setDialogOpen(true);
            }}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      {/* :442-465 — confirming discards every bill entered so far, and the
          draft with them, so the wording says so before it happens. */}
      <Dialog open={pendingYear !== null} onClose={() => setPendingYear(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: 17, fontWeight: 700 }}>Change Year Warning</DialogTitle>
        <DialogContent dividers>
          <Typography sx={{ fontSize: 13.5 }}>
            Changing the year will delete current claim items. Do you want to proceed?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button size="small" onClick={() => setPendingYear(null)}>
            Cancel
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={() => {
              setItems([]);
              draft.remove.mutate();
              if (pendingYear) setPickedYear(pendingYear);
              setPendingYear(null);
            }}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

function AddBillDialog({
  open,
  editing,
  onClose,
  maxAmount,
  year,
  isCurrentYear,
  uploading,
  onUpload,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  /** The row being corrected, if any — otherwise a new bill is being added. */
  editing: OpdTransaction | undefined;
  maxAmount: number | undefined;
  /** Calendar year the bill must fall in. */
  year: number;
  /** Current year stops at today; a past year runs to 31 Dec. */
  isCurrentYear: boolean;
  uploading: boolean;
  onUpload: (file: File) => Promise<string>;
  /** Returns false when the bill was refused, so the form keeps its values. */
  onAdd: (item: OpdTransaction) => boolean;
}) {
  const { showError } = useNotifications();
  const [date, setDate] = useState(isCurrentYear ? todayIso() : endOfYearIso(year));
  const [amount, setAmount] = useState("");
  const [comment, setComment] = useState("");
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const fileInput = useRef<HTMLInputElement>(null);

  const reset = () => {
    setDate(isCurrentYear ? todayIso() : endOfYearIso(year));
    setAmount("");
    setComment("");
    setReceiptUrl(null);
    setFileName("");
  };

  // Load the row's values when the dialog opens on one, and clear them when it
  // opens fresh. FileUploadArea.tsx:87-102 does the same for the receipt: an
  // existing one already counts as attached, so no re-upload is forced.
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setDate(editing.date.substring(0, 10));
      setAmount(String(editing.amount));
      setComment(editing.comment ?? "");
      setReceiptUrl(editing.receiptUrl ?? null);
      setFileName(editing.receiptUrl ?? "");
    } else {
      reset();
    }
    // Runs on open, and when the row being edited changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const amountNum = Number(amount);
  const amountValid = Number.isFinite(amountNum) && amountNum > 0 && (maxAmount == null || amountNum <= maxAmount);
  const valid = amountValid && comment.trim().length > 0 && comment.length <= COMMENT_MAX && Boolean(receiptUrl);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > OPD_RECEIPT_MAX_BYTES) {
      showError(`Receipt must be ${maxSizeLabel(OPD_RECEIPT_MAX_BYTES)} or smaller.`);
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
    <Dialog
      open={open}
      onClose={() => {
        // Reset on Esc / backdrop dismissal too — otherwise the amount,
        // description and uploaded receipt persist into the next bill.
        reset();
        onClose();
      }}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle sx={{ fontSize: 17, fontWeight: 700 }}>{editing ? "Edit bill" : "Add a bill"}</DialogTitle>
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
                // aria-label on the input: the visible caption above is a plain
                // Typography, so without it the field has no accessible name.
                inputProps={{
                  min: startOfYearIso(year),
                  max: isCurrentYear ? todayIso() : endOfYearIso(year),
                  "aria-label": "Bill date",
                }}
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
                {receiptUrl && (
                  <CheckIcon size={13} style={{ color: "var(--oxygen-palette-success-main)", flexShrink: 0 }} />
                )}
                {receiptUrl ? fileName : `JPG, PNG or PDF · max ${maxSizeLabel(OPD_RECEIPT_MAX_BYTES)}`}
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
            // Only clear when the bill was taken — ExpenseForm.tsx:141 leaves
            // the form populated so a refused entry can be corrected.
            if (onAdd({ date, amount: amountNum, comment: comment.trim(), receiptUrl })) reset();
          }}
        >
          {editing ? "Save bill" : "Add bill"}
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
