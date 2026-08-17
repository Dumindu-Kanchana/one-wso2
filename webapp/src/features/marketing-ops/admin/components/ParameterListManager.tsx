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
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  FormControlLabel,
  IconButton,
  OutlinedInput,
  Radio,
  RadioGroup,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import {
  ChevronDown,
  ChevronUp,
  ClipboardPaste,
  Plus,
  Trash2,
  Undo2,
} from "@wso2/oxygen-ui-icons-react";
import { serializeRows, type PListRow } from "./parameterRows";

// Editor for ONE parameter list (1 or 2 columns).
//
// CONTROLLED on purpose: the parent panel owns `rows` (the working copy) and
// `baseline` (last saved). That's what lets edits survive switching between
// lists in the master-detail nav, and lets the nav show which lists have
// unsaved work. A self-contained editor would lose both.
//
// The consequential part is `onSave`: these lists drive live campaign tracking
// and Salesforce/Pardot reporting, and the API call is a whole-list REPLACE.
// So saving always goes through a confirmation that spells out exactly what
// changes — added, removed, updated, reordered. A blind "Save" button on a
// replace-semantics endpoint is how someone silently deletes a value another
// admin added ten minutes ago.

const norm = (s: string) => s.trim().toLowerCase();

// Parse pasted spreadsheet text into rows (tab- or comma-separated, one row per
// line). Tab first because that's what a real spreadsheet copy produces; comma
// is the fallback for hand-typed or CSV-ish input.
function parsePaste(text: string, nCols: number): PListRow[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      let parts = line.split("\t");
      if (parts.length < nCols) parts = line.split(/\t|,/);
      const cols = Array.from({ length: nCols }, (_, i) => (parts[i] ?? "").trim());
      // Two-column list pasted as one column: mirror the label into the code.
      // Pasting a bare list of labels is common, and an empty code would fail
      // validation on every row — this makes the obvious intent work.
      if (nCols === 2 && cols[1] === "" && cols[0] !== "") cols[1] = cols[0];
      return { cols, enabled: true };
    });
}

interface Diff {
  added: PListRow[];
  removed: PListRow[];
  changed: { from: PListRow; to: PListRow }[];
  reordered: boolean;
}

// Diff keyed on the FIRST column, case-insensitively — that's the human
// identifier (a label, or the value itself), and it's what an admin recognises
// in the review dialog. Renaming a label therefore reads as a remove plus an
// add, which is honest: to the consumers, that's exactly what it is.
function computeDiff(baseline: PListRow[], rows: PListRow[]): Diff {
  const bMap = new Map(baseline.map((r) => [norm(r.cols[0]), r]));
  const cMap = new Map(rows.map((r) => [norm(r.cols[0]), r]));
  const added = rows.filter((r) => r.cols[0].trim() && !bMap.has(norm(r.cols[0])));
  const removed = baseline.filter((r) => !cMap.has(norm(r.cols[0])));
  const changed: { from: PListRow; to: PListRow }[] = [];
  for (const r of rows) {
    const b = bMap.get(norm(r.cols[0]));
    if (!b) continue;
    const colsDiff = r.cols.slice(1).join("") !== b.cols.slice(1).join("");
    if (colsDiff || r.enabled !== b.enabled) changed.push({ from: b, to: r });
  }
  // Order comparison restricted to rows present on BOTH sides, so an add or a
  // delete doesn't also get reported as a reorder.
  const sharedB = baseline.map((r) => norm(r.cols[0])).filter((k) => cMap.has(k));
  const sharedC = rows.map((r) => norm(r.cols[0])).filter((k) => bMap.has(k));
  const reordered = sharedB.join("|") !== sharedC.join("|");
  return { added, removed, changed, reordered };
}

