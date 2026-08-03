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
import { isOpdBackendConfigured } from "@config/apiConfig";
import FinanceShell from "../../components/FinanceShell";
import { StatusChip, opdStatusMeta } from "../../components/FinanceChips";
import { describeError } from "../../util/financeError";
import { money, formatNice } from "../../util/financeFormat";
import { useOpdClaims, useOpdUserInfo } from "../useOpd";
import { OpdClaimDetailsDialog } from "../OpdClaimDetailsDialog";
import type { OpdClaim } from "../opdTypes";

export default function OpdHistoryPage() {
  return (
    <FinanceShell
      eyebrow="🏥 OPD Claims"
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

      <OpdClaimDetailsDialog claim={selected} onClose={() => setSelected(null)} />
    </Box>
  );
}
