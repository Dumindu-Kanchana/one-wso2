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
  CircularProgress,
  Dialog,
  DialogActions,
  OutlinedInput,
  Typography,
} from "@wso2/oxygen-ui";
import { Wand2 } from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import { useStructureFill } from "../../api/useEmailWorkbench";
import type { TargetBlock, TemplateBlockSnap } from "../emailWorkbenchTypes";

// "Fill with AI" — lay a pasted draft out into this template's structure.
//
// The safety property worth understanding: the model emits SEMANTIC BLOCKS ONLY
// (kind + text/items/label), never HTML. The editor then materialises each block
// through the approved catalog, so the AI can decide "this should be a bullet list"
// but cannot introduce markup, styling or a component that isn't already approved.
//
// The proposal is shown for review and only applied on confirm, because applying
// REPLACES the body — that's destructive and shouldn't happen from one click.

const KIND_LABEL: Record<string, string> = {
  greeting: "Greeting",
  signoff: "Sign off",
  signoffImage: "Sign off with image",
  paragraph: "Paragraph",
  list: "Bullet list",
  button: "Button",
  buttons2: "2 Buttons",
  calendar: "Add to calendar",
  // Legacy / not currently AI-emitted, kept so an unexpected kind still displays
  // as something readable rather than a raw key.
  heading: "Heading",
  image: "Image",
  divider: "Divider",
  spacer: "Spacer",
};

// Draft markers the backend's prompt recognises. Surfaced prominently because
// they're the only way to trigger the complex blocks, and nothing else in the UI
// would tell a marketer they exist. Keep in sync with the backend's prefill rules.
const MARKERS: { code: string; desc: string; example: string }[] = [
  {
    code: "[Button text]",
    desc: "becomes a button — the text inside is its label (you add the link after).",
    example: "Ready to dive in? [Start free trial]",
  },
  {
    code: "[Add to Calendar]",
    desc: "inserts the Add-to-Calendar block (Google + Outlook; you add the event links after).",
    example: "Save your seat for the summit. [Add to Calendar]",
  },
  {
    code: "[Sign off with image]",
    desc: "inserts the sign-off with a photo + name/role (you edit those after).",
    example: "Looking forward to it.\n[Sign off with image]",
  },
];

function preview(b: TargetBlock): string {
  if (b.kind === "list") return (b.items ?? []).join(" · ");
  if (b.kind === "buttons2")
    return [b.label, b.label2].filter(Boolean).join("  ·  ") || "(two buttons)";
  if (b.kind === "button") return b.label || "(button)";
  if (b.kind === "calendar") return "(Google / Outlook calendar — add links after applying)";
  if (b.kind === "signoffImage") return "(closing + photo + name/role — edit after applying)";
  return (b.text ?? "").replace(/\s+/g, " ").trim();
}