export default function ParameterListManager({
  title,
  columns,
  rows,
  baseline,
  onChange,
  onSave,
}: {
  title: string;
  columns: string[];
  rows: PListRow[];
  baseline: PListRow[];
  onChange: (rows: PListRow[]) => void;
  onSave: (rows: PListRow[]) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importMode, setImportMode] = useState<"replace" | "append">("replace");

  const dirty = serializeRows(rows) !== serializeRows(baseline);
  const label = (r: PListRow) => (columns.length === 2 ? `${r.cols[0]} (${r.cols[1]})` : r.cols[0]);

  // Blocking problems, shown inline and gating Save. These aren't style
  // preferences: a blank value renders an unselectable dropdown entry, and a
  // duplicate label makes two rows indistinguishable to whoever picks from it.
  const issues = useMemo(() => {
    const out: string[] = [];
    if (rows.some((r) => !r.cols[0].trim())) out.push("Remove blank rows.");
    if (columns.length === 2 && rows.some((r) => r.cols[0].trim() && !r.cols[1].trim())) {
      out.push(`Fill in every ${columns[1]}.`);
    }
    const seen = new Set<string>();
    const dup = new Set<string>();
    for (const r of rows) {
      const k = norm(r.cols[0]);
      if (!k) continue;
      if (seen.has(k)) dup.add(r.cols[0].trim());
      seen.add(k);
    }
    if (dup.size) {
      out.push(
        `Duplicate ${columns[0]}: ${[...dup].slice(0, 5).join(", ")}${dup.size > 5 ? "…" : ""}.`,
      );
    }
    return out;
  }, [rows, columns]);

  const diff = useMemo(() => computeDiff(baseline, rows), [baseline, rows]);
  const canSave = dirty && issues.length === 0 && !saving;

  const setCol = (i: number, c: number, v: string) =>
    onChange(
      rows.map((r, idx) =>
        idx === i ? { ...r, cols: r.cols.map((x, j) => (j === c ? v : x)) } : r,
      ),
    );
  const toggle = (i: number) =>
    onChange(rows.map((r, idx) => (idx === i ? { ...r, enabled: !r.enabled } : r)));
  const del = (i: number) => onChange(rows.filter((_, idx) => idx !== i));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= rows.length) return;
    const c = rows.slice();
    [c[i], c[j]] = [c[j], c[i]];
    onChange(c);
  };
  const addRow = () => onChange([...rows, { cols: columns.map(() => ""), enabled: true }]);

  const parsed = useMemo(() => parsePaste(importText, columns.length), [importText, columns.length]);
  const importPreview = useMemo(() => {
    const cur = new Set(rows.map((r) => norm(r.cols[0])));
    const inc = new Set(parsed.map((r) => norm(r.cols[0])));
    return {
      total: parsed.length,
      added: parsed.filter((r) => !cur.has(norm(r.cols[0]))).length,
      removed: importMode === "replace" ? rows.filter((r) => !inc.has(norm(r.cols[0]))).length : 0,
    };
  }, [parsed, rows, importMode]);

  const applyImport = () => {
    if (importMode === "replace") {
      onChange(parsed);
    } else {
      const cur = new Set(rows.map((r) => norm(r.cols[0])));
      onChange([...rows, ...parsed.filter((r) => !cur.has(norm(r.cols[0])))]);
    }
    setImportOpen(false);
    setImportText("");
    setImportMode("replace");
  };

  // An import only STAGES rows into the working copy — it never writes. The
  // admin still goes through Review & save, so a bad paste is one Discard away
  // from gone rather than already live.
  async function doSave() {
    setSaving(true);
    setError(null);
    try {
      await onSave(rows.map((r) => ({ ...r, cols: r.cols.map((c) => c.trim()) })));
      setConfirmOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  const inSx = { fontSize: 13, bgcolor: "background.default" } as const;

  return (
    <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1.5, bgcolor: "background.paper", p: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.25, flexWrap: "wrap" }}>
        <Typography sx={{ fontSize: 15, fontWeight: 800, letterSpacing: "-0.01em", flex: 1, minWidth: 0 }}>
          {title}
        </Typography>
        <Typography sx={{ fontSize: 11, color: "text.disabled" }}>
          {rows.filter((r) => r.enabled).length}/{rows.length} active
        </Typography>
        <Button
          onClick={() => setImportOpen(true)}
          startIcon={<ClipboardPaste size={15} />}
          sx={{ textTransform: "none", fontSize: 12, color: "text.secondary" }}
        >
          Paste from sheet
        </Button>
      </Box>

      <Box sx={{ display: "flex", gap: 1, px: 0.5, mb: 0.5 }}>
        {columns.map((c) => (
          <Typography
            key={c}
            sx={{
              flex: 1,
              fontSize: 9.5,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "text.disabled",
            }}
          >
            {c}
          </Typography>
        ))}
        <Box sx={{ width: 150, flexShrink: 0 }} />
      </Box>

      {rows.map((r, i) => (
        // Keyed by index because these rows have no stable client-side identity:
        // new rows have no id, and reorder/delete shuffle positions. The inputs
        // are fully controlled from `rows`, so an index key can't strand state.
        <Box
          key={i}
          sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.6, opacity: r.enabled ? 1 : 0.5 }}
        >
          {r.cols.map((v, c) => (
            <OutlinedInput
              key={c}
              size="small"
              fullWidth
              value={v}
              aria-label={`${columns[c]} for row ${i + 1}`}
              onChange={(e) => setCol(i, c, e.target.value)}
              sx={{ ...inSx, flex: 1 }}
            />
          ))}
          <Box
            sx={{
              width: 150,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
            }}
          >
            <Tooltip
              title={r.enabled ? "Enabled — uncheck to retire" : "Disabled (hidden from the tool)"}
              arrow
            >
              <Checkbox
                size="small"
                checked={r.enabled}
                onChange={() => toggle(i)}
                inputProps={{ "aria-label": `Enable ${r.cols[0] || `row ${i + 1}`}` }}
              />
            </Tooltip>
            <IconButton
              size="small"
              disabled={i === 0}
              onClick={() => move(i, -1)}
              aria-label={`Move ${r.cols[0] || `row ${i + 1}`} up`}
              sx={{ color: "text.secondary" }}
            >
              <ChevronUp size={17} />
            </IconButton>
            <IconButton
              size="small"
              disabled={i === rows.length - 1}
              onClick={() => move(i, 1)}
              aria-label={`Move ${r.cols[0] || `row ${i + 1}`} down`}
              sx={{ color: "text.secondary" }}
            >
              <ChevronDown size={17} />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => del(i)}
              aria-label={`Remove ${r.cols[0] || `row ${i + 1}`}`}
              sx={{ color: "text.secondary", "&:hover": { color: "error.main" } }}
            >
              <Trash2 size={16} />
            </IconButton>
          </Box>
        </Box>
      ))}

      <Button
        onClick={addRow}
        startIcon={<Plus size={16} />}
        sx={{ textTransform: "none", fontSize: 12.5, mt: 0.5 }}
      >
        Add value
      </Button>

      {issues.length > 0 && (
        <Alert severity="warning" sx={{ mt: 1, fontSize: 12 }}>
          {issues.join(" ")}
        </Alert>
      )}

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          mt: 1.5,
          pt: 1.5,
          borderTop: 1,
          borderColor: "divider",
          flexWrap: "wrap",
        }}
      >
        <Button
          onClick={() => setConfirmOpen(true)}
          disabled={!canSave}
          variant="contained"
          sx={{ textTransform: "none", fontWeight: 700, fontSize: 13 }}
        >
          Review &amp; save
        </Button>
        <Button
          onClick={() => onChange(baseline)}
          disabled={!dirty || saving}
          startIcon={<Undo2 size={15} />}
          sx={{ textTransform: "none", fontSize: 12.5, color: "text.secondary" }}
        >
          Discard changes
        </Button>
        <Typography
          sx={{
            fontSize: 12,
            fontWeight: dirty ? 600 : 400,
            color: dirty ? "primary.main" : "text.disabled",
          }}
        >
          {dirty ? "Unsaved changes" : "All changes saved"}
        </Typography>
      </Box>

      <ImportDialog
        open={importOpen}
        title={title}
        columns={columns}
        text={importText}
        mode={importMode}
        preview={importPreview}
        parsedCount={parsed.length}
        onText={setImportText}
        onMode={setImportMode}
        onClose={() => setImportOpen(false)}
        onApply={applyImport}
      />

      <ConfirmDialog
        open={confirmOpen}
        title={title}
        columns={columns}
        diff={diff}
        label={label}
        saving={saving}
        error={error}
        onClose={() => !saving && setConfirmOpen(false)}
        onConfirm={doSave}
      />
    </Box>
  );
}

