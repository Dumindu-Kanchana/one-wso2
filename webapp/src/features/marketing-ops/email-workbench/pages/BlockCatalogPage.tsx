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

import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  FormControlLabel,
  IconButton,
  MenuItem,
  OutlinedInput,
  Select,
  Stack,
  Typography,
} from "@wso2/oxygen-ui";
import { ArrowLeft, Pencil, Plus, Trash2 } from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import { MARKETING_OPS_EYEBROW } from "@constants/marketingOpsApps";
import MarketingOpsShell from "../../components/MarketingOpsShell";
import {
  useBlocks,
  useDeleteBlock,
  useSaveBlock,
} from "../../api/useEmailWorkbench";
import type { Block, BlockWrite } from "../emailWorkbenchTypes";

// Marketing Admin → Block catalog: the components the Advanced editor offers.
//
// This is the highest-leverage screen in the whole operation: editing a block's HTML
// changes what the editor inserts into every future email, with no code change or
// redeploy. That's the point — but it's also why the form carries a live preview and
// why `type` is called out as a stable key rather than a label.

const EMPTY: BlockWrite = {
  type: "",
  label: "",
  icon: "",
  category: "simple",
  sort_order: 0,
  hidden: false,
  html: "",
};

const labelSx = {
  fontSize: 11,
  fontWeight: 700,
  color: "text.secondary",
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
  mb: 0.5,
};
const inSx = { fontSize: 13, bgcolor: "background.default" } as const;

// The block HTML is a FRAGMENT, previewed on a white body-width column so layout
// problems (a stray float, say) are visible.
//
// This deliberately does NOT load the email template's chassis CSS — fonts, dark
// mode, button hover/colour classes — because those live in the template, not the
// block. Structure and layout are what this preview is for; the note under it says so.
function previewDoc(html: string): string {
  return `<!doctype html><html><head><meta charset="utf-8">
<style>body{margin:0;background:#fff;} .col{max-width:600px;margin:0 auto;padding:20px;font-family:'Inter',Helvetica,Arial,sans-serif;color:#262626;}</style>
</head><body><div class="col">${html}</div></body></html>`;
}

