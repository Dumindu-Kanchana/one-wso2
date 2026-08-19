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

import type { ReactNode } from "react";
import {
  Box,
  Chip,
  CircularProgress,
  Pagination,
  Stack,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import type { CrmRecordStatus, PipelineRun, RecordKind } from "../crmUploadTypes";
import {
  CRM_STATUS_DESCRIPTIONS,
  KIND_COLOR,
  NUMERIC,
  RECORD_STATUS_COLOR,
  RUN_STATUS_COLOR,
  eyebrow,
} from "./crmStyles";

// The pieces the four CRM Upload screens share.
//
// Marketing Ops built these inline, repeatedly: the status chip's sx object appears
// six times across four files, each with its own hex tint and its own idea of the
// letter spacing; the paging footer three times. One copy each here — which is also
// what makes the outcome colours in crmStyles.ts actually authoritative rather than
// aspirational.

// ---- chips -----------------------------------------------------------------

// A chip whose colour carries meaning, tinted from a palette path.
//
// `solid` is reserved for one case (see StatusChip): filled means terminal.
function ToneChip({
  label,
  color,
  title,
  solid,
  onClick,
}: {
  label: string;
  color: string;
  title?: string;
  solid?: boolean;
  onClick?: () => void;
}) {
  const chip = (
    <Chip
      label={label}
      size="small"
      onClick={onClick}
      sx={{
        height: 19,
        fontSize: 9.5,
        fontWeight: 700,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        ...NUMERIC,
        ...(solid
          ? { bgcolor: color, color: "background.paper", border: 0 }
          : { bgcolor: "transparent", color, border: 1, borderColor: color }),
        ...(title && !onClick ? { cursor: "help" } : {}),
        ...(onClick ? { cursor: "pointer" } : {}),
      }}
    />
  );
  return title ? (
    <Tooltip title={title} placement="top" arrow>
      {chip}
    </Tooltip>
  ) : (
    chip
  );
}

/** A record's status, with its explanation and any error attached. */
export function StatusChip({
  status,
  error,
}: {
  status: CrmRecordStatus;
  error?: string | null;
}) {
  const help = CRM_STATUS_DESCRIPTIONS[status] ?? status;
  return (
    <ToneChip
      label={status}
      color={RECORD_STATUS_COLOR[status]}
      title={error ? `${help}\n\n${error}` : help}
    />
  );
}

/** A run's status. */
export function RunStatusChip({ status }: { status: PipelineRun["status"] }) {
  return <ToneChip label={status} color={RUN_STATUS_COLOR[status]} />;
}

/** Lead or Account. A kind, deliberately not one of the outcome colours. */
export function KindChip({ kind }: { kind: RecordKind }) {
  return <ToneChip label={kind} color={KIND_COLOR[kind]} />;
}

/** A batch id, short enough to read, clickable to filter to its batch. */
export function BatchChip({ batchId, onClick }: { batchId: string; onClick?: () => void }) {
  return (
    <ToneChip
      label={`Batch ${batchId.slice(0, 8)}`}
      color="text.secondary"
      title={onClick ? `${batchId}\n\nClick to filter records to this batch` : batchId}
      onClick={onClick}
    />
  );
}

// ---- the outcome strip -----------------------------------------------------

/** A row of stat cells. */
export function StatStrip({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(5, 1fr)" },
        border: 1,
        borderColor: "divider",
        borderRadius: 1.5,
        overflow: "hidden",
        mb: 3,
      }}
    >
      {children}
    </Box>
  );
}

// One number, its label, and what share of the batch it is.
//
// The share is the point. "412 inserted" is a number; "412 inserted, 91% of the
// batch" is the answer to the only question anyone opens this screen with. The batch
// total itself passes `isTotal` so it doesn't claim to be 100% of itself.
export function StatCell({
  label,
  value,
  color,
  total,
  isTotal,
}: {
  label: string;
  value: number;
  color: string;
  total: number;
  isTotal?: boolean;
}) {
  const pct = !isTotal && total > 0 ? Math.round((value / total) * 100) : null;
  return (
    <Box
      sx={{
        px: 1.75,
        py: 1.5,
        borderLeft: 1,
        borderColor: "divider",
        "&:first-of-type": { borderLeft: 0 },
      }}
    >
      <Typography sx={{ ...eyebrow, mb: 0.5 }}>{label}</Typography>
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.75 }}>
        <Typography
          sx={{
            fontSize: 21,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            lineHeight: 1,
            color: value > 0 ? color : "text.disabled",
            ...NUMERIC,
          }}
        >
          {value.toLocaleString()}
        </Typography>
        {pct !== null && (
          <Typography sx={{ fontSize: 11, color: "text.secondary", ...NUMERIC }}>{pct}%</Typography>
        )}
      </Box>
    </Box>
  );
}

