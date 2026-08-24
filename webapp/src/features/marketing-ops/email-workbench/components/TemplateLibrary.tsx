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
  CircularProgress,
  Dialog,
  DialogActions,
  IconButton,
  Popover,
  Stack,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { ArrowRight, Eye, Pencil, Plus, Trash2 } from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import { useDeleteTemplate, useTemplates } from "../../api/useEmailWorkbench";
import type { TemplateSummary } from "../emailWorkbenchTypes";
import { FullImagePreview, Thumbnail } from "./Thumbnail";

// The template catalog. Two modes over one grid:
//
//   compose  a read-only picker — clicking a card means "use this template" and
//            opens the editor. No create / edit / delete.
//   manage   the admin catalog — a New template action plus per-card edit-details
//            and delete. Clicking a card means "edit this template's details".
//
// The mode changes what a click MEANS, which is why `onCard` is resolved once up
// front rather than branched at each call site.

type Mode = "compose" | "manage";

interface Grouped {
  category: string;
  items: TemplateSummary[];
}

// Group by category, preserving the order the API returned rather than sorting —
// the backend controls presentation order and the filter chips are built from the
// same list, so both stay consistent.
function group(templates: TemplateSummary[]): Grouped[] {
  const out: Grouped[] = [];
  for (const t of templates) {
    let cat = out.find((c) => c.category === t.category);
    if (!cat) {
      cat = { category: t.category, items: [] };
      out.push(cat);
    }
    cat.items.push(t);
  }
  return out;
}

