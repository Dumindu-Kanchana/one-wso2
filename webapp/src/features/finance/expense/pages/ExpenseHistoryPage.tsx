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
  FormControl,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@wso2/oxygen-ui";
import { isExpenseBackendConfigured } from "@config/apiConfig";
import FinanceShell from "../../components/FinanceShell";
import { StatusChip, expenseStatusMeta } from "../../components/FinanceChips";
import { describeError } from "../../util/financeError";
import { money, formatNice, startOfYearIso, endOfYearIso } from "../../util/financeFormat";
import { useExpenseAppData, useExpenseClaims } from "../useExpense";
import { ExpenseClaimDetailsDialog } from "../ExpenseClaimDetailsDialog";
import type { ExpenseClaim } from "../expenseTypes";

export default function ExpenseHistoryPage() {
  return (
    <FinanceShell
      eyebrow="🧾 Expense Claims"
      title="My expense claims"
      subtitle="Your submitted expense claims and where each one stands. Open a claim to see its lines and receipts."
      configured={isExpenseBackendConfigured()}
      configKey="ONE_WSO2_EXPENSE_CLAIMS_BACKEND_URL"
    >
      <HistoryBody />
    </FinanceShell>
  );
}

function HistoryBody() {
  const appData = useExpenseAppData();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [selected, setSelected] = useState<ExpenseClaim | null>(null);

  const email = appData.data?.userInfo.workEmail ?? undefined;
  const claims = useExpenseClaims(
    { email, startDate: startOfYearIso(year), endDate: endOfYearIso(year) },
    Boolean(email),
  );

  const years = useMemo(() => {
    const out: number[] = [];
    for (let y = currentYear; y >= currentYear - 4; y--) out.push(y);
    return out;
  }, [currentYear]);

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
        <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>Year</Typography>
        <FormControl size="small">
          <Select value={year} onChange={(e) => setYear(Number(e.target.value))} sx={{ minWidth: 110 }}>
            {years.map((y) => (
              <MenuItem key={y} value={y}>
                {y}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      {appData.isLoading || claims.isLoading ? (
        <Stack spacing={1}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} variant="rectangular" height={48} sx={{ borderRadius: 1 }} />
          ))}
        </Stack>
      ) : claims.isError ? (
        <Alert severity="error">Couldn't load your claims. {describeError(claims.error)}</Alert>
      ) : (claims.data?.length ?? 0) === 0 ? (
        <Typography sx={{ fontSize: 13, color: "text.secondary", py: 3 }}>
          No expense claims on record for {year}.
        </Typography>
      ) : (
        <ClaimsTable claims={claims.data!} onView={setSelected} />
      )}

      <ExpenseClaimDetailsDialog claim={selected} onClose={() => setSelected(null)} />
    </Box>
  );
}

// Shared table also used by the approvals screens (with a `userColumn`).
export function ClaimsTable({
  claims,
  onView,
  userColumn,
  actionLabel = "View",
  actionVariant = "outlined",
}: {
  claims: ExpenseClaim[];
  onView: (c: ExpenseClaim) => void;
  userColumn?: boolean;
  actionLabel?: string;
  actionVariant?: "outlined" | "contained";
}) {
  return (
    <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1.5, overflow: "hidden" }}>
      <Table size="small">
        <TableHead>
          <TableRow sx={{ "& th": { fontSize: 11, fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.04em" } }}>
            <TableCell>Claim ID</TableCell>
            {userColumn && <TableCell>User</TableCell>}
            <TableCell>Submitted</TableCell>
            <TableCell align="right">Amount</TableCell>
            {!userColumn && <TableCell>Status</TableCell>}
            <TableCell align="right">&nbsp;</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {claims.map((c) => {
            const meta = expenseStatusMeta(c.statusDetails.status);
            return (
              <TableRow key={c.id} hover>
                <TableCell sx={{ fontSize: 12.5, fontFamily: "monospace" }}>{c.id}</TableCell>
                {userColumn && <TableCell sx={{ fontSize: 12.5 }}>{c.employeeEmail}</TableCell>}
                <TableCell sx={{ fontSize: 12.5 }}>{formatNice(c.createdDate)}</TableCell>
                <TableCell align="right" sx={{ fontSize: 12.5, fontVariantNumeric: "tabular-nums" }}>
                  {money(c.totalAmount, c.currencyCode ?? "LKR")}
                </TableCell>
                {!userColumn && (
                  <TableCell>
                    <StatusChip label={meta.label} color={meta.color} />
                  </TableCell>
                )}
                <TableCell align="right">
                  <Button size="small" variant={actionVariant} onClick={() => onView(c)} sx={{ textTransform: "none", fontWeight: 600 }}>
                    {actionLabel}
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Box>
  );
}
