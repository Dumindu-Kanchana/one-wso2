/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Typography,
} from "@wso2/oxygen-ui";
import { describeError } from "../util/financeError";
import { money } from "../util/financeFormat";
import { useExpenseAppData, useExpenseClaims } from "../expense/useExpense";
import { useOpdClaims, useOpdUserInfo } from "../opd/useOpd";
import { opdStatusFilter, opdHasRole, OPD_ROLE } from "../opd/opdTypes";
import type { ExpenseClaim } from "../expense/expenseTypes";
import type { OpdClaim } from "../opd/opdTypes";
import { ExpenseClaimDetailsDialog } from "../expense/ExpenseClaimDetailsDialog";
import { OpdClaimDetailsDialog } from "../opd/OpdClaimDetailsDialog";
import { byLongestWait, daysWaiting, waitingLabel, waitingSince } from "./claimWaiting";

// Everything waiting on the person looking, grouped by which app it came from.
//
// Grouped rather than merged into one table: an OPD claim is a set of medical
// bills checked against an annual limit, an expense claim is a set of lines with
// receipts and a stage. Merging them would mean one column set that fits
// neither, and an Amount column mixing currencies whose total means nothing.
//
// Longest wait first within each group, because the claim someone is chasing is
// the one to show first.

export default function NeedsYouTab() {
  const expenseAppData = useExpenseAppData();
  const opdUserInfo = useOpdUserInfo();

  const canLead = Boolean(expenseAppData.data?.enableLeadView);
  const canExpenseFinance = Boolean(expenseAppData.data?.enableFinanceView);
  const canOpd = opdHasRole(opdUserInfo.data, OPD_ROLE.FINANCE_APPROVER);
  const myEmail = expenseAppData.data?.userInfo.workEmail ?? undefined;

  // Two independent flags, so a person can be waiting on both stages at once.
  // `leadEmail` scopes the lead queue to their own reports; the finance queue is
  // company-wide and needs no scoping.
  const leadQueue = useExpenseClaims(
    { leadEmail: myEmail, status: ["PENDING_LEAD"] },
    canLead && Boolean(myEmail),
  );
  const financeQueue = useExpenseClaims({ status: ["PENDING_FINANCE"] }, canExpenseFinance);
  // opdStatusFilter adds PENDING_OLD: claims filed before the status was split
  // carry it, and asking for PENDING alone hides them from the queue entirely.
  const opdQueue = useOpdClaims({ status: opdStatusFilter(["PENDING"]) }, canOpd);

  const [expenseTarget, setExpenseTarget] = useState<ExpenseClaim | null>(null);
  const [opdTarget, setOpdTarget] = useState<OpdClaim | null>(null);

  const expenseRows = useMemo(
    () => byLongestWait([...(leadQueue.data ?? []), ...(financeQueue.data ?? [])], waitingSince),
    [leadQueue.data, financeQueue.data],
  );
  const opdRows = useMemo(
    () => byLongestWait(opdQueue.data ?? [], waitingSince),
    [opdQueue.data],
  );

  // `isLoading`, not `isPending`. React Query leaves a DISABLED query pending
  // for good — it never fetches, so it never resolves — and every queue here is
  // disabled for someone lacking that role. Waiting on `isPending` meant the
  // screen spun forever for anyone holding less than all three, which is most
  // people. `isLoading` is pending AND fetching, so a disabled query reads as
  // not loading, which is what it is.
  const loading =
    expenseAppData.isLoading ||
    opdUserInfo.isLoading ||
    leadQueue.isLoading ||
    financeQueue.isLoading ||
    opdQueue.isLoading;

  if (loading) {
    return <Skeleton variant="rectangular" height={320} sx={{ borderRadius: 1.5 }} />;
  }

  // One queue failing must not blank the other: a finance approver whose OPD
  // backend is down still has expense claims to get through.
  const failures = [
  // The two calls that decide WHICH queues run belong here too. When either
  // fails its flags read false, so the queues are disabled rather than failing
  // — and a disabled query reports no error. Without these the screen would
  // tell an approver nothing is waiting when nothing had loaded.
    expenseAppData.isError ? describeError(expenseAppData.error) : null,
    opdUserInfo.isError ? describeError(opdUserInfo.error) : null,
    leadQueue.isError ? describeError(leadQueue.error) : null,
    financeQueue.isError ? describeError(financeQueue.error) : null,
    opdQueue.isError ? describeError(opdQueue.error) : null,
  ].filter(Boolean);

  const total = expenseRows.length + opdRows.length;

  return (
    <Box>
      {failures.length > 0 && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Some queues couldn&apos;t be loaded. {failures[0]}
        </Alert>
      )}

      {total === 0 && failures.length === 0 ? (
        <Typography sx={{ fontSize: 13, color: "text.secondary", py: 3 }}>
          Nothing is waiting on you.
        </Typography>
      ) : (
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableBody>
              {opdRows.length > 0 && (
                <GroupHeading
                  label="OPD claims"
                  count={opdRows.length}
                  note="you decide as finance"
                />
              )}
              {opdRows.map((claim) => (
                <TableRow key={claim.id} hover>
                  <IdCell id={claim.id} />
                  <WhoCell email={claim.employeeEmail} />
                  <WaitCell since={waitingSince(claim)} />
                  <AmountCell amount={claim.totalAmount} currency="LKR" />
                  <TableCell sx={CELL}>
                    {claim.transactions.length} bill{claim.transactions.length === 1 ? "" : "s"}
                  </TableCell>
                  <ReviewCell onClick={() => setOpdTarget(claim)} />
                </TableRow>
              ))}

              {expenseRows.length > 0 && (
                <GroupHeading
                  label="Expense claims"
                  count={expenseRows.length}
                  note={stageNote(canLead, canExpenseFinance)}
                />
              )}
              {expenseRows.map((claim) => (
                <TableRow key={claim.id} hover>
                  <IdCell id={claim.id} />
                  <WhoCell email={claim.employeeEmail} />
                  <WaitCell since={waitingSince(claim)} />
                  <AmountCell amount={claim.totalAmount} currency={claim.currencyCode ?? "LKR"} />
                  <TableCell sx={CELL}>
                    {/* Which decision this row wants from you. A person holding
                        both flags sees both kinds in one list, so the row has to
                        say which hat it needs. */}
                    <Chip
                      size="small"
                      label={
                        claim.statusDetails.status === "PENDING_LEAD" ? "as lead" : "as finance"
                      }
                      sx={{ height: 18, fontSize: 10.5 }}
                    />
                  </TableCell>
                  <ReviewCell onClick={() => setExpenseTarget(claim)} />
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}

      {/* The apps' own review dialogs, so a decision made here is the same
          decision made on the per-type screens — one flow, not a copy. */}
      <ExpenseClaimDetailsDialog
        claim={expenseTarget}
        onClose={() => setExpenseTarget(null)}
        review={
          expenseTarget?.statusDetails.status === "PENDING_LEAD"
            ? "LEAD"
            : expenseTarget
              ? "FINANCE"
              : undefined
        }
      />
      <OpdClaimDetailsDialog claim={opdTarget} onClose={() => setOpdTarget(null)} review />
    </Box>
  );
}

function stageNote(canLead: boolean, canFinance: boolean): string {
  if (canLead && canFinance) return "you decide as lead and as finance";
  return canLead ? "you decide as lead" : "you decide as finance";
}

const CELL = { fontSize: 12.5, fontVariantNumeric: "tabular-nums" } as const;

function GroupHeading({
  label,
  count,
  note,
}: {
  label: string;
  count: number;
  note: string;
}) {
  return (
    <TableRow>
      <TableCell colSpan={6} sx={{ border: 0, pt: 2, pb: 0.75 }}>
        <Typography
          component="span"
          sx={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "text.secondary",
          }}
        >
          {label} · {count} · {note}
        </Typography>
      </TableCell>
    </TableRow>
  );
}

function IdCell({ id }: { id: string }) {
  return <TableCell sx={{ ...CELL, fontWeight: 600 }}>{id}</TableCell>;
}

function WhoCell({ email }: { email: string }) {
  return <TableCell sx={CELL}>{email}</TableCell>;
}

function WaitCell({ since }: { since: string }) {
  const days = daysWaiting(since);
  return (
    <TableCell sx={{ ...CELL, color: days >= 7 ? "error.main" : undefined }}>
      {waitingLabel(days)}
    </TableCell>
  );
}

function AmountCell({ amount, currency }: { amount: number; currency: string }) {
  return (
    <TableCell align="right" sx={CELL}>
      {money(amount, currency)}
    </TableCell>
  );
}

function ReviewCell({ onClick }: { onClick: () => void }) {
  return (
    <TableCell align="right">
      <Button size="small" variant="contained" onClick={onClick} sx={{ textTransform: "none" }}>
        Review
      </Button>
    </TableCell>
  );
}