export default function TemplateLibrary({
  mode,
  onOpen,
  onNew,
  onEdit,
}: {
  mode: Mode;
  onOpen: (id: string) => void;
  onNew?: () => void;
  onEdit?: (id: string) => void;
}) {
  const compose = mode === "compose";
  const templates = useTemplates();
  const del = useDeleteTemplate();

  const [filter, setFilter] = useState<string | null>(null);
  const [delTarget, setDelTarget] = useState<TemplateSummary | null>(null);
  const [delError, setDelError] = useState<string | null>(null);
  const [previewAnchor, setPreviewAnchor] = useState<HTMLElement | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  // Memoised so the `?? []` fallback doesn't mint a fresh array identity on every
  // render, which would defeat the grouping memo below it.
  const rows = useMemo(() => templates.data ?? [], [templates.data]);
  const groups = useMemo(() => group(rows), [rows]);
  const visibleGroups = filter ? groups.filter((g) => g.category === filter) : groups;

  async function confirmDelete() {
    if (!delTarget) return;
    setDelError(null);
    try {
      await del.mutateAsync(delTarget.id);
      setDelTarget(null);
    } catch (e) {
      setDelError(describeError(e));
    }
  }

  const onCard = compose ? onOpen : (id: string) => onEdit?.(id);

  const previewBtn = (t: TemplateSummary) =>
    t.has_thumbnail ? (
      <Tooltip title="Preview" arrow placement="top">
        <IconButton
          size="small"
          aria-label={`Preview ${t.name}`}
          onClick={(e) => {
            setPreviewAnchor(e.currentTarget);
            setPreviewId(t.id);
          }}
          sx={{ color: "text.secondary", p: 0.4, "&:hover": { color: "primary.main" } }}
        >
          <Eye size={15} />
        </IconButton>
      </Tooltip>
    ) : null;

  const header = (
    <Box
      sx={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 2,
        flexWrap: "wrap",
        mb: 1.75,
      }}
    >
      <Box>
        <Typography sx={{ fontSize: 17, fontWeight: 800, letterSpacing: "-0.01em" }}>
          {compose ? "Choose a template" : "Templates"}
        </Typography>
        <Typography sx={{ fontSize: 13, color: "text.secondary", mt: 0.25 }}>
          {compose
            ? "Click a template to start editing its content."
            : "Onboard, edit, or remove the templates marketers can use."}
        </Typography>
      </Box>
      {!compose && onNew && (
        <Button
          onClick={onNew}
          startIcon={<Plus size={16} />}
          variant="contained"
          sx={{ textTransform: "none", fontSize: 13, fontWeight: 700 }}
        >
          New template
        </Button>
      )}
    </Box>
  );

  if (templates.isError) {
    return (
      <>
        {header}
        <Alert severity="error">
          Couldn't load templates. {describeError(templates.error)}
        </Alert>
      </>
    );
  }

  if (templates.isLoading) {
    return (
      <>
        {header}
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", py: 4 }}>
          <CircularProgress size={16} />
          <Typography sx={{ fontSize: 13, color: "text.secondary" }}>Loading templates…</Typography>
        </Stack>
      </>
    );
  }

  return (
    <>
      {header}

      {groups.length > 0 && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mb: 3 }}>
          {[{ key: null as string | null, label: "All" }, ...groups.map((g) => ({ key: g.category, label: g.category }))].map(
            (opt) => {
              const active = filter === opt.key;
              return (
                <Box
                  key={opt.label}
                  component="button"
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilter(opt.key)}
                  sx={{
                    px: 1.5,
                    py: 0.6,
                    borderRadius: 1,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: 12.5,
                    fontWeight: active ? 700 : 500,
                    border: 1,
                    borderColor: active ? "primary.main" : "divider",
                    color: active ? "primary.main" : "text.secondary",
                    bgcolor: active ? "action.selected" : "transparent",
                    transition: "all .12s",
                    "&:hover": { borderColor: "primary.main", color: "primary.main" },
                  }}
                >
                  {opt.label}
                </Box>
              );
            },
          )}
        </Box>
      )}

      {rows.length === 0 ? (
        <Typography sx={{ fontSize: 14, color: "text.disabled" }}>
          {compose
            ? "No templates available yet. Ask an admin to onboard one under Manage templates."
            : 'No templates yet — add one with "New template".'}
        </Typography>
      ) : (
        visibleGroups.map((cat) => (
          <Box key={cat.category} sx={{ mb: 4 }}>
            <Typography
              sx={{
                fontSize: 15,
                fontWeight: 700,
                letterSpacing: "-0.01em",
                mb: 1.5,
                color: "text.secondary",
              }}
            >
              {cat.category}
            </Typography>
            <Box
              sx={{
                display: "grid",
                // Four across once there is room. Three filled a wide gallery with
                // tiles bigger than a 140px preview and a one-line name need.
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "repeat(2, 1fr)",
                  md: "repeat(3, 1fr)",
                  lg: "repeat(4, 1fr)",
                },
                gap: 1.75,
              }}
            >
              {cat.items.map((t) => (
                <Box
                  key={t.id}
                  sx={{
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 1.5,
                    bgcolor: "background.paper",
                    overflow: "hidden",
                    transition: "border-color .15s",
                    "&:hover": { borderColor: "primary.main" },
                  }}
                >
                  <Box
                    component="button"
                    type="button"
                    onClick={() => onCard(t.id)}
                    aria-label={compose ? `Use ${t.name}` : `Edit ${t.name}`}
                    sx={{
                      display: "block",
                      width: "100%",
                      p: 0,
                      border: 0,
                      bgcolor: "transparent",
                      cursor: "pointer",
                    }}
                  >
                    <Thumbnail
                      id={t.id}
                      name={t.name}
                      hasThumbnail={t.has_thumbnail}
                      version={t.updated_at}
                    />
                  </Box>
                  <Box
                    sx={{
                      p: 1.75,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 1,
                    }}
                  >
                    <Box
                      component="button"
                      type="button"
                      onClick={() => onCard(t.id)}
                      sx={{
                        flex: 1,
                        minWidth: 0,
                        textAlign: "left",
                        border: 0,
                        p: 0,
                        bgcolor: "transparent",
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      <Typography
                        sx={{
                          fontSize: 14,
                          fontWeight: 700,
                          letterSpacing: "-0.01em",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {t.name}
                      </Typography>
                    </Box>
                    <Box sx={{ display: "flex", gap: 0.25 }}>
                      {previewBtn(t)}
                      {compose ? (
                        <Tooltip title="Use this template" arrow placement="top">
                          <IconButton
                            size="small"
                            aria-label={`Use ${t.name}`}
                            onClick={() => onOpen(t.id)}
                            sx={{ color: "text.secondary", p: 0.4, "&:hover": { color: "primary.main" } }}
                          >
                            <ArrowRight size={16} />
                          </IconButton>
                        </Tooltip>
                      ) : (
                        <>
                          <Tooltip title="Edit template details" arrow placement="top">
                            <IconButton
                              size="small"
                              aria-label={`Edit ${t.name}`}
                              onClick={() => onEdit?.(t.id)}
                              sx={{ color: "text.secondary", p: 0.4, "&:hover": { color: "primary.main" } }}
                            >
                              <Pencil size={15} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete template" arrow placement="top">
                            <IconButton
                              size="small"
                              aria-label={`Delete ${t.name}`}
                              onClick={() => setDelTarget(t)}
                              sx={{ color: "text.secondary", p: 0.4, "&:hover": { color: "error.main" } }}
                            >
                              <Trash2 size={15} />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                    </Box>
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        ))
      )}

      {/* Quick image preview — a glance at the full-length template, not the editor. */}
      <Popover
        open={Boolean(previewAnchor)}
        anchorEl={previewAnchor}
        onClose={() => setPreviewAnchor(null)}
        anchorOrigin={{ vertical: "center", horizontal: "right" }}
        transformOrigin={{ vertical: "center", horizontal: "left" }}
        slotProps={{
          paper: {
            sx: { ml: 1, borderRadius: 1.5, overflow: "hidden", border: 1, borderColor: "divider" },
          },
        }}
      >
        {previewId && (
          <FullImagePreview
            id={previewId}
            version={rows.find((t) => t.id === previewId)?.updated_at}
          />
        )}
      </Popover>

      {delTarget && (
        <Dialog
          open
          fullWidth
          maxWidth="xs"
          onClose={del.isPending ? undefined : () => setDelTarget(null)}
        >
          <Box sx={{ px: 3, pt: 3, pb: 1 }}>
            <Typography sx={{ fontSize: 17, fontWeight: 700, color: "error.main", mb: 0.75 }}>
              Delete this template?
            </Typography>
            <Typography sx={{ fontSize: 13, color: "text.secondary", lineHeight: 1.5 }}>
              <Box component="span" sx={{ fontWeight: 700, color: "text.primary" }}>
                {delTarget.name}
              </Box>{" "}
              will be permanently removed. This can't be undone.
            </Typography>
            {delError && (
              <Alert severity="error" sx={{ mt: 1.5, fontSize: 12 }}>
                {delError}
              </Alert>
            )}
          </Box>
          <DialogActions sx={{ px: 3, pb: 2.5, pt: 1 }}>
            <Button
              onClick={() => setDelTarget(null)}
              disabled={del.isPending}
              sx={{ textTransform: "none", fontSize: 13, color: "text.secondary" }}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmDelete}
              disabled={del.isPending}
              variant="contained"
              color="error"
              startIcon={
                del.isPending ? <CircularProgress size={14} color="inherit" /> : <Trash2 size={16} />
              }
              sx={{ textTransform: "none", fontSize: 13, fontWeight: 700 }}
            >
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </>
  );
}