function ImportDialog({
  open,
  title,
  columns,
  text,
  mode,
  preview,
  parsedCount,
  onText,
  onMode,
  onClose,
  onApply,
}: {
  open: boolean;
  title: string;
  columns: string[];
  text: string;
  mode: "replace" | "append";
  preview: { total: number; added: number; removed: number };
  parsedCount: number;
  onText: (v: string) => void;
  onMode: (v: "replace" | "append") => void;
  onClose: () => void;
  onApply: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <Box sx={{ p: 3 }}>
        <Typography sx={{ fontSize: 16, fontWeight: 800, mb: 0.5 }}>
          Paste values — {title}
        </Typography>
        <Typography sx={{ fontSize: 12.5, color: "text.secondary", mb: 1.5 }}>
          Paste rows from a spreadsheet (one per line
          {columns.length === 2 ? `; two columns: ${columns[0]} then ${columns[1]}` : ""}). Nothing
          is saved until you review the change summary.
        </Typography>
        <OutlinedInput
          fullWidth
          multiline
          minRows={6}
          maxRows={14}
          autoFocus
          value={text}
          onChange={(e) => onText(e.target.value)}
          placeholder={columns.length === 2 ? "ChatGPT\tgpt\nLinkedIn\tli" : "APAC\nEU\nNA"}
          sx={{ fontFamily: "monospace", fontSize: 12.5, bgcolor: "background.default", mb: 1.5 }}
        />
        <RadioGroup row value={mode} onChange={(e) => onMode(e.target.value as "replace" | "append")}>
          <FormControlLabel
            value="replace"
            control={<Radio size="small" />}
            label={<Typography sx={{ fontSize: 13 }}>Replace all</Typography>}
          />
          <FormControlLabel
            value="append"
            control={<Radio size="small" />}
            label={<Typography sx={{ fontSize: 13 }}>Append new</Typography>}
          />
        </RadioGroup>
        {text.trim() && (
          <Alert severity="info" icon={false} sx={{ mt: 1, fontSize: 12 }}>
            {preview.total} parsed · <b>{preview.added}</b> new
            {mode === "replace" && preview.removed > 0 ? (
              <>
                {" "}
                · <b>{preview.removed}</b> removed
              </>
            ) : null}
          </Alert>
        )}
      </Box>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} sx={{ textTransform: "none", color: "text.secondary" }}>
          Cancel
        </Button>
        <Button
          onClick={onApply}
          disabled={!parsedCount}
          variant="contained"
          sx={{ textTransform: "none", fontWeight: 700 }}
        >
          {mode === "replace" ? "Stage replacement" : "Stage additions"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ConfirmDialog({
  open,
  title,
  columns,
  diff,
  label,
  saving,
  error,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  columns: string[];
  diff: Diff;
  label: (r: PListRow) => string;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const nothing =
    !diff.added.length && !diff.removed.length && !diff.changed.length && !diff.reordered;
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <Box sx={{ p: 3 }}>
        <Typography sx={{ fontSize: 16, fontWeight: 800, mb: 0.5 }}>
          Review changes — {title}
        </Typography>
        <Typography sx={{ fontSize: 12.5, color: "text.secondary", mb: 1.5 }}>
          These changes save immediately and the generators pick them up on their next load.
        </Typography>
        <Box sx={{ maxHeight: 320, overflowY: "auto" }}>
          <ChangeList colour="success.main" sign="+" head="Added" items={diff.added.map(label)} />
          <ChangeList colour="error.main" sign="−" head="Removed" items={diff.removed.map(label)} />
          <ChangeList
            colour="primary.main"
            sign="~"
            head="Updated"
            items={diff.changed.map(({ from, to }) => {
              const bits: string[] = [];
              if (columns.length === 2 && from.cols[1] !== to.cols[1]) {
                bits.push(`${columns[1].toLowerCase()} ${from.cols[1]} → ${to.cols[1]}`);
              }
              if (from.enabled !== to.enabled) bits.push(to.enabled ? "enabled" : "disabled");
              return `${to.cols[0]}${bits.length ? ` — ${bits.join(", ")}` : ""}`;
            })}
          />
          {diff.reordered && (
            <Typography sx={{ fontSize: 13, color: "text.secondary", mt: 0.5 }}>
              • Order changed
            </Typography>
          )}
          {nothing && (
            <Typography sx={{ fontSize: 13, color: "text.disabled" }}>No changes.</Typography>
          )}
        </Box>
        {error && (
          <Alert severity="error" sx={{ mt: 1.5, fontSize: 12.5 }}>
            {error}
          </Alert>
        )}
      </Box>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button
          onClick={onClose}
          disabled={saving}
          sx={{ textTransform: "none", color: "text.secondary" }}
        >
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          disabled={saving}
          variant="contained"
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : undefined}
          sx={{ textTransform: "none", fontWeight: 700 }}
        >
          {saving ? "Saving…" : "Confirm & save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ChangeList({
  colour,
  sign,
  head,
  items,
}: {
  colour: string;
  sign: string;
  head: string;
  items: string[];
}) {
  if (!items.length) return null;
  return (
    <Box sx={{ mb: 1 }}>
      <Typography
        sx={{
          fontSize: 10,
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: colour,
          mb: 0.25,
        }}
      >
        {head} ({items.length})
      </Typography>
      {items.map((it, i) => (
        <Typography
          key={i}
          sx={{ fontSize: 13, color: "text.secondary", display: "flex", gap: 0.75 }}
        >
          <Box component="span" sx={{ color: colour, fontWeight: 700, width: 10, flexShrink: 0 }}>
            {sign}
          </Box>
          {it}
        </Typography>
      ))}
    </Box>
  );
}
