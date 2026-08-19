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

import { useMemo, useRef, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  OutlinedInput,
  Stack,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { ArrowLeft, Image as ImageIcon } from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import {
  useSaveTemplate,
  useTemplate,
  useTemplateCategories,
} from "../../api/useEmailWorkbench";
import { FullImagePreview } from "./Thumbnail";

// Add / edit a stored template: name, category, the raw HTML, and a thumbnail.
//
// The category field is a free-text Autocomplete rather than a fixed select on
// purpose — it suggests existing values so the taxonomy stays tidy, but a new
// category can be introduced without a code change or a migration.
//
// On EDIT, leaving the thumbnail untouched keeps the existing image. That's why
// `thumbnail_data_url` is omitted rather than sent empty when unchanged; an empty
// string would clear the stored image.

const labelSx = {
  fontSize: 11,
  fontWeight: 700,
  color: "text.secondary",
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
  mb: 0.5,
};

// 1 MB, matching the backend's limit. Checked client-side so a too-large image is
// rejected before it's base64-encoded (which inflates it by ~33%) and before the
// request goes out.
const MAX_THUMB_BYTES = 1024 * 1024;

export default function TemplateForm({
  editId,
  onCancel,
  onSaved,
}: {
  editId: string | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const existing = useTemplate(editId);
  const categories = useTemplateCategories();
  const save = useSaveTemplate();

  // Local edits, seeded from the loaded template but held separately so a
  // background refetch can't discard in-progress typing (same reasoning as the
  // Marketing Admin panels).
  const [edits, setEdits] = useState<{ name?: string; category?: string; html?: string }>({});
  const [thumbDataUrl, setThumbDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const name = edits.name ?? existing.data?.name ?? "";
  const category = edits.category ?? existing.data?.category ?? "";
  const html = edits.html ?? existing.data?.html ?? "";

  const categoryOptions = useMemo(
    () => Array.from(new Set(categories.data ?? [])),
    [categories.data],
  );

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_THUMB_BYTES) {
      setError(`That image is ${Math.round(file.size / 1024)} KB — the limit is 1 MB.`);
      e.target.value = "";
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = () => setThumbDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  }

  const canSave = Boolean(name.trim() && category.trim() && html.trim()) && !save.isPending;

  async function submit() {
    if (!canSave) return;
    setError(null);
    try {
      await save.mutateAsync({
        id: editId ?? undefined,
        body: {
          name: name.trim(),
          category: category.trim(),
          html,
          ...(thumbDataUrl ? { thumbnail_data_url: thumbDataUrl } : {}),
        },
      });
      onSaved();
    } catch (e) {
      setError(describeError(e));
    }
  }

  if (editId && existing.isLoading) {
    return (
      <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", py: 4 }}>
        <CircularProgress size={16} />
        <Typography sx={{ fontSize: 13, color: "text.secondary" }}>Loading template…</Typography>
      </Stack>
    );
  }

  if (editId && existing.isError) {
    return (
      <Alert severity="error">
        Could not load this template. {describeError(existing.error)}
      </Alert>
    );
  }

  return (
    <Box sx={{ maxWidth: 880 }}>
      <Button
        onClick={onCancel}
        startIcon={<ArrowLeft size={16} />}
        sx={{ textTransform: "none", color: "text.secondary", mb: 1 }}
      >
        Library
      </Button>
      <Typography sx={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", mb: 2 }}>
        {editId ? "Edit template" : "New template"}
      </Typography>

      <Box sx={{ mb: 2 }}>
        <Typography sx={labelSx}>Name</Typography>
        <OutlinedInput
          fullWidth
          size="small"
          value={name}
          placeholder="e.g. Banking Innovation Forum"
          onChange={(e) => setEdits((s) => ({ ...s, name: e.target.value }))}
          sx={{ fontSize: 14, bgcolor: "background.default" }}
        />
      </Box>

      <Box sx={{ mb: 2 }}>
        <Typography sx={labelSx}>Type (category)</Typography>
        <Autocomplete
          freeSolo
          options={categoryOptions}
          value={category}
          onInputChange={(_, v) => setEdits((s) => ({ ...s, category: v }))}
          renderInput={(p) => (
            <TextField {...p} size="small" placeholder="e.g. General Email" sx={{ fontSize: 14 }} />
          )}
        />
      </Box>

      <Box sx={{ mb: 2 }}>
        <Typography sx={labelSx}>Thumbnail</Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
          <Box
            sx={{
              width: 140,
              height: 92,
              borderRadius: 1,
              border: 1,
              borderStyle: "dashed",
              borderColor: "divider",
              // White, like the gallery tiles — this previews an email, not chrome.
              bgcolor: "#fff",
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {thumbDataUrl ? (
              <Box
                component="img"
                src={thumbDataUrl}
                alt=""
                sx={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }}
              />
            ) : editId && existing.data?.has_thumbnail ? (
              // Reuses the gallery's cached object URL rather than re-fetching.
              <Box sx={{ width: 140, "& > *": { width: "100% !important" } }}>
                <FullImagePreview id={editId} version={existing.data.updated_at} />
              </Box>
            ) : (
              <Box sx={{ color: "#9aa0a6", display: "inline-flex" }}>
                <ImageIcon size={24} />
              </Box>
            )}
          </Box>
          <Box>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              hidden
              onChange={onFile}
            />
            <Button
              onClick={() => fileRef.current?.click()}
              variant="outlined"
              size="small"
              sx={{ textTransform: "none", fontWeight: 600 }}
            >
              {thumbDataUrl ? "Replace image" : "Upload image"}
            </Button>
            <Typography sx={{ fontSize: 11, color: "text.disabled", mt: 0.75 }}>
              PNG / JPEG / WebP / GIF, up to 1 MB.
              {editId ? " Leave empty to keep the current image." : ""}
            </Typography>
          </Box>
        </Box>
      </Box>

      <Box sx={{ mb: 2 }}>
        <Typography sx={labelSx}>Template HTML</Typography>
        <OutlinedInput
          fullWidth
          multiline
          minRows={12}
          maxRows={22}
          value={html}
          placeholder="Paste the approved template HTML here…"
          onChange={(e) => setEdits((s) => ({ ...s, html: e.target.value }))}
          sx={{ fontFamily: "monospace", fontSize: 12, bgcolor: "background.default" }}
        />
        <Typography sx={{ fontSize: 11, color: "text.disabled", mt: 0.5 }}>
          Stored and re-served verbatim — the editor mutates this markup in place and never
          re-serialises it, so a template opened and saved unchanged stays byte-identical.
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2, fontSize: 13 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: "flex", gap: 1 }}>
        <Button
          onClick={submit}
          disabled={!canSave}
          variant="contained"
          startIcon={save.isPending ? <CircularProgress size={15} color="inherit" /> : undefined}
          sx={{ textTransform: "none", fontWeight: 700 }}
        >
          {editId ? "Save changes" : "Add template"}
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