// ---- the proportion bar ----------------------------------------------------

export interface ProportionSegment {
  value: number;
  color: string;
  label: string;
}

// One run's outcome as a single bar plus its own legend.
//
// A 2px surface gap between segments so two adjacent colours never read as one
// blended band, and every segment is labelled with its own count — the bar answers
// "what shape was this run", the legend answers "how many exactly", and neither
// needs the other explained.
export function ProportionBar({
  segments,
  total,
}: {
  segments: ProportionSegment[];
  total: number;
}) {
  if (total === 0) {
    return <Box sx={{ height: 8, borderRadius: 1, bgcolor: "action.hover" }} />;
  }
  const shown = segments.filter((s) => s.value > 0);
  return (
    <Box sx={{ minWidth: 0 }}>
      <Box
        sx={{
          height: 8,
          borderRadius: 1,
          overflow: "hidden",
          display: "flex",
          gap: "2px",
          bgcolor: "action.hover",
        }}
      >
        {shown.map((s) => (
          <Tooltip
            key={s.label}
            title={`${s.label}: ${s.value.toLocaleString()} (${((s.value / total) * 100).toFixed(1)}%)`}
          >
            <Box
              sx={{
                width: `${(s.value / total) * 100}%`,
                bgcolor: s.color,
                transition: "width .5s ease",
              }}
            />
          </Tooltip>
        ))}
      </Box>
      <Box sx={{ display: "flex", gap: 1.5, mt: 0.75, flexWrap: "wrap" }}>
        {shown.map((s) => (
          <Box key={s.label} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Box sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: s.color }} />
            <Typography sx={{ fontSize: 11, color: "text.secondary", fontWeight: 600, ...NUMERIC }}>
              <Box component="span" sx={{ color: "text.primary" }}>
                {s.value.toLocaleString()}
              </Box>{" "}
              {s.label.toLowerCase()}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

// ---- frames and states -----------------------------------------------------

/** A bordered surface holding a table or a list. */
export function Panel({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1.5, overflow: "hidden" }}>
      {children}
    </Box>
  );
}

/** A numbered section heading, for the two schedulers on the Pipelines screen. */
export function NumberedSection({
  index,
  title,
  subtitle,
  children,
}: {
  index: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 1.25, mb: 1.25 }}>
        <Typography
          sx={{ fontSize: 11, fontWeight: 800, color: "text.disabled", ...NUMERIC }}
        >
          {index}
        </Typography>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 15, fontWeight: 800, letterSpacing: "-0.01em" }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography sx={{ fontSize: 12, color: "text.secondary" }}>{subtitle}</Typography>
          )}
        </Box>
      </Box>
      <Panel>
        <Box sx={{ px: 2, py: 1.5 }}>{children}</Box>
      </Panel>
    </Box>
  );
}

export function CrmLoading({ messages }: { messages: readonly string[] }) {
  return (
    <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", py: 3 }}>
      <CircularProgress size={16} />
      <Typography sx={{ fontSize: 13, color: "text.secondary" }}>{messages[0]}</Typography>
    </Stack>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <Typography sx={{ fontSize: 13, color: "text.disabled", textAlign: "center", py: 4 }}>
      {children}
    </Typography>
  );
}

// The paging footer: what you're looking at on the left, the pager on the right.
//
// The range line stays even when there is only one page — "Showing 1–34 of 34" is
// how you know the list isn't truncated, which matters more here than anywhere else
// in Marketing Ops because the un-searched lists are windowed to 30 days.
export function PagingFooter({
  page,
  pageSize,
  total,
  pageCount,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}) {
  if (total === 0) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        mt: 2,
        flexWrap: "wrap",
        gap: 1,
      }}
    >
      <Typography sx={{ fontSize: 12, color: "text.secondary", ...NUMERIC }}>
        Showing {start.toLocaleString()}–{end.toLocaleString()} of {total.toLocaleString()}
      </Typography>
      {pageCount > 1 && (
        <Pagination
          count={pageCount}
          page={page}
          onChange={(_, p) => onPageChange(p)}
          size="small"
          shape="rounded"
          color="primary"
        />
      )}
    </Box>
  );
}
