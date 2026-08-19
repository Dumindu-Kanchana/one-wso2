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
  Link,
  OutlinedInput,
  Typography,
} from "@wso2/oxygen-ui";
import { Download, ExternalLink, RefreshCw, Send, Wand2 } from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import { pardotTemplateUrl } from "@config/apiConfig";
import { usePushDraft } from "../../api/useEmailWorkbench";
import { deriveSubject } from "../lib/deriveSubject";
import { toTextVersion } from "../lib/htmlToTextVersion";
import AssetNameDialog from "./AssetNameDialog";

// The last step: name the template, review the Pardot plain-text version, and push.
//
// Two modes, chosen by whether this draft already has a Pardot template id:
//   push          creates the template in Pardot and flips the draft to Completed
//   update-pardot PATCHes the template that already exists
// Getting that wrong duplicates a template in Pardot rather than failing, so the
// mode is derived from the draft's own state, never from what the user last clicked.
//
// The text version is EDITABLE. It's generated deterministically from the HTML, but
// the converter documents a known cosmetic divergence in blank-line placement, and
// the marketer is the one who has to be happy with what recipients see.

const mono = { fontFamily: "monospace", fontSize: 12, bgcolor: "background.default" } as const;
const labelSx = {
  fontSize: 11,
  fontWeight: 700,
  color: "text.secondary",
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
};