export default function BlockCatalogPage() {
  const blocks = useBlocks();
  const del = useDeleteBlock();
  const [form, setForm] = useState<{ editing: Block | null } | null>(null);
  const [confirm, setConfirm] = useState<Block | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!confirm) return;
    setError(null);
    try {
      await del.mutateAsync(confirm.id);
      setConfirm(null);
    } catch (e) {
      setError(describeError(e));
    }
  }

  if (form) {
    return (
      <MarketingOpsShell
        eyebrow={MARKETING_OPS_EYEBROW.emailWorkbench}
        title={form.editing ? "Edit block" : "New block"}
        subtitle="The HTML here is inserted verbatim into the email body. Its styling comes from the template's chassis classes, not from this block."
      >
        <BlockForm
          existing={form.editing}
          onCancel={() => setForm(null)}
          onSaved={() => setForm(null)}
        />
      </MarketingOpsShell>
    );
  }

  return (
    <MarketingOpsShell
      eyebrow={MARKETING_OPS_EYEBROW.emailWorkbench}
      title="Block catalog"
      subtitle="The components the Advanced editor offers. Editing a block changes what gets inserted into every future email — no redeploy needed."
    >
      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
        <Button
          onClick={() => setForm({ editing: null })}
          variant="contained"
          startIcon={<Plus size={16} />}
          sx={{ textTransform: "none", fontWeight: 700 }}
        >
          New block
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {blocks.isError ? (
        <Alert severity="error">
          Could not load the block catalog. {describeError(blocks.error)}
        </Alert>
      ) : blocks.isLoading ? (
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", py: 4 }}>
          <CircularProgress size={16} />
          <Typography sx={{ fontSize: 13, color: "text.secondary" }}>Loading blocks…</Typography>
        </Stack>
      ) : (blocks.data ?? []).length === 0 ? (
        <Typography sx={{ fontSize: 14, color: "text.disabled", py: 6, textAlign: "center" }}>
          No blocks yet. Add one to populate the editor palette.
        </Typography>
      ) : (
        <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1.25, overflow: "hidden" }}>
          {(blocks.data ?? []).map((b, i) => (
            <Box
              key={b.id}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                px: 2,
                py: 1.25,
                borderTop: i === 0 ? 0 : 1,
                borderColor: "divider",
                // Hidden blocks are dimmed rather than filtered out — an admin needs
                // to see them to un-hide them.
                opacity: b.hidden ? 0.55 : 1,
              }}
            >
              <Box sx={{ width: 28, textAlign: "center", fontSize: 17 }}>{b.icon || "▫"}</Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{b.label}</Typography>
                <Typography sx={{ fontFamily: "monospace", fontSize: 11.5, color: "text.secondary" }}>
                  {b.type}
                </Typography>
              </Box>
              <Chip label={b.category} size="small" variant="outlined" sx={{ fontSize: 11, height: 20 }} />
              {b.hidden && (
                <Chip label="hidden" size="small" variant="outlined" sx={{ fontSize: 10.5, height: 20 }} />
              )}
              <IconButton
                size="small"
                onClick={() => setForm({ editing: b })}
                aria-label={`Edit ${b.label}`}
              >
                <Pencil size={16} />
              </IconButton>
              <IconButton
                size="small"
                onClick={() => setConfirm(b)}
                aria-label={`Delete ${b.label}`}
                sx={{ "&:hover": { color: "error.main" } }}
              >
                <Trash2 size={16} />
              </IconButton>
            </Box>
          ))}
        </Box>
      )}

      <Dialog
        open={Boolean(confirm)}
        onClose={() => !del.isPending && setConfirm(null)}
        fullWidth
        maxWidth="xs"
      >
        <Box sx={{ px: 3, pt: 3, pb: 1 }}>
          <Typography sx={{ fontSize: 17, fontWeight: 700, color: "error.main", mb: 0.75 }}>
            Delete this block?
          </Typography>
          <Typography sx={{ fontSize: 13, color: "text.secondary", lineHeight: 1.5 }}>
            <Box component="span" sx={{ fontWeight: 700, color: "text.primary" }}>
              {confirm?.label}
            </Box>{" "}
            will be removed from the editor's palette. Emails that already use it keep their content —
            only new insertions are affected.
          </Typography>
        </Box>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button
            onClick={() => setConfirm(null)}
            disabled={del.isPending}
            sx={{ textTransform: "none", color: "text.secondary" }}
          >
            Cancel
          </Button>
          <Button
            onClick={remove}
            disabled={del.isPending}
            variant="contained"
            color="error"
            sx={{ textTransform: "none", fontWeight: 700 }}
          >
            {del.isPending ? "Deleting…" : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </MarketingOpsShell>
  );
}