export default function StructureFillDialog({
  open,
  snapshot,
  mergeFields,
  allowedKinds,
  onApply,
  onClose,
}: {
  open: boolean;
  snapshot: TemplateBlockSnap[];
  mergeFields: string[];
  allowedKinds: string[];
  onApply: (blocks: TargetBlock[]) => void;
  onClose: () => void;
}) {
  const fill = useStructureFill();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [proposed, setProposed] = useState<TargetBlock[] | null>(null);

  async function generate() {
    setError(null);
    try {
      const res = await fill.mutateAsync({
        draft,
        templateBlocks: snapshot,
        allowedKinds,
        mergeFields,
      });
      setProposed(res?.blocks ?? []);
    } catch (e) {
      setError(describeError(e));
    }
  }

  function reset() {
    setDraft("");
    setProposed(null);
    setError(null);
  }
  function close() {
    reset();
    onClose();
  }
  function apply() {
    onApply(proposed ?? []);
    reset();
    onClose();
  }

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="md">
      <Box sx={{ p: 3 }}>
        <Typography
          sx={{ fontSize: 16, fontWeight: 800, mb: 0.5, display: "flex", alignItems: "center", gap: 1 }}
        >
          <Box sx={{ color: "primary.main", display: "inline-flex" }}>
            <Wand2 size={18} />
          </Box>
          Fill with AI — structure
        </Typography>
        <Typography sx={{ fontSize: 13, color: "text.secondary", mb: 2 }}>
          Paste your draft. AI lays it out into the template — adding paragraphs, bullet lists and
          buttons as needed — and shows the proposed structure for review. Applying replaces the body
          content (styling is kept from the template). Links are left blank for you to fill, and merge
          fields are preserved.
        </Typography>

        {proposed === null ? (
          <>
            <Box
              sx={{
                mb: 1.5,
                p: 1.5,
                borderRadius: 1.25,
                border: 1,
                borderColor: "primary.main",
                bgcolor: "action.selected",
              }}
            >
              <Typography
                sx={{
                  fontSize: 11,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "primary.main",
                  mb: 1,
                }}
              >
                ✨ Special markers — type these in your draft to add these blocks
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.1 }}>
                {MARKERS.map((m) => (
                  <Box key={m.code}>
                    <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
                      <Box
                        component="code"
                        sx={{
                          flexShrink: 0,
                          fontFamily: "monospace",
                          fontSize: 12,
                          fontWeight: 700,
                          bgcolor: "background.paper",
                          border: 1,
                          borderColor: "divider",
                          borderRadius: 0.75,
                          px: 0.75,
                          py: 0.25,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {m.code}
                      </Box>
                      <Typography sx={{ fontSize: 12, color: "text.secondary" }}>{m.desc}</Typography>
                    </Box>
                    <Box
                      sx={{
                        mt: 0.4,
                        ml: 0.25,
                        fontSize: 12,
                        color: "text.disabled",
                        display: "flex",
                        gap: 0.6,
                        alignItems: "baseline",
                      }}
                    >
                      <Box component="span" sx={{ fontStyle: "italic", flexShrink: 0 }}>
                        Example:
                      </Box>
                      <Box
                        component="span"
                        sx={{
                          fontFamily: "monospace",
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          color: "text.secondary",
                        }}
                      >
                        {m.example}
                      </Box>
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
            <OutlinedInput
              fullWidth
              multiline
              minRows={10}
              maxRows={18}
              value={draft}
              placeholder="Paste your campaign draft / copy here…"
              onChange={(e) => setDraft(e.target.value)}
              sx={{ fontSize: 13.5, bgcolor: "background.default" }}
            />
          </>
        ) : proposed.length === 0 ? (
          <Typography sx={{ fontSize: 14, color: "text.disabled", fontStyle: "italic", py: 2 }}>
            AI didn't produce any structure for this draft. Try a more detailed draft, or close and
            build manually.
          </Typography>
        ) : (
          <Box sx={{ maxHeight: 400, overflowY: "auto" }}>
            <Typography
              sx={{
                fontSize: 11,
                fontWeight: 700,
                color: "text.secondary",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                mb: 1,
              }}
            >
              Proposed structure — {proposed.length} block{proposed.length === 1 ? "" : "s"}
            </Typography>
            {proposed.map((b, i) => (
              <Box
                key={i}
                sx={{
                  display: "flex",
                  gap: 1.25,
                  alignItems: "flex-start",
                  py: 1,
                  borderBottom: 1,
                  borderColor: "divider",
                }}
              >
                <Box
                  sx={{
                    flexShrink: 0,
                    mt: 0.2,
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    color: "primary.main",
                    border: 1,
                    borderColor: "primary.main",
                    borderRadius: 0.75,
                    px: 0.75,
                    py: 0.25,
                    minWidth: 64,
                    textAlign: "center",
                  }}
                >
                  {KIND_LABEL[b.kind] ?? b.kind}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  {b.kind === "list" ? (
                    <Box component="ul" sx={{ m: 0, pl: 2.2 }}>
                      {(b.items ?? []).map((it, j) => (
                        <Box component="li" key={j} sx={{ fontSize: 13 }}>
                          {it}
                        </Box>
                      ))}
                    </Box>
                  ) : (
                    <Typography sx={{ fontSize: 13, wordBreak: "break-word" }}>
                      {preview(b) || <em>(empty)</em>}
                    </Typography>
                  )}
                  {b.note && (
                    <Typography
                      sx={{ fontSize: 11, color: "text.disabled", fontStyle: "italic", mt: 0.25 }}
                    >
                      {b.note}
                    </Typography>
                  )}
                  {(b.kind === "button" || b.kind === "buttons2") && (
                    <Typography sx={{ fontSize: 11, color: "text.disabled", mt: 0.25 }}>
                      Link left blank — add the URL after applying.
                    </Typography>
                  )}
                </Box>
              </Box>
            ))}
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 2, fontSize: 13 }}>
            {error}
          </Alert>
        )}
      </Box>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={close} sx={{ textTransform: "none", color: "text.secondary" }}>
          Cancel
        </Button>
        <Box sx={{ flex: 1 }} />
        {proposed !== null && (
          <Button onClick={reset} sx={{ textTransform: "none", color: "text.secondary" }}>
            Start over
          </Button>
        )}
        {proposed === null ? (
          <Button
            onClick={generate}
            disabled={!draft.trim() || fill.isPending}
            variant="contained"
            startIcon={
              fill.isPending ? <CircularProgress size={15} color="inherit" /> : <Wand2 size={16} />
            }
            sx={{ textTransform: "none", fontWeight: 700 }}
          >
            {fill.isPending ? "Thinking…" : "Lay out draft"}
          </Button>
        ) : proposed.length > 0 ? (
          <Button onClick={apply} variant="contained" sx={{ textTransform: "none", fontWeight: 700 }}>
            Replace body with this
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}
