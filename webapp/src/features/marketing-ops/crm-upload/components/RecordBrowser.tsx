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

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  IconButton,
  InputAdornment,
  MenuItem,
  OutlinedInput,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { Search, Trash2, X } from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import { useCrmRecords, useDeleteCrmRecord } from "../../api/useCrmUpload";
import type { CrmRecord, RecordKind } from "../crmUploadTypes";
import {
  BatchChip,
  CrmLoading,
  Empty,
  KindChip,
  Panel,
  PagingFooter,
  StatusChip,
} from "./CrmUi";
import {
  CRM_LOADING,
  CRM_STATUS_DESCRIPTIONS,
  NUMERIC,
  RECORD_STATUS_COLOR,
  TH,
  WINDOW_DAYS,
  eyebrow,
  fmtTime,
  primaryBtn,
  quietBtn,
  windowFromDate,
} from "./crmStyles";

// Every record this operation has ingested, and what became of it.
//
// Also embedded in a run's drill-down, where `runId` bounds it to that run's records.
// The two uses differ in one more way than the filter: a drill-down is already a
// bounded set, so it ignores the 30-day window entirely.

const STATUS_TABS = [
  "all",
  "inserted",
  "updated",
  "pending",
  "duplicate",
  "deduplicated",
  "superseded",
  "dismissed",
  "failed",
] as const;
type StatusTab = (typeof STATUS_TABS)[number];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE_SIZE = 50;

const STATUS_TAB_COLOR: Record<StatusTab, string> = {
  all: "text.primary",
  ...RECORD_STATUS_COLOR,
};

/** Which value identifies this record to a human. */
function primaryLabel(record: CrmRecord, kind: RecordKind): string {
  const p = record.payload;
  return kind === "lead" ? String(p.email ?? "—") : String(p.name ?? "—");
}

function kindOf(record: CrmRecord): RecordKind {
  return record.record_type ?? "lead";
}