function BlockForm({
  existing,
  onCancel,
  onSaved,
}: {
  existing: Block | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const save = useSaveBlock();
  // Seeded from the row we were handed rather than re-fetched: the list already has
  // every field the form needs, so opening the editor costs no extra request.
  const [b, setB] = useState<BlockWrite>(() =>
    existing
      ? {
          type: existing.type,
          label: existing.label,
          icon: existing.icon,
          category: existing.category,
          sort_order: existing.sort_order,
          hidden: existing.hidden,
          html: existing.html,
        }
      : EMPTY,
  );
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof BlockWrite>(k: K, v: BlockWrite[K]) =>
    setB((prev) => ({ ...prev, [k]: v }));

  // `type` is an identifier the editor and the AI look blocks up by, so it's
  // constrained to a safe identifier shape rather than free text.
  const validType = /^[A-Za-z][A-Za-z0-9_]*$/.test(b.type.trim());
  const canSave = validType && b.label.trim() !== "" && b.html.trim() !== "" && !save.isPending;

  async function submit() {
    if (!canSave) return;
    setError(null);
    try {
      await save.mutateAsync({
        id: existing?.id,
        body: {
          ...b,
          type: b.type.trim(),
          label: b.label.trim(),
          icon: b.icon.trim(),
          sort_order: Number(b.sort_order) || 0,
        },
      });
      onSaved();
    } catch (e) {
      setError(describeError(e));
    }
  }

  return (
    <Box>
      <Button
        onClick={onCancel}
        startIcon={<ArrowLeft size={16} />}
        sx={{ textTransform: "none", color: "text.secondary", mb: 2 }}
      >
        Block catalog
      </Button>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 3 }}>
        <Box>
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, mb: 2 }}>
            <Box sx={{ gridColumn: "1 / -1" }}>
              <Typography sx={labelSx}>Type (stable key)</Typography>
              <OutlinedInput
                fullWidth
                size="small"
                value={b.type}
                placeholder="e.g. promoBanner"
                onChange={(e) => set("type", e.target.value)}
                error={b.type !== "" && !validType}
                sx={inSx}
              />
              <Typography sx={{ fontSize: 11, color: "text.disabled", mt: 0.5 }}>
                Letters, numbers and underscore; must start with a letter. The editor and the AI fill
                look blocks up by this key — renaming a built-in detaches its AI behaviour.
              </Typography>
            </Box>
            <Box>
              <Typography sx={labelSx}>Label</Typography>
              <OutlinedInput
                fullWidth
                size="small"
                value={b.label}
                placeholder="e.g. Promo banner"
                onChange={(e) => set("label", e.target.value)}
                sx={inSx}
              />
            </Box>
            <Box>
              <Typography sx={labelSx}>Icon</Typography>
              <OutlinedInput
                fullWidth
                size="small"
                value={b.icon}
                placeholder="e.g. ▭ or 📅"
                onChange={(e) => set("icon", e.target.value)}
                sx={inSx}
              />
            </Box>
            <Box>
              <Typography sx={labelSx}>Category</Typography>
              <Select
                fullWidth
                size="small"
                value={b.category}
                onChange={(e) => set("category", String(e.target.value))}
                sx={inSx}
              >
                <MenuItem value="simple">simple</MenuItem>
                <MenuItem value="complex">complex</MenuItem>
              </Select>
            </Box>
            <Box>
              <Typography sx={labelSx}>Sort order</Typography>
              <OutlinedInput
                fullWidth
                size="small"
                type="number"
                value={String(b.sort_order)}
                onChange={(e) => set("sort_order", Number(e.target.value))}
                sx={inSx}
              />
            </Box>
            <Box sx={{ gridColumn: "1 / -1" }}>
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={b.hidden}
                    onChange={(e) => set("hidden", e.target.checked)}
                  />
                }
                label={
                  <Typography sx={{ fontSize: 13 }}>
                    Hidden — not offered in the palette or to the AI fill
                  </Typography>
                }
              />
            </Box>
          </Box>

          <Typography sx={labelSx}>Block HTML</Typography>
          <OutlinedInput
            fullWidth
            multiline
            minRows={14}
            maxRows={26}
            value={b.html}
            placeholder="Paste the block HTML here…"
            onChange={(e) => set("html", e.target.value)}
            sx={{ fontFamily: "monospace", fontSize: 12, bgcolor: "background.default" }}
          />
        </Box>

        <Box>
          <Typography sx={labelSx}>Live preview</Typography>
          <Box
            sx={{
              border: 1,
              borderColor: "divider",
              borderRadius: 1,
              overflow: "hidden",
              height: 520,
              bgcolor: "#fff",
            }}
          >
            <Box
              component="iframe"
              title="Block preview"
              srcDoc={previewDoc(b.html)}
              // Fully restricted. `allow-same-origin` would put admin-authored
              // block HTML in this app's origin; it isn't exploitable while
              // `allow-scripts` is absent, but the two tokens together would hand
              // that HTML our storage and tokens, and a static structure preview
              // needs neither.
              sandbox=""
              sx={{ width: "100%", height: "100%", border: 0 }}
            />
          </Box>
          <Typography sx={{ fontSize: 11, color: "text.disabled", mt: 0.5 }}>
            Renders the raw HTML on a body-width column. It does NOT include the template's chassis
            styles (fonts, dark mode, button colours), so treat this as a structure check.
          </Typography>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mt: 2, fontSize: 13 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: "flex", gap: 1, mt: 2 }}>
        <Button
          onClick={submit}
          disabled={!canSave}
          variant="contained"
          startIcon={save.isPending ? <CircularProgress size={15} color="inherit" /> : undefined}
          sx={{ textTransform: "none", fontWeight: 700 }}
        >
          {existing ? "Save changes" : "Add block"}
        </Button>
        <Button
          onClick={onCancel}
          disabled={save.isPending}
          sx={{ textTransform: "none", color: "text.secondary" }}
        >
          Cancel
        </Button>
      </Box>
    </Box>
  );
}