export default function ExportDialog({
  open,
  html,
  name,
  draftId,
  pardotTemplateId,
  onSynced,
  onClose,
}: {
  open: boolean;
  html: string;
  name?: string;
  draftId?: string;
  pardotTemplateId?: number | null;
  onSynced?: (r: { pardotTemplateId: number; status: string }) => void;
  onClose: () => void;
}) {
  const push = usePushDraft();
  const [pardotName, setPardotName] = useState(name ?? "");
  const [assetOpen, setAssetOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncedId, setSyncedId] = useState<number | null>(null);
  const [syncedMode, setSyncedMode] = useState<"push" | "update">("push");

  // Derived from the HTML rather than stored in state, plus an optional override —
  // so it recomputes when the dialog reopens with different content, without an
  // effect that mirrors props into state.
  const [textOverride, setTextOverride] = useState<string | null>(null);
  const textVersion = textOverride ?? toTextVersion(html);

  const isUpdate = Boolean(pardotTemplateId);

  function downloadHtml() {
    const slug = (pardotName.trim() || name || "email")
      .replace(/[^a-z0-9._-]+/gi, "-")
      .replace(/^-+|-+$/g, "");
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug || "email"}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function handlePush() {
    if (!draftId || !pardotName.trim()) return;
    setError(null);
    try {
      const res = await push.mutateAsync({
        id: draftId,
        alreadyPushed: isUpdate,
        body: {
          name: pardotName.trim(),
          subject: deriveSubject(html, pardotName),
          html,
          text_version: textVersion,
        },
      });
      if (!res) throw new Error("Pardot returned no template id.");
      setSyncedMode(isUpdate ? "update" : "push");
      setSyncedId(res.pardot_template_id);
      onSynced?.({ pardotTemplateId: res.pardot_template_id, status: res.status });
    } catch (e) {
      // The backend returns friendly messages for the expected states (409
      // ALREADY_PUSHED / NOT_PUSHED, 503 unavailable), so surface them as-is.
      setError(describeError(e));
    }
  }

  // Show the Pardot link as soon as we have an id, even before the parent re-renders.
  const linkId = syncedId ?? pardotTemplateId ?? null;

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
        <Box sx={{ p: 3 }}>
          <Typography sx={{ fontSize: 16, fontWeight: 800, mb: 1.5 }}>
            {isUpdate ? "Update in Pardot" : "Finalize & push to Pardot"}
          </Typography>

          <Typography sx={{ ...labelSx, mb: 0.5 }}>Template name (for Pardot)</Typography>
          <Box sx={{ display: "flex", gap: 1, mb: 2.5 }}>
            <OutlinedInput
              fullWidth
              size="small"
              value={pardotName}
              placeholder="Generate or type the Pardot template name…"
              onChange={(e) => setPardotName(e.target.value)}
              sx={{ fontSize: 13, bgcolor: "background.default" }}
            />
            <Button
              onClick={() => setAssetOpen(true)}
              startIcon={<Wand2 size={16} />}
              variant="outlined"
              sx={{ textTransform: "none", fontWeight: 700, whiteSpace: "nowrap" }}
            >
              Generate
            </Button>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", mb: 0.5 }}>
            <Typography sx={labelSx}>Plain-text version (for Pardot)</Typography>
            <Box sx={{ flex: 1 }} />
            <Button
              onClick={() => void navigator.clipboard.writeText(textVersion)}
              sx={{ textTransform: "none", fontSize: 12, minWidth: 0, py: 0 }}
            >
              Copy text
            </Button>
          </Box>
          <OutlinedInput
            fullWidth
            multiline
            minRows={8}
            maxRows={16}
            value={textVersion}
            onChange={(e) => setTextOverride(e.target.value)}
            sx={{ ...mono, mb: 2.5 }}
          />

          <Box sx={{ display: "flex", alignItems: "center", mb: 0.5 }}>
            <Typography sx={labelSx}>HTML to push</Typography>
            <Box sx={{ flex: 1 }} />
            <Button
              onClick={() => void navigator.clipboard.writeText(html)}
              sx={{ textTransform: "none", fontSize: 12, minWidth: 0, py: 0 }}
            >
              Copy HTML
            </Button>
            <Button
              onClick={downloadHtml}
              startIcon={<Download size={15} />}
              sx={{ textTransform: "none", fontSize: 12, minWidth: 0, py: 0, ml: 1.5 }}
            >
              Download
            </Button>
          </Box>
          <OutlinedInput fullWidth multiline minRows={8} maxRows={16} value={html} readOnly sx={mono} />

          {syncedId != null && (
            <Alert severity="success" sx={{ mt: 2, fontSize: 13 }}>
              <Box component="span" sx={{ fontWeight: 700 }}>
                {pardotName || "(unnamed)"}
              </Box>{" "}
              {syncedMode === "update" ? "updated in Pardot." : "pushed to Pardot."}{" "}
              <Link
                href={pardotTemplateUrl(syncedId)}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 0.4 }}
              >
                Open in Pardot <ExternalLink size={13} />
              </Link>
            </Alert>
          )}
          {error && (
            <Alert severity="error" sx={{ mt: 2, fontSize: 13 }}>
              {error}
            </Alert>
          )}
          {!draftId && (
            <Alert severity="warning" sx={{ mt: 2, fontSize: 13 }}>
              This composition hasn't been saved as a draft yet, so it can't be pushed. Close this
              dialog and use Save draft first.
            </Alert>
          )}
        </Box>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          {linkId != null && syncedId == null && (
            <Link
              href={pardotTemplateUrl(linkId)}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                mr: "auto",
                fontSize: 13,
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: 0.4,
              }}
            >
              Open current in Pardot <ExternalLink size={13} />
            </Link>
          )}
          <Button
            onClick={onClose}
            disabled={push.isPending}
            sx={{ textTransform: "none", color: "text.secondary" }}
          >
            Close
          </Button>
          <Button
            onClick={handlePush}
            disabled={!pardotName.trim() || !draftId || push.isPending}
            variant="contained"
            startIcon={
              push.isPending ? (
                <CircularProgress size={15} color="inherit" />
              ) : isUpdate ? (
                <RefreshCw size={16} />
              ) : (
                <Send size={16} />
              )
            }
            sx={{ textTransform: "none", fontWeight: 700 }}
          >
            {isUpdate ? "Update in Pardot" : "Push to Pardot"}
          </Button>
        </DialogActions>
      </Dialog>

      <AssetNameDialog
        open={assetOpen}
        onApply={setPardotName}
        onClose={() => setAssetOpen(false)}
      />
    </>
  );
}
