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
import { formatNice, money } from "../util/financeFormat";
import { useExpenseAppData, useExpenseClaims } from "../expense/useExpense";
import { useOpdClaims, useOpdUserInfo } from "../opd/useOpd";
import { OPD_ROLE, opdHasRole } from "../opd/opdTypes";
import type { ExpenseClaim } from "../expense/expenseTypes";
import type { OpdClaim } from "../opd/opdTypes";
import { ExpenseClaimDetailsDialog } from "../expense/ExpenseClaimDetailsDialog";
import { OpdClaimDetailsDialog } from "../opd/OpdClaimDetailsDialog";

// Claims in this person's scope that already have a decision.
//
// Called "Decided", not "Decided by you", and the distinction is the data's
// rather than a stylistic one: both DTOs record `financeApproverEmail`, so a
// finance decision can be attributed — but the lead side carries only
// `leadApprovedDate` and `leadRejectedDate`, with no lead approver. A lead's own
// decisions cannot be told from a co-lead's on the same card. Rows say who
// decided wherever the backend knows, and say nothing where it does not.

export default function DecidedTab() {
  const expenseAppData = useExpenseAppData();
  const opdUserInfo = useOpdUserInfo();

  const canLead = Boolean(expenseAppData.data?.enableLeadView);
  const canExpenseFinance = Boolean(expenseAppData.data?.enableFinanceView);
  const canOpd = opdHasRole(opdUserInfo.data, OPD_ROLE.FINANCE_APPROVER);
  const myEmail = expenseAppData.data?.userInfo.workEmail ?? undefined;

  // A lead's decided queue is the claims they forwarded or turned down, so it is
  // scoped to their reports the same way their pending queue is.
  //
  // Someone holding BOTH flags gets a narrowed version rather than none. The
  // finance list below covers what they settled as finance and nothing else, so
  // a claim they only forwarded — still PENDING_FINANCE — or turned down as
  // lead was in neither query and simply vanished from Decided. The two status
  // lists are kept disjoint, or the same claim would appear twice.
  const leadDecided = useExpenseClaims(
    {
      leadEmail: myEmail,
      status: canExpenseFinance
        ? ["PENDING_FINANCE", "LEAD_REJECTED"]
        : ["PENDING_FINANCE", "APPROVED", "FINANCE_REJECTED", "LEAD_REJECTED"],
    },
    canLead && Boolean(myEmail),
  );
  const financeDecided = useExpenseClaims(
    { status: ["APPROVED", "FINANCE_REJECTED"] },
    canExpenseFinance,
  );
  const opdDecided = useOpdClaims({ status: ["APPROVED", "REJECTED"] }, canOpd);

  const [expenseTarget, setExpenseTarget] = useState<ExpenseClaim | null>(null);
  const [opdTarget, setOpdTarget] = useState<OpdClaim | null>(null);

  const expenseRows = useMemo(
    () => [...(financeDecided.data ?? []), ...(leadDecided.data ?? [])],
    [financeDecided.data, leadDecided.data],
  );
  const opdRows = opdDecided.data ?? [];

  // `isLoading`, not `isPending`. React Query leaves a DISABLED query pending
  // for good — it never fetches, so it never resolves — and every queue here is
  // disabled for someone lacking that role. Waiting on `isPending` meant the
  // screen spun forever for anyone holding less than all three, which is most
  // people. `isLoading` is pending AND fetching, so a disabled query reads as
  // not loading, which is what it is.
  const loading =
    expenseAppData.isLoading ||
    opdUserInfo.isLoading ||
    leadDecided.isLoading ||
    financeDecided.isLoading ||
    opdDecided.isLoading;

  if (loading) return <Skeleton variant="rectangular" height={280} sx={{ borderRadius: 1.5 }} />;

  const failure =
  // The two calls that decide WHICH queues run belong here too. When either
  // fails its flags read false, so the queues are disabled rather than failing
  // — and a disabled query reports no error. Without these the screen would
  // tell an approver nothing is waiting when nothing had loaded.
    (expenseAppData.isError && describeError(expenseAppData.error)) ||
    (opdUserInfo.isError && describeError(opdUserInfo.error)) ||
    (leadDecided.isError && describeError(leadDecided.error)) ||
    (financeDecided.isError && describeError(financeDecided.error)) ||
    (opdDecided.isError && describeError(opdDecided.error)) ||
    null;

  // "Nothing has been decided" is a claim about the data, so it is only made
  // when the data actually arrived. With a failure in hand the alert stands
  // alone — saying both at once tells the reader two different things.
  if (expenseRows.length === 0 && opdRows.length === 0 && !failure) {
    return (
      <Box>
        {failure && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Some queues couldn&apos;t be loaded. {failure}
          </Alert>
        )}
        <Typography sx={{ fontSize: 13, color: "text.secondary", py: 3 }}>
          Nothing has been decided yet.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {failure && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Some queues couldn&apos;t be loaded. {failure}
        </Alert>
      )}
      {expenseRows.length === 0 && opdRows.length === 0 ? null : (
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableBody>
            {opdRows.length > 0 && <Heading label="OPD claims" count={opdRows.length} />}
            {opdRows.map((claim) => (
              <TableRow key={claim.id} hover>
                <TableCell sx={ID}>{claim.id}</TableCell>
                <TableCell sx={CELL}>{claim.employeeEmail}</TableCell>
                <TableCell sx={CELL}>
                  {decidedOn(claim.statusDetails.financeApprovedDate, claim.statusDetails.financeRejectedDate)}
                </TableCell>
                <TableCell align="right" sx={CELL}>{money(claim.totalAmount, "LKR")}</TableCell>
                <TableCell sx={CELL}>{claim.statusDetails.financeApproverEmail ?? "—"}</TableCell>
                <TableCell sx={CELL}>
                  <Outcome status={claim.statusDetails.status ?? null} />
                </TableCell>
                <ViewCell onClick={() => setOpdTarget(claim)} />
              </TableRow>
            ))}

            {expenseRows.length > 0 && <Heading label="Expense claims" count={expenseRows.length} />}
            {expenseRows.map((claim) => (
              <TableRow key={claim.id} hover>
                <TableCell sx={ID}>{claim.id}</TableCell>
                <TableCell sx={CELL}>{claim.employeeEmail}</TableCell>
                <TableCell sx={CELL}>
                  {decidedOn(
                    claim.statusDetails.financeApprovedDate ?? claim.statusDetails.leadApprovedDate,
                    claim.statusDetails.financeRejectedDate ?? claim.statusDetails.leadRejectedDate,
                  )}
                </TableCell>
                <TableCell align="right" sx={CELL}>
                  {money(claim.totalAmount, claim.currencyCode ?? "LKR")}
                </TableCell>
                {/* Blank for a lead-stage decision: the backend records no lead
                    approver, so naming one would be a guess. */}
                <TableCell sx={CELL}>{claim.statusDetails.financeApproverEmail ?? "—"}</TableCell>
                <TableCell sx={CELL}>
                  <Outcome status={claim.statusDetails.status} />
                </TableCell>
                <ViewCell onClick={() => setExpenseTarget(claim)} />
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
      )}

      {/* Read-only: `review` is left off, so these open as a record of what was
          decided rather than offering the decision again. */}
      <ExpenseClaimDetailsDialog claim={expenseTarget} onClose={() => setExpenseTarget(null)} />
      <OpdClaimDetailsDialog claim={opdTarget} onClose={() => setOpdTarget(null)} />
    </Box>
  );
}

const CELL = { fontSize: 12.5, fontVariantNumeric: "tabular-nums" } as const;
const ID = { ...CELL, fontWeight: 600 } as const;

/**
 * Opens the record for one claim.
 *
 * A button in the row rather than an onClick on the row itself: a `<tr>` takes
 * no focus and answers no key, so the dialog was unreachable without a mouse.
 * Matches Needs you, whose rows have always been opened this way.
 */
function ViewCell({ onClick }: { onClick: () => void }) {
  return (
    <TableCell align="right">
      <Button size="small" variant="outlined" onClick={onClick} sx={{ textTransform: "none" }}>
        View
      </Button>
    </TableCell>
  );
}

function decidedOn(approved: string | null | undefined, rejected: string | null | undefined): string {
  const when = approved ?? rejected;
  return when ? formatNice(when) : "—";
}

function Heading({ label, count }: { label: string; count: number }) {
  return (
    <TableRow>
      <TableCell colSpan={7} sx={{ border: 0, pt: 2, pb: 0.75 }}>
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
          {label} · {count}
        </Typography>
      </TableCell>
    </TableRow>
  );
}

function Outcome({ status }: { status: string | null }) {
  const rejected = Boolean(status?.includes("REJECTED"));
  const forwarded = status === "PENDING_FINANCE";
  return (
    <Chip
      size="small"
      color={rejected ? "error" : forwarded ? "default" : "success"}
      label={rejected ? "Rejected" : forwarded ? "Sent to finance" : "Approved"}
      sx={{ height: 18, fontSize: 10.5 }}
    />
  );
}
