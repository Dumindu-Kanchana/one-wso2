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

import { Alert, Box, Button, IconButton, OutlinedInput, Tooltip, Typography } from "@wso2/oxygen-ui";
import { ArrowLeft, Bold, Italic, Link2, Underline } from "@wso2/oxygen-ui-icons-react";
import {
  BTN_VARIANTS,
  CATEGORY_ORDER,
  hasMergeField,
  SPACER_SIZES,
  visibleBlocks,
  type BlockDef,
} from "../lib/advancedEditorCore";
import type { Sel } from "../lib/editorTypes";

// The editor's right-hand contextual panel. Purely presentational: all state lives
// in AdvancedEditor, this renders `sel` and calls back.
//
// One panel, two faces — the selected element's inspector, or the "add a row"
// palette when nothing is selected. That's deliberate: a permanently-visible
// palette alongside a permanently-visible inspector would halve the canvas, and the
// canvas IS the editing surface here.

const mono = { fontFamily: "monospace", fontSize: 12, bgcolor: "background.default" } as const;
const labelSx = {
  fontSize: 10.5,
  fontWeight: 700,
  color: "text.secondary",
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
  mb: 0.5,
};
const inSx = { fontSize: 13, mb: 1.5, bgcolor: "background.default" } as const;
const sectionHeadSx = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.06em",
  textTransform: "uppercase" as const,
  color: "text.secondary",
  mb: 1.25,
};
const catHeadSx = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  color: "text.disabled",
  mt: 1,
  mb: 0.75,
};

// Shown whenever the selected content carries a {{merge field}}. Worth an explicit
// warning: a marketer editing text can easily delete one, and the failure only
// shows up at send time as an un-personalised email.
const mergeWarn = (
  <Alert severity="warning" icon={false} sx={{ mb: 1.5, py: 0.25, fontSize: 11.5 }}>
    Contains a merge field <code>{"{{…}}"}</code> — keep it intact so personalization still works.
  </Alert>
);

export interface EditorInspectorProps {
  sel: Sel | null;
  catalog: BlockDef[];
  catalogStatus: "loading" | "ready" | "error";
  linkOpen: boolean;
  linkUrl: string;
  onDeselect: () => void;
  onRichFmt: (cmd: "bold" | "italic" | "underline") => void;
  onOpenLinkEditor: (initialUrl: string) => void;
  onLinkUrlChange: (v: string) => void;
  onApplyLink: () => void;
  onRemoveLink: () => void;
  onCloseLinkEditor: () => void;
  onHrefChange: (v: string) => void;
  onOpenUtm: () => void;
  onLinkTextChange: (v: string) => void;
  onBtnVariant: (key: string) => void;
  onSrcChange: (v: string) => void;
  onAltChange: (v: string) => void;
  onImgHrefChange: (v: string) => void;
  onSpacerSize: (key: string) => void;
  onRemoveSelected: (id: string) => void;
  onUnlink: (id: string) => void;
  onInsertRow: (type: string) => void;
}

const KIND_TITLE: Record<Sel["kind"], string> = {
  link: "Link",
  image: "Image",
  spacer: "Spacer",
  rich: "Text",
};

