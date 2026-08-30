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
import { useNavigate } from "react-router";
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
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@wso2/oxygen-ui";
import { isOpdBackendConfigured } from "@config/apiConfig";
import FinanceShell from "../../components/FinanceShell";
import { StatusChip, opdStatusMeta } from "../../components/FinanceChips";
import { describeError } from "../../util/financeError";
import { money, formatNice } from "../../util/financeFormat";
import { useOpdClaims, useOpdUserInfo } from "../useOpd";
import { OpdClaimDetailsDialog } from "../OpdClaimDetailsDialog";
import type { OpdClaim } from "../opdTypes";
import { FINANCE_EYEBROW } from "@constants/financeApps";

export default function OpdHistoryPage() {
  return (
    <FinanceShell
      eyebrow={FINANCE_EYEBROW.opd}
      title="My OPD claims"
      subtitle="Your submitted OPD claims and where each one stands. Open a claim to see its bills and receipts."
      configured={isOpdBackendConfigured()}
      configKey="ONE_WSO2_OPD_BACKEND_URL"
    >
      <HistoryBody />
    </FinanceShell>
  );
}

function HistoryBody() {
  const userInfo = useOpdUserInfo();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [selected, setSelected] = useState<OpdClaim | null>(null);
  const [resubmitting, setResubmitting] = useState<OpdClaim | null>(null);
  const navigate = useNavigate();

  const email = userInfo.data?.workEmail ?? undefined;
  const claims = useOpdClaims(
    { email, startYear: year, endYear: year },
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

      {userInfo.isLoading || claims.isLoading ? (
        <Stack spacing={1}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} variant="rectangular" height={48} sx={{ borderRadius: 1 }} />
          ))}
        </Stack>
      ) : claims.isError ? (
        <Alert severity="error">Couldn't load your claims. {describeError(claims.error)}</Alert>
      ) : (claims.data?.length ?? 0) === 0 ? (
        <Typography sx={{ fontSize: 13, color: "text.secondary", py: 3 }}>
          No OPD claims on record for {year}.
        </Typography>
      ) : (
        <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1.5, overflow: "hidden" }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ "& th": { fontSize: 11, fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.04em" } }}>
                <TableCell>Claim ID</TableCell>
                <TableCell>Submitted</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">&nbsp;</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {claims.data!.map((c) => {
                const meta = opdStatusMeta(c.statusDetails.status);
                return (
                  <TableRow key={c.id} hover>
                    <TableCell sx={{ fontSize: 12.5, fontFamily: "monospace" }}>{c.id}</TableCell>
                    <TableCell sx={{ fontSize: 12.5 }}>{formatNice(c.createdDate)}</TableCell>
                    <TableCell align="right" sx={{ fontSize: 12.5, fontVariantNumeric: "tabular-nums" }}>
                      {money(c.totalAmount)}
                    </TableCell>
                    <TableCell>
                      <StatusChip label={meta.label} color={meta.color} />
                    </TableCell>
                    <TableCell align="right">
                      <Button size="small" variant="outlined" onClick={() => setSelected(c)} sx={{ textTransform: "none", fontWeight: 600 }}>
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>
      )}

      <OpdClaimDetailsDialog
        claim={selected}
        onClose={() => setSelected(null)}
        onResubmit={(c) => setResubmitting(c)}
      />

      {/* ClaimDetails.tsx:395-407. Resubmitting does not amend the rejected
          claim — it starts a fresh one from its bills, which replaces whatever
          draft was already saved, so that is said before it happens. */}
      <Dialog open={resubmitting !== null} onClose={() => setResubmitting(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: 17, fontWeight: 700 }}>Claim Resubmission Confirmation</DialogTitle>
        <DialogContent dividers>
          <Typography sx={{ fontSize: 13.5 }}>
            Are you sure you want to resubmit this claim? This will create a new draft claim and{" "}
            <b>your existing draft will be cleared</b>.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button size="small" onClick={() => setResubmitting(null)}>
            Cancel
          </Button>
          <Button
            size="small"
            color="success"
            variant="contained"
            onClick={() => {
              // :187-192 — the bills are carried over locally and the New Claim
              // screen persists them as the draft, exactly as the source does.
              const transactions = resubmitting?.transactions ?? [];
              setResubmitting(null);
              setSelected(null);
              navigate("/me/opd/new", { state: { resubmitTransactions: transactions } });
            }}
          >
            Resubmit
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