export default function RecordBrowser({
  type,
  runId,
}: {
  type: "all" | "leads" | "accounts";
  runId?: string;
}) {
  const [search, setSearch] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [batch, setBatch] = useState("");
  const [batchQuery, setBatchQuery] = useState("");
  const [activeStatus, setActiveStatus] = useState<StatusTab>("all");
  const [sourceFilter, setSourceFilter] = useState("");
  const [detail, setDetail] = useState<CrmRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CrmRecord | null>(null);

  // Debounce both text filters into the server query. setState inside the timeout is
  // fine — it's the synchronous-in-an-effect-body form that cascades renders.
  useEffect(() => {
    const id = setTimeout(() => setSearchQuery(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);
  useEffect(() => {
    const id = setTimeout(() => setBatchQuery(batch.trim()), 300);
    return () => clearTimeout(id);
  }, [batch]);

  // Only filter by batch once the input is a COMPLETE uuid. A partial id while typing
  // would flood the view, and the strict query param 422s on it.
  const validBatch = UUID_RE.test(batchQuery);

  // A search or batch filter spans all time; without one, only the recent window.
  const searching = searchQuery.length > 0 || validBatch;
  const windowed = !runId && !searching;

  // Paging is held together with the filter set it belongs to, so narrowing the
  // filters returns to page 1 by DERIVING it — Marketing Ops needed three separate
  // effects for this (one per filter group), each a setState in an effect body.
  const filterKey = JSON.stringify([
    type,
    runId ?? "",
    activeStatus,
    sourceFilter,
    searchQuery,
    validBatch ? batchQuery : "",
  ]);
  const [paging, setPaging] = useState({ key: filterKey, page: 1 });
  const wanted = paging.key === filterKey ? paging.page : 1;
  const setPage = (page: number) => setPaging({ key: filterKey, page });

  const params = useMemo(() => {
    const p = new URLSearchParams({ page: String(wanted), limit: String(PAGE_SIZE) });
    if (type === "leads") p.set("record_type", "lead");
    if (type === "accounts") p.set("record_type", "account");
    if (activeStatus !== "all") p.set("status", activeStatus);
    if (sourceFilter) p.set("source_system", sourceFilter);
    if (searchQuery) p.set("search", searchQuery);
    if (validBatch) p.set("batch_id", batchQuery);
    if (runId) p.set("run_id", runId);
    if (windowed) p.set("from_date", windowFromDate());
    return p;
  }, [
    wanted,
    type,
    activeStatus,
    sourceFilter,
    searchQuery,
    validBatch,
    batchQuery,
    runId,
    windowed,
  ]);

  const query = useCrmRecords(params);
  const data = query.data;

  const records = data?.items ?? [];
  const counts = data?.status_counts ?? {};
  const allCount = Object.values(counts).reduce((s, n) => s + n, 0);

  // Sources are discovered from what came back — there is no endpoint listing them,
  // and one source is not a choice worth showing a control for.
  const sources = [...new Set(records.map((r) => r.source_system))];

  return (
    <Box>
      {/* ---- filters ---------------------------------------------------------- */}
      <Box sx={{ display: "flex", gap: 1, mb: 1.75, flexWrap: "wrap" }}>
        <OutlinedInput
          placeholder={
            type === "accounts" ? "Search company…" : "Search email, name, or company…"
          }
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          size="small"
          startAdornment={
            <InputAdornment position="start">
              <Search size={15} />
            </InputAdornment>
          }
          sx={{ height: 36, fontSize: 13, bgcolor: "background.default", flex: 1, maxWidth: 360 }}
        />
        {sources.length > 1 && (
          <Select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(String(e.target.value))}
            displayEmpty
            size="small"
            sx={{ height: 36, fontSize: 13, minWidth: 160, bgcolor: "background.default" }}
          >
            <MenuItem value="" sx={{ fontSize: 13 }}>
              All sources
            </MenuItem>
            {sources.map((s) => (
              <MenuItem key={s} value={s} sx={{ fontSize: 13 }}>
                {s}
              </MenuItem>
            ))}
          </Select>
        )}
        <OutlinedInput
          placeholder="Filter by batch ID…"
          value={batch}
          onChange={(e) => setBatch(e.target.value)}
          size="small"
          error={batch.trim().length > 0 && !validBatch}
          endAdornment={
            batch ? (
              <InputAdornment position="end">
                <IconButton size="small" aria-label="Clear batch filter" onClick={() => setBatch("")}>
                  <X size={13} />
                </IconButton>
              </InputAdornment>
            ) : undefined
          }
          sx={{
            height: 36,
            fontSize: 12.5,
            ...NUMERIC,
            bgcolor: "background.default",
            flex: 1,
            minWidth: 240,
            maxWidth: 340,
          }}
        />
      </Box>

      {batch.trim().length > 0 && !validBatch && (
        <Typography sx={{ fontSize: 11.5, color: "warning.main", mb: 1, mt: -1 }}>
          Enter a full batch ID (UUID) to filter.
        </Typography>
      )}

      {/* ---- status tabs ------------------------------------------------------
          Each tab carries its own count, and the counts come from the server
          EXCLUDING the status filter — so they say what each tab would show,
          not what the selected one does. */}
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          mb: 2,
          borderTop: 1,
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        {STATUS_TABS.map((s, i) => {
          const active = activeStatus === s;
          const color = STATUS_TAB_COLOR[s];
          const n = s === "all" ? allCount : (counts[s] ?? 0);
          return (
            <Tooltip key={s} title={CRM_STATUS_DESCRIPTIONS[s] ?? ""} placement="top" arrow>
              <Box
                component="button"
                type="button"
                aria-pressed={active}
                onClick={() => setActiveStatus(s)}
                sx={{
                  flex: "1 1 96px",
                  px: 1.5,
                  py: 1,
                  border: 0,
                  borderLeft: i > 0 ? 1 : 0,
                  borderColor: "divider",
                  textAlign: "left",
                  fontFamily: "inherit",
                  cursor: "pointer",
                  position: "relative",
                  bgcolor: active ? "action.selected" : "transparent",
                  transition: "background-color .12s",
                  "&:hover": { bgcolor: active ? "action.selected" : "action.hover" },
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.4 }}>
                  <Box sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: color }} />
                  <Typography sx={{ ...eyebrow, color: active ? color : "text.secondary" }}>
                    {s === "all" ? "All" : s}
                  </Typography>
                </Box>
                <Typography
                  sx={{
                    fontSize: 17,
                    fontWeight: 800,
                    letterSpacing: "-0.03em",
                    lineHeight: 1,
                    color: active ? color : "text.primary",
                    ...NUMERIC,
                  }}
                >
                  {n.toLocaleString()}
                </Typography>
                {active && (
                  <Box
                    sx={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      bottom: -1,
                      height: 2,
                      bgcolor: color,
                    }}
                  />
                )}
              </Box>
            </Tooltip>
          );
        })}
      </Box>

      {/* The window is stated rather than implied — a list that quietly stops at 30
          days looks like a list of everything. */}
      {!runId && (
        <Typography sx={{ fontSize: 12, color: "text.secondary", mb: 1.5 }}>
          {searching
            ? "Searching all records, regardless of date."
            : `Showing records from the last ${WINDOW_DAYS} days. Use search to find older records.`}
        </Typography>
      )}

      {/* ---- the table -------------------------------------------------------- */}
      {query.isError ? (
        <Alert severity="error">Could not load records. {describeError(query.error)}</Alert>
      ) : !data ? (
        <CrmLoading messages={CRM_LOADING.records} />
      ) : records.length === 0 ? (
        // Two different nothings. An empty page while the total says otherwise means
        // the list shrank under us — say so and offer the way back, rather than
        // reporting "no records" about a filter that plainly matches some.
        data.total > 0 ? (
          <Box sx={{ textAlign: "center", py: 4 }}>
            <Typography sx={{ fontSize: 13, color: "text.disabled", mb: 1 }}>
              This page is empty — the list changed while you were on it.
            </Typography>
            <Button size="small" onClick={() => setPage(Math.max(data.pages, 1))} sx={quietBtn}>
              Go to the last page
            </Button>
          </Box>
        ) : (
          <Empty>No records found</Empty>
        )
      ) : (
        <Panel>
          <Table size="small">
            <TableHead>
              <TableRow>
                {type === "all" && <TableCell sx={TH}>Type</TableCell>}
                <TableCell sx={TH}>
                  {type === "accounts" ? "Company" : type === "leads" ? "Email" : "Identifier"}
                </TableCell>
                <TableCell sx={TH}>Source</TableCell>
                <TableCell sx={TH}>Status</TableCell>
                <TableCell sx={TH}>Created</TableCell>
                <TableCell align="right" sx={{ ...TH, width: 44 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {records.map((r) => {
                const kind = kindOf(r);
                const p = r.payload;
                // Queued or syncing records are the scheduler's, not a reviewer's.
                const busy = r.status === "pending" || r.status === "processing";
                return (
                  <TableRow key={`${kind}-${r.id}`} hover>
                    {type === "all" && (
                      <TableCell>
                        <KindChip kind={kind} />
                      </TableCell>
                    )}
                    <TableCell>
                      <Box
                        component="button"
                        type="button"
                        onClick={() => setDetail(r)}
                        sx={{
                          border: 0,
                          p: 0,
                          bgcolor: "transparent",
                          textAlign: "left",
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
                          {primaryLabel(r, kind)}
                        </Typography>
                        {kind === "lead" && (Boolean(p.firstName) || Boolean(p.lastName)) && (
                          <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>
                            {[p.firstName, p.lastName].filter(Boolean).map(String).join(" ")}
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: 12 }}>{r.source_system}</Typography>
                    </TableCell>
                    <TableCell>
                      <StatusChip status={r.status} error={r.error_message} />
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: 12, color: "text.secondary", ...NUMERIC }}>
                        {fmtTime(r.created_at)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ width: 44 }}>
                      <Tooltip
                        title={busy ? "Queued or syncing — can't delete yet" : "Delete record"}
                        arrow
                        placement="top"
                      >
                        <span>
                          <IconButton
                            size="small"
                            aria-label={`Delete ${primaryLabel(r, kind)}`}
                            disabled={busy}
                            onClick={() => setDeleteTarget(r)}
                            sx={{ color: "text.secondary", "&:hover": { color: "error.main" } }}
                          >
                            <Trash2 size={15} />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Panel>
      )}

      {data && (
        <PagingFooter
          page={Math.min(wanted, Math.max(data.pages, 1))}
          pageSize={PAGE_SIZE}
          total={data.total}
          pageCount={data.pages}
          onPageChange={setPage}
        />
      )}

      {detail && (
        <RecordDetailDialog
          record={detail}
          onClose={() => setDetail(null)}
          onFilterBatch={(b) => {
            // Jump to this batch: set the filter, drop the status narrowing so every
            // member of the batch shows, and close.
            setBatch(b);
            setBatchQuery(b);
            setActiveStatus("all");
            setDetail(null);
          }}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmDialog
          record={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => {
            // If that was the only row on this page, the page no longer exists — step
            // back before the refetch lands, so nobody sees an empty table.
            if (records.length === 1 && wanted > 1) setPage(wanted - 1);
            setDeleteTarget(null);
          }}
        />
      )}
    </Box>
  );
}

// ---- the record detail -----------------------------------------------------

function renderPayloadValue(v: unknown) {
  if (v === null || v === undefined || v === "") {
    return (
      <Typography
        component="span"
        sx={{ color: "text.disabled", fontStyle: "italic", fontSize: 13 }}
      >
        —
      </Typography>
    );
  }
  if (typeof v === "object") {
    return (
      <Box
        component="pre"
        sx={{
          fontFamily: "inherit",
          fontSize: 12,
          m: 0,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {JSON.stringify(v, null, 2)}
      </Box>
    );
  }
  return (
    <Typography component="span" sx={{ fontSize: 13, ...NUMERIC }}>
      {String(v)}
    </Typography>
  );
}

// The whole payload, as it arrived. Deliberately unformatted beyond key/value: this is
// the record of what the source system actually sent, and prettying it up would hide
// the difference between an empty string and a missing field.
function RecordDetailDialog({
  record,
  onClose,
  onFilterBatch,
}: {
  record: CrmRecord;
  onClose: () => void;
  onFilterBatch: (batchId: string) => void;
}) {
  const kind = kindOf(record);
  const entries = Object.entries(record.payload);

  return (
    <Dialog open fullWidth maxWidth="md" onClose={onClose}>
      <Box sx={{ px: 3, pt: 3, pb: 2.5, borderBottom: 1, borderColor: "divider" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5, flexWrap: "wrap" }}>
          <KindChip kind={kind} />
          <StatusChip status={record.status} />
          {record.batch_id && (
            <BatchChip batchId={record.batch_id} onClick={() => onFilterBatch(record.batch_id!)} />
          )}
          <Typography sx={{ fontSize: 11.5, color: "text.secondary", fontWeight: 600, ...NUMERIC }}>
            {record.source_system} · {fmtTime(record.created_at)}
          </Typography>
        </Box>
        <Typography sx={{ fontSize: 19, fontWeight: 800, letterSpacing: "-0.02em" }}>
          {primaryLabel(record, kind)}
        </Typography>
        {record.error_message && (
          <Typography
            sx={{ fontSize: 12.5, color: "error.main", mt: 1, whiteSpace: "pre-wrap" }}
          >
            {record.error_message}
          </Typography>
        )}
      </Box>

      <DialogContent sx={{ px: 0, py: 0 }}>
        {entries.length === 0 ? (
          <Empty>No payload data</Empty>
        ) : (
          <Table size="small">
            <TableBody>
              {entries.map(([key, value]) => (
                <TableRow key={key}>
                  <TableCell
                    sx={{
                      fontWeight: 600,
                      fontSize: 12,
                      color: "text.secondary",
                      width: 220,
                      verticalAlign: "top",
                    }}
                  >
                    {key}
                  </TableCell>
                  <TableCell>{renderPayloadValue(value)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={quietBtn}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ---- deleting one record ---------------------------------------------------

// A hard delete with a required reason. The reason goes to the audit log and never to
// the record, because the record is what's being erased — this exists for
// data-subject erasure requests, and the log has to survive the data.
function DeleteConfirmDialog({
  record,
  onClose,
  onDeleted,
}: {
  record: CrmRecord;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const del = useDeleteCrmRecord();

  const kind = kindOf(record);
  const label = primaryLabel(record, kind);

  async function remove() {
    setError(null);
    try {
      await del.mutateAsync({ recordType: kind, id: record.id, reason: reason.trim() });
      onDeleted();
    } catch (e) {
      setError(describeError(e));
    }
  }

  return (
    <Dialog open fullWidth maxWidth="xs" onClose={del.isPending ? undefined : onClose}>
      <Box sx={{ px: 3, pt: 3, pb: 0.5 }}>
        <Typography
          sx={{ fontSize: 17, fontWeight: 800, letterSpacing: "-0.01em", mb: 0.75 }}
        >
          Delete this record?
        </Typography>
        <Typography sx={{ fontSize: 13, color: "text.secondary", lineHeight: 1.5 }}>
          You're about to permanently delete{" "}
          <Box component="span" sx={{ fontWeight: 700, color: "text.primary" }}>
            {label}
          </Box>{" "}
          ({kind}). This erases the record and its data from this platform and cannot be undone.{" "}
          <Box component="span" sx={{ fontWeight: 700 }}>
            It does not delete anything from Salesforce.
          </Box>
        </Typography>
      </Box>
      <DialogContent sx={{ px: 3, py: 2 }}>
        <Typography sx={{ ...eyebrow, mb: 0.75 }}>
          Reason <Box component="span" sx={{ color: "error.main" }}>*</Box>
        </Typography>
        <TextField
          autoFocus
          fullWidth
          size="small"
          multiline
          minRows={2}
          placeholder="e.g. data-subject erasure request — TICKET-123"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          slotProps={{ htmlInput: { maxLength: 500 } }}
          sx={{ "& .MuiOutlinedInput-root": { fontSize: 13, bgcolor: "background.default" } }}
        />
        {error && (
          <Alert severity="error" sx={{ mt: 1.5, fontSize: 12.5 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={del.isPending} sx={quietBtn}>
          Cancel
        </Button>
        <Button
          onClick={() => void remove()}
          disabled={del.isPending || reason.trim().length === 0}
          variant="contained"
          color="error"
          startIcon={
            del.isPending ? <CircularProgress size={14} color="inherit" /> : <Trash2 size={16} />
          }
          sx={primaryBtn}
        >
          Delete permanently
        </Button>
      </DialogActions>
    </Dialog>
  );
}