export default function EditorInspector({
  sel,
  catalog,
  catalogStatus,
  linkOpen,
  linkUrl,
  onDeselect,
  onRichFmt,
  onOpenLinkEditor,
  onLinkUrlChange,
  onApplyLink,
  onRemoveLink,
  onCloseLinkEditor,
  onHrefChange,
  onOpenUtm,
  onLinkTextChange,
  onBtnVariant,
  onSrcChange,
  onAltChange,
  onImgHrefChange,
  onSpacerSize,
  onRemoveSelected,
  onUnlink,
  onInsertRow,
}: EditorInspectorProps) {
  const blocks = visibleBlocks(catalog);

  return (
    <Box
      sx={{
        width: 300,
        flexShrink: 0,
        borderLeft: 1,
        borderColor: "divider",
        overflowY: "auto",
        bgcolor: "background.paper",
        p: 2,
      }}
    >
      {sel ? (
        <>
          <Button
            onClick={onDeselect}
            startIcon={<ArrowLeft size={15} />}
            sx={{ textTransform: "none", fontSize: 12, color: "text.secondary", mb: 1.5, ml: -0.5 }}
          >
            Add rows
          </Button>
          <Typography
            sx={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "primary.main",
              mb: 1.5,
            }}
          >
            {sel.kind === "rich" && sel.isList ? "Bullet list" : KIND_TITLE[sel.kind]}
          </Typography>

          {sel.kind === "rich" && (
            <>
              {sel.hasMerge && mergeWarn}
              <Typography sx={labelSx}>Format selection</Typography>
              <Box sx={{ display: "flex", gap: 0.5, mb: 1 }}>
                {(
                  [
                    ["bold", Bold],
                    ["italic", Italic],
                    ["underline", Underline],
                  ] as const
                ).map(([k, Icon]) => (
                  <Tooltip key={k} title={k[0].toUpperCase() + k.slice(1)} arrow>
                    {/* preventDefault on mousedown so clicking the button doesn't
                        collapse the text selection it's meant to format. */}
                    <IconButton
                      size="small"
                      aria-label={k}
                      aria-pressed={sel[k]}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => onRichFmt(k)}
                      sx={{
                        border: 1,
                        borderColor: sel[k] ? "primary.main" : "divider",
                        borderRadius: 1,
                        color: sel[k] ? "primary.main" : "text.secondary",
                        bgcolor: sel[k] ? "action.selected" : "transparent",
                        "&:hover": { borderColor: "primary.main", color: "primary.main" },
                      }}
                    >
                      <Icon size={16} />
                    </IconButton>
                  </Tooltip>
                ))}
                <Tooltip title={sel.linked ? "Edit link" : "Add link"} arrow>
                  <IconButton
                    size="small"
                    aria-label={sel.linked ? "Edit link" : "Add link"}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onOpenLinkEditor(sel.linked ? (sel.linkHref ?? "") : "")}
                    sx={{
                      border: 1,
                      borderColor: sel.linked ? "primary.main" : "divider",
                      borderRadius: 1,
                      color: sel.linked ? "primary.main" : "text.secondary",
                      bgcolor: sel.linked ? "action.selected" : "transparent",
                      "&:hover": { borderColor: "primary.main", color: "primary.main" },
                    }}
                  >
                    <Link2 size={16} />
                  </IconButton>
                </Tooltip>
              </Box>

              {linkOpen && (
                <Box
                  sx={{
                    mb: 1,
                    p: 1,
                    borderRadius: 1,
                    border: 1,
                    borderColor: "divider",
                    bgcolor: "background.default",
                  }}
                >
                  <Typography sx={labelSx}>Link URL</Typography>
                  <OutlinedInput
                    fullWidth
                    size="small"
                    autoFocus
                    multiline
                    minRows={1}
                    maxRows={3}
                    value={linkUrl}
                    // Strip newlines: the field is multiline so long URLs wrap
                    // visually, but a newline inside an href is never valid.
                    onChange={(e) => onLinkUrlChange(e.target.value.replace(/\n/g, ""))}
                    placeholder="https://…"
                    sx={{ ...inSx, ...mono, mb: 0.75 }}
                  />
                  <Box sx={{ display: "flex", gap: 1 }}>
                    <Button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={onApplyLink}
                      variant="contained"
                      size="small"
                      sx={{ textTransform: "none", fontWeight: 700, fontSize: 12 }}
                    >
                      Apply
                    </Button>
                    {sel.linked && (
                      <Button
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={onRemoveLink}
                        size="small"
                        color="error"
                        sx={{ textTransform: "none", fontWeight: 700, fontSize: 12 }}
                      >
                        Remove
                      </Button>
                    )}
                    <Button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={onCloseLinkEditor}
                      size="small"
                      sx={{ textTransform: "none", fontSize: 12, color: "text.secondary" }}
                    >
                      Cancel
                    </Button>
                  </Box>
                </Box>
              )}

              <Typography sx={{ fontSize: 11.5, color: "text.disabled" }}>
                Click into the text to edit it directly. Select words, then B / I / U or the link
                button.{" "}
                {sel.isList ? "Press Enter for a new bullet." : "Press Enter for a new line."}
              </Typography>
            </>
          )}

          {sel.kind === "link" && (
            <>
              {(hasMergeField(sel.href) || hasMergeField(sel.text)) && mergeWarn}
              <Typography sx={labelSx}>Link URL</Typography>
              <OutlinedInput
                fullWidth
                size="small"
                multiline
                minRows={1}
                maxRows={4}
                value={sel.href}
                onChange={(e) => onHrefChange(e.target.value.replace(/\n/g, ""))}
                sx={{ ...inSx, ...mono, mb: 0.5 }}
              />
              <Button
                onClick={onOpenUtm}
                sx={{ textTransform: "none", fontSize: 12, px: 0, mb: 1.5 }}
              >
                Build tracking URL (UTM)
              </Button>

              {/* Link TEXT is only editable for a text-only anchor. A link wrapping
                  an icon + span (Add-to-calendar, say) would have its children
                  destroyed by setting textContent. */}
              {sel.textOnly && (
                <>
                  <Typography sx={labelSx}>Link text</Typography>
                  <OutlinedInput
                    fullWidth
                    size="small"
                    multiline
                    minRows={1}
                    maxRows={4}
                    value={sel.text}
                    onChange={(e) => onLinkTextChange(e.target.value)}
                    sx={inSx}
                  />
                </>
              )}

              {/* The colour picker appears only for a recognised button variant —
                  detected by its canonical class, never guessed from colours. */}
              {sel.btnId && (
                <>
                  <Typography sx={sectionHeadSx}>Appearance</Typography>
                  <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 1.5 }}>
                    {BTN_VARIANTS.map((v) => (
                      <Box
                        key={v.key}
                        component="button"
                        type="button"
                        aria-pressed={sel.variant === v.key}
                        onClick={() => onBtnVariant(v.key)}
                        sx={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 0.75,
                          cursor: "pointer",
                          borderRadius: 1,
                          px: 1,
                          py: 0.5,
                          fontSize: 12,
                          fontWeight: 700,
                          fontFamily: "inherit",
                          bgcolor: "transparent",
                          color: "text.primary",
                          border: 2,
                          borderColor: sel.variant === v.key ? "primary.main" : "divider",
                        }}
                      >
                        <Box
                          sx={{
                            width: 14,
                            height: 14,
                            borderRadius: 0.5,
                            bgcolor: v.tdBg,
                            border: 1,
                            borderColor: "divider",
                          }}
                        />
                        {v.n}
                      </Box>
                    ))}
                  </Box>
                </>
              )}

              {!sel.btnId && sel.textOnly && (
                <Button
                  onClick={() => onUnlink(sel.id)}
                  color="error"
                  sx={{ textTransform: "none", fontSize: 12, fontWeight: 700, px: 0, mt: 0.5 }}
                >
                  Unlink (keep text)
                </Button>
              )}
            </>
          )}

          {sel.kind === "image" && (
            <>
              {sel.linkId && (
                <>
                  <Typography sx={labelSx}>Link URL</Typography>
                  <OutlinedInput
                    fullWidth
                    size="small"
                    multiline
                    minRows={1}
                    maxRows={4}
                    value={sel.href ?? ""}
                    onChange={(e) => onImgHrefChange(e.target.value.replace(/\n/g, ""))}
                    sx={{ ...inSx, ...mono, mb: 0.5 }}
                  />
                  <Button
                    onClick={onOpenUtm}
                    sx={{ textTransform: "none", fontSize: 12, px: 0, mb: 1.5 }}
                  >
                    Build tracking URL (UTM)
                  </Button>
                </>
              )}
              <Typography sx={labelSx}>Image URL (src)</Typography>
              <OutlinedInput
                fullWidth
                size="small"
                multiline
                minRows={1}
                maxRows={4}
                value={sel.src}
                onChange={(e) => onSrcChange(e.target.value.replace(/\n/g, ""))}
                sx={{ ...inSx, ...mono }}
              />
              <Typography sx={labelSx}>Alt text</Typography>
              <OutlinedInput
                fullWidth
                size="small"
                multiline
                minRows={1}
                maxRows={3}
                value={sel.alt}
                onChange={(e) => onAltChange(e.target.value)}
                sx={inSx}
              />
              <Button
                onClick={() => onRemoveSelected(sel.id)}
                color="error"
                sx={{ textTransform: "none", fontSize: 12, fontWeight: 700, px: 0, mt: 0.5 }}
              >
                Remove this image
              </Button>
            </>
          )}

          {sel.kind === "spacer" && (
            <>
              <Typography sx={{ fontSize: 11.5, color: "text.disabled", mb: 1.5 }}>
                An empty vertical gap. Pick its height.
              </Typography>
              <Typography sx={labelSx}>Height</Typography>
              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 1.5 }}>
                {SPACER_SIZES.map((s) => (
                  <Box
                    key={s.key}
                    component="button"
                    type="button"
                    aria-pressed={sel.size === s.key}
                    onClick={() => onSpacerSize(s.key)}
                    sx={{
                      cursor: "pointer",
                      borderRadius: 1,
                      px: 1,
                      py: 0.5,
                      fontSize: 12,
                      fontWeight: 700,
                      fontFamily: "inherit",
                      bgcolor: "transparent",
                      color: "text.primary",
                      border: 2,
                      borderColor: sel.size === s.key ? "primary.main" : "divider",
                    }}
                  >
                    {s.n} · {s.v}px
                  </Box>
                ))}
              </Box>
              <Button
                onClick={() => onRemoveSelected(sel.id)}
                color="error"
                sx={{ textTransform: "none", fontSize: 12, fontWeight: 700, px: 0, mt: 1 }}
              >
                Remove this spacer
              </Button>
            </>
          )}
        </>
      ) : (
        <>
          <Typography
            sx={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "text.secondary",
            }}
          >
            Add a row
          </Typography>
          <Typography sx={{ fontSize: 12, color: "text.secondary", mt: 0.25, mb: 1.5 }}>
            Pick a row below to add it to the end. To place one exactly, hover between rows for the
            "+ insert row" bar. Click content to edit.
          </Typography>

          {blocks.length === 0 && (
            <Typography
              sx={{
                fontSize: 12.5,
                color: catalogStatus === "error" ? "error.main" : "text.disabled",
                py: 2,
              }}
            >
              {catalogStatus === "error"
                ? "Block catalog unavailable — check your connection and reload."
                : catalogStatus === "loading"
                  ? "Loading blocks…"
                  : "No blocks in the catalog yet. Add one under Block catalog."}
            </Typography>
          )}

          {CATEGORY_ORDER.map((cat) => {
            const items = blocks.filter((b) => b.category === cat.key);
            if (!items.length) return null;
            return (
              <Box key={cat.key}>
                <Typography sx={catHeadSx}>{cat.label}</Typography>
                {items.map((t) => (
                  <Box
                    key={t.type}
                    component="button"
                    type="button"
                    onClick={() => onInsertRow(t.type)}
                    sx={{
                      display: "flex",
                      width: "100%",
                      textAlign: "left",
                      alignItems: "center",
                      gap: 1.25,
                      p: 1.1,
                      mb: 0.75,
                      borderRadius: 1.25,
                      border: 1,
                      borderColor: "divider",
                      bgcolor: "transparent",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      transition: "all .12s",
                      "&:hover": { borderColor: "primary.main" },
                    }}
                  >
                    <Box
                      sx={{
                        width: 28,
                        height: 28,
                        borderRadius: 1,
                        flexShrink: 0,
                        bgcolor: "action.selected",
                        color: "primary.main",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 13,
                        fontWeight: 800,
                      }}
                    >
                      {t.icon}
                    </Box>
                    <Typography sx={{ fontSize: 13, fontWeight: 650 }}>{t.label}</Typography>
                  </Box>
                ))}
              </Box>
            );
          })}
        </>
      )}
    </Box>
  );
}
