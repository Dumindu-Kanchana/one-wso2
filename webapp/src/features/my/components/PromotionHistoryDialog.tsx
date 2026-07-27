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

import { useMemo } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Skeleton,
  Stack,
  Typography,
} from "@wso2/oxygen-ui";
import { HttpError } from "@api/http";
import type { PromotionHistoryEntry, PromotionType } from "../api/types";
import { formatDate } from "../api/derive";
import { usePromotionHistory } from "../api/usePromotionHistory";

// "View promotion history" popup. Fetches on open only (query gated by
// `open` prop). Renders each approved promotion request as a timeline
// row: cycle heading, job-band jump chip, role/BU/team meta, effective
// date. Mirrors the storytelling shape of the promotion app's individual
// history page while staying compact enough for a modal.
export default function PromotionHistoryDialog({
  open,
  workEmail,
  onClose,
}: {
  open: boolean;
  workEmail?: string;
  onClose: () => void;
}) {
  const query = usePromotionHistory(workEmail, open);

  // Newest first — backend order isn't guaranteed. Fall back to id when
  // updatedOn is missing (shouldn't happen, but a defensive sort key
  // keeps rendering stable).
  const entries = useMemo<PromotionHistoryEntry[]>(() => {
    const list = query.data?.promotionRequests ?? [];
    return [...list].sort((a, b) => {
      const ta = a.updatedOn ? Date.parse(a.updatedOn) : 0;
      const tb = b.updatedOn ? Date.parse(b.updatedOn) : 0;
      if (tb !== ta) return tb - ta;
      return b.id - a.id;
    });
  }, [query.data]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Typography sx={{ fontSize: 17, fontWeight: 700 }}>Promotion history</Typography>
        {workEmail && (
          <Typography sx={{ fontSize: 12.5, color: "text.secondary", mt: 0.25 }}>
            {workEmail}
          </Typography>
        )}
      </DialogTitle>
      <DialogContent dividers sx={{ p: 2, minHeight: 180 }}>
        {query.isLoading ? (
          <Stack spacing={1.25}>
            <Skeleton variant="rectangular" height={64} sx={{ borderRadius: 1 }} />
            <Skeleton variant="rectangular" height={64} sx={{ borderRadius: 1 }} />
            <Skeleton variant="rectangular" height={64} sx={{ borderRadius: 1 }} />
          </Stack>
        ) : query.isError ? (
          <Alert severity="error" sx={{ fontSize: 12.5 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 600, mb: 0.25 }}>
              Couldn't load promotion history
            </Typography>
            <Typography sx={{ fontSize: 12.5 }}>{readableError(query.error)}</Typography>
          </Alert>
        ) : entries.length === 0 ? (
          <Box sx={{ py: 3, textAlign: "center" }}>
            <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
              No approved promotion records on file.
            </Typography>
            <Typography sx={{ fontSize: 12, color: "text.disabled", mt: 0.5 }}>
              Once a promotion cycle approves your request, it'll show up here.
            </Typography>
          </Box>
        ) : (
          <Stack spacing={1.25}>
            {entries.map((e) => (
              <HistoryRow key={e.id} entry={e} />
            ))}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button size="small" onClick={onClose}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function HistoryRow({ entry }: { entry: PromotionHistoryEntry }) {
  const orgLine = [entry.businessUnit, entry.department, entry.team, entry.subTeam ?? undefined]
    .filter(Boolean)
    .join(" · ");
  return (
    <Box
      sx={{
        border: 1,
        borderColor: "divider",
        borderRadius: 1.25,
        p: 1.5,
        backgroundColor: "background.paper",
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
        <Typography sx={{ fontSize: 13.5, fontWeight: 600, flex: 1 }}>
          {entry.promotionCycle}
        </Typography>
        <TypeChip type={entry.promotionType} />
      </Stack>
      <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 0.5 }}>
        <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>
          {entry.currentJobRole || "—"}
        </Typography>
        <Typography sx={{ fontSize: 12, color: "text.disabled" }}>·</Typography>
        <BandJump from={entry.currentJobBand} to={entry.nextJobBand} />
      </Stack>
      {orgLine && (
        <Typography sx={{ fontSize: 11.5, color: "text.disabled", mb: 0.5 }} noWrap>
          {orgLine}
        </Typography>
      )}
      <Typography sx={{ fontSize: 11.5, color: "text.secondary", fontVariantNumeric: "tabular-nums" }}>
        {/* Backend surfaces createdOn (application creation) and
            updatedOn (last mutation of the row). updatedOn can shift
            when an admin edits the request post-approval, so we label
            it "Last updated" — an honest match for what the field
            actually is. A dedicated effective-date field would be
            better once the backend exposes one. */}
        Last updated {formatDate(entry.updatedOn)}
      </Typography>
    </Box>
  );
}

function BandJump({ from, to }: { from: number; to: number }) {
  return (
    <Stack direction="row" alignItems="center" spacing={0.5}>
      <Chip
        label={`JB ${from}`}
        size="small"
        variant="outlined"
        sx={{ height: 22, fontSize: 11, fontWeight: 600 }}
      />
      <Box sx={{ fontSize: 12, color: "text.disabled" }}>→</Box>
      <Chip
        label={`JB ${to}`}
        size="small"
        color="primary"
        variant="outlined"
        sx={{ height: 22, fontSize: 11, fontWeight: 700, borderWidth: 1.5 }}
      />
    </Stack>
  );
}

function TypeChip({ type }: { type: PromotionType }) {
  const label =
    type === "TIME_BASED" ? "Time-based" : type === "SPECIAL" ? "Special" : "Normal";
  const color: "primary" | "warning" | "success" =
    type === "TIME_BASED" ? "success" : type === "SPECIAL" ? "warning" : "primary";
  return (
    <Chip
      label={label}
      size="small"
      color={color}
      variant="outlined"
      sx={{ height: 22, fontSize: 10.5, fontWeight: 600, letterSpacing: "0.03em" }}
    />
  );
}

function readableError(err: unknown): string {
  if (err instanceof HttpError && err.responseBody) {
    try {
      const parsed = JSON.parse(err.responseBody) as { message?: string };
      return parsed.message ?? err.responseBody;
    } catch {
      return err.responseBody;
    }
  }
  if (err instanceof Error) return err.message;
  return "Failed to load promotion history";
}
