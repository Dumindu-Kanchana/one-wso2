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
import { Box, Button, Dialog, IconButton, Tooltip, Typography } from "@wso2/oxygen-ui";
import { ExternalLink, Moon, Sun, X } from "@wso2/oxygen-ui-icons-react";
import { renderPreviewHtml } from "../lib/advancedEditorCore";

// Full-size email preview: desktop / mobile widths, light / dark, open-in-new-tab.
//
// The Light/Dark toggle fully DRIVES the preview rather than following the viewer's
// device — `renderPreviewHtml` disables the email's own OS-driven dark rules for
// 'light' and applies them unconditionally for 'dark'. Without that, a marketer on
// a dark-mode laptop could never see the light rendering most recipients get.

const MOBILE_W = 380;

// A preview must look EXACTLY like the email, so nothing here rewrites the markup —
// but a blob: URL inherits this app's origin, which means a <script> or an inline
// on* handler in a template would run with access to our storage and tokens. The
// in-dialog iframe is sandboxed; "Open in new tab" is a top-level document and
// cannot be.
//
// So the document carries its own restrictive CSP instead. It blocks script
// execution outright while leaving every presentational capability an email needs —
// inline styles, remote and data: images, webfonts — so the preview is unchanged to
// look at. Injected here rather than in renderPreviewHtml, which is a verbatim
// parity-checked port.
const PREVIEW_CSP =
  "default-src 'none'; " +
  "img-src data: https: http:; " +
  "style-src 'unsafe-inline' https:; " +
  "font-src data: https:; " +
  "script-src 'none'; " +
  "object-src 'none'; " +
  "form-action 'none'";

function withPreviewCsp(doc: string): string {
  const meta = `<meta http-equiv="Content-Security-Policy" content="${PREVIEW_CSP}">`;
  if (/<head[^>]*>/i.test(doc)) return doc.replace(/<head[^>]*>/i, (h) => `${h}${meta}`);
  return meta + doc;
}

export default function PreviewDialog({
  open,
  html,
  onClose,
}: {
  open: boolean;
  html: string;
  onClose: () => void;
}) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [dark, setDark] = useState(false);
  const shown = renderPreviewHtml(html, dark ? "dark" : "light");

  function openInNewTab() {
    const blob = new Blob([withPreviewCsp(shown)], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener");
    // The new tab has already read the blob by the time this runs; revoking on a
    // timer rather than immediately avoids racing slower browsers.
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen
      PaperProps={{ sx: { display: "flex", flexDirection: "column" } }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 2,
          py: 1,
          borderBottom: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
          flexShrink: 0,
        }}
      >
        <Typography sx={{ fontSize: 14, fontWeight: 700 }}>Preview</Typography>
        <Box sx={{ flex: 1 }} />
        {(["desktop", "mobile"] as const).map((d) => (
          <Button
            key={d}
            onClick={() => setDevice(d)}
            sx={{
              textTransform: "none",
              fontWeight: device === d ? 700 : 500,
              color: device === d ? "primary.main" : "text.secondary",
              minWidth: 0,
            }}
          >
            {d === "desktop" ? "Desktop" : "Mobile"}
          </Button>
        ))}
        <Tooltip
          title={dark ? "Previewing dark mode — click for light" : "Preview in dark mode"}
          arrow
        >
          <Button
            onClick={() => setDark((v) => !v)}
            startIcon={dark ? <Sun size={16} /> : <Moon size={16} />}
            sx={{
              textTransform: "none",
              fontWeight: dark ? 700 : 500,
              color: dark ? "primary.main" : "text.secondary",
              minWidth: 0,
            }}
          >
            {dark ? "Light" : "Dark"}
          </Button>
        </Tooltip>
        <Tooltip title="Open in new tab" arrow>
          <IconButton
            onClick={openInNewTab}
            size="small"
            aria-label="Open preview in a new tab"
            sx={{ color: "text.secondary" }}
          >
            <ExternalLink size={17} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Close" arrow>
          <IconButton
            onClick={onClose}
            size="small"
            aria-label="Close preview"
            sx={{ color: "text.secondary" }}
          >
            <X size={18} />
          </IconButton>
        </Tooltip>
      </Box>
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          // Neutral grey gutter in both themes: the email is white (or its own dark
          // rendering), and a theme-following backdrop would change how the edges read.
          bgcolor: "#f0f0f0",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <Box
          component="iframe"
          title="Email preview"
          srcDoc={shown}
          // allow-same-origin only: the email must render, but must not be able to
          // run scripts or navigate the parent.
          // Fully restricted: `allow-same-origin` would put template HTML in this
          // app's origin, and a preview needs no origin at all.
          sandbox=""
          sx={{
            width: device === "mobile" ? MOBILE_W : "100%",
            height: "100%",
            border: "none",
            bgcolor: "#fff",
            boxShadow: device === "mobile" ? "0 0 24px rgba(0,0,0,0.15)" : "none",
          }}
        />
      </Box>
    </Dialog>
  );
}
