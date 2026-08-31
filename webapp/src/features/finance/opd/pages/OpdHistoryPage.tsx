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
import { useDebouncedValue } from "@hooks/useDebouncedValue";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { isOpdBackendConfigured } from "@config/apiConfig";
import FinanceShell from "../../components/FinanceShell";
import { StatusChip, opdStatusMeta } from "../../components/FinanceChips";
import { describeError } from "../../util/financeError";
import { money, formatNice } from "../../util/financeFormat";
import { useOpdClaims, useOpdUserInfo } from "../useOpd";
import { OpdClaimDetailsDialog } from "../OpdClaimDetailsDialog";
import {
  OPD_FILTERABLE_STATUSES,
  opdStatusFilter,
  type OpdClaim,
  type OpdClaimRange,
  type OpdClaimStatus,
} from "../opdTypes";
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
  const [selected, setSelected] = useState<OpdClaim | null>(null);
  const [resubmitting, setResubmitting] = useState<OpdClaim | null>(null);
  const navigate = useNavigate();

  // FilterHolder.tsx — the source filters on a year RANGE, a status and a claim
  // id, not a single year. A claim from two years ago was unreachable here.
  const [range, setRange] = useState<OpdClaimRange>("This Year");
  const [customStart, setCustomStart] = useState(currentYear - 1);
  const [customEnd, setCustomEnd] = useState(currentYear);
  const [status, setStatus] = useState<OpdClaimStatus | "All">("All");
  const [claimId, setClaimId] = useState("");
  // Debounced before it reaches the query: useOpdClaims keys on the whole
  // payload, so the raw value would fire a search per keystroke — and on the
  // finance view that search spans the company. The source batches the same
  // fields behind an Apply button (FilterHolder.tsx:53,81-82).
  const claimIdFilter = useDebouncedValue(claimId.trim());

  // :51-65 — This Year and Last Year are single years; Custom spans the two
  // pickers.
  const startYear =
    range === "This Year"
      ? currentYear
      : range === "Last Year"
        ? currentYear - 1
        : customStart;
  const endYear =
    range === "This Year"
      ? currentYear
      : range === "Last Year"
        ? currentYear - 1
        : customEnd;

  const email = userInfo.data?.workEmail ?? undefined;
  const claims = useOpdClaims(
    {
      email,
      startYear,
      endYear,
      // :75 — a claim id is sent as a one-element list, and only when given.
      ids: claimIdFilter ? [claimIdFilter] : undefined,
      status: opdStatusFilter(status === "All" ? [] : [status]),
    },
    Boolean(email),
  );

  const years = useMemo(() => {
    const out: number[] = [];
    for (let y = currentYear; y >= currentYear - 4; y--) out.push(y);
    return out;
  }, [currentYear]);

  return (
    <Box>
      <Stack
        direction="row"
        alignItems="center"
        spacing={1.5}
        sx={{ mb: 2, flexWrap: "wrap", rowGap: 1.5 }}
      >
        <FormControl size="small">
          <InputLabel id="opd-range">Period</InputLabel>
          <Select
            labelId="opd-range"
            label="Period"
            value={range}
            onChange={(e) => setRange(e.target.value as OpdClaimRange)}
            sx={{ minWidth: 140 }}
          >
            {(["This Year", "Last Year", "Custom"] as OpdClaimRange[]).map(
              (r) => (
                <MenuItem key={r} value={r}>
                  {r}
                </MenuItem>
              ),
            )}
          </Select>
        </FormControl>

        {range === "Custom" && (
          <>
            <FormControl size="small">
              <InputLabel id="opd-start">Start Year</InputLabel>
              <Select
                labelId="opd-start"
                label="Start Year"
                value={customStart}
                onChange={(e) => setCustomStart(Number(e.target.value))}
                sx={{ minWidth: 110 }}
              >
                {/* Each end of the range only offers the valid side of the
                    other. The source leaves this open (FilterHolder.tsx:207
                    disables Apply only on a null year), which lets a start
                    after the end reach the payload and return nothing. */}
                {years
                  .filter((y) => y <= customEnd)
                  .map((y) => (
                    <MenuItem key={y} value={y}>
                      {y}
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
            <FormControl size="small">
              <InputLabel id="opd-end">End Year</InputLabel>
              <Select
                labelId="opd-end"
                label="End Year"
                value={customEnd}
                onChange={(e) => setCustomEnd(Number(e.target.value))}
                sx={{ minWidth: 110 }}
              >
                {years
                  .filter((y) => y >= customStart)
                  .map((y) => (
                    <MenuItem key={y} value={y}>
                      {y}
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
          </>
        )}

        <FormControl size="small">
          <InputLabel id="opd-status">Status</InputLabel>
          <Select
            labelId="opd-status"
            label="Status"
            value={status}
            onChange={(e) =>
              setStatus(e.target.value as OpdClaimStatus | "All")
            }
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="All">All</MenuItem>
            {/* PENDING_OLD is not offered — "Pending Finance" already covers it
                through opdStatusFilter (FilterBox.tsx:82-84). */}
            {OPD_FILTERABLE_STATUSES.map((st) => (
              <MenuItem key={st} value={st}>
                {opdStatusMeta(st).label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          size="small"
          label="Filter by claim ID"
          value={claimId}
          onChange={(e) => setClaimId(e.target.value)}
          sx={{ minWidth: 200 }}
        />
      </Stack>

      {userInfo.isLoading || claims.isLoading ? (
        <Stack spacing={1}>
          {[0, 1, 2].map((i) => (
            <Skeleton
              key={i}
              variant="rectangular"
              height={48}
              sx={{ borderRadius: 1 }}
            />
          ))}
        </Stack>
      ) : claims.isError ? (
        <Alert severity="error">
          Couldn't load your claims. {describeError(claims.error)}
        </Alert>
      ) : (claims.data?.length ?? 0) === 0 ? (
        <Typography sx={{ fontSize: 13, color: "text.secondary", py: 3 }}>
          {startYear === endYear
            ? `No OPD claims on record for ${startYear}.`
            : `No OPD claims on record for ${startYear}–${endYear}.`}
        </Typography>
      ) : (
        <Box
          sx={{
            border: 1,
            borderColor: "divider",
            borderRadius: 1.5,
            overflow: "hidden",
          }}
        >
          <Table size="small">
            <TableHead>
              <TableRow
                sx={{
                  "& th": {
                    fontSize: 11,
                    fontWeight: 700,
                    color: "text.secondary",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  },
                }}
              >
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
                    <TableCell sx={{ fontSize: 12.5, fontFamily: "monospace" }}>
                      {c.id}
                    </TableCell>
                    <TableCell sx={{ fontSize: 12.5 }}>
                      {formatNice(c.createdDate)}
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        fontSize: 12.5,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {money(c.totalAmount)}
                    </TableCell>
                    <TableCell>
                      <StatusChip label={meta.label} color={meta.color} />
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => setSelected(c)}
                        sx={{ textTransform: "none", fontWeight: 600 }}
                      >
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
      <Dialog
        open={resubmitting !== null}
        onClose={() => setResubmitting(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontSize: 17, fontWeight: 700 }}>
          Claim Resubmission Confirmation
        </DialogTitle>
        <DialogContent dividers>
          <Typography sx={{ fontSize: 13.5 }}>
            Are you sure you want to resubmit this claim? This will create a new
            draft claim and <b>your existing draft will be cleared</b>.
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
              navigate("/me/opd/new", {
                state: { resubmitTransactions: transactions },
              });
            }}
          >
            Resubmit
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
