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
  Box,
  Button,
  Dialog,
  DialogActions,
  OutlinedInput,
  Typography,
} from "@wso2/oxygen-ui";
import { DEFAULTS, buildUtmUrl } from "../../utilities/utm";
import { UtmControls, UtmSegments } from "./UtmControls";
import { today, type UtmState } from "./utmState";

// Build a tracking URL for ONE link, opened pre-filled with that link's current URL.
// Same builder as the standalone Utilities tool, so a link tagged in the editor is
// indistinguishable from one built there.

const labelSx = {
  fontSize: 11,
  fontWeight: 700,
  color: "text.secondary",
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
  mb: 0.5,
};

// Drop any existing utm_* params so re-opening the builder rebuilds cleanly, while
// keeping other query params the link already carries — those are usually
// functional (a product id, a locale) and dropping them would break the link.
function baseUrl(u: string): string {
  const [path, query] = u.split("?");
  if (!query) return u;
  const kept = query.split("&").filter((p) => !/^utm_/i.test(p));
  return kept.length ? `${path}?${kept.join("&")}` : path;
}

export default function UtmDialog({
  open,
  initialUrl,
  onApply,
  onClose,
}: {
  open: boolean;
  initialUrl: string;
  onApply: (url: string) => void;
  onClose: () => void;
}) {
  const [pageUrl, setPageUrl] = useState(() => baseUrl(initialUrl));
  const [utm, setUtm] = useState<UtmState>(() => ({
    campaign: "",
    startDate: today(),
    source: DEFAULTS.source,
    medium: DEFAULTS.medium,
    region: DEFAULTS.region,
    bu: DEFAULTS.bu,
  }));

  const { url, segments } = useMemo(() => buildUtmUrl({ pageUrl, ...utm }), [pageUrl, utm]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <Box sx={{ p: 3 }}>
        <Typography sx={{ fontSize: 16, fontWeight: 800, mb: 0.5 }}>Build tracking URL</Typography>
        <Typography sx={{ fontSize: 13, color: "text.secondary", mb: 2 }}>
          Standardized UTM parameters are added automatically. Apply to set this link's URL.
        </Typography>

        <Typography sx={labelSx}>Page URL</Typography>
        <OutlinedInput
          fullWidth
          size="small"
          value={pageUrl}
          placeholder="https://wso2.com/..."
          onChange={(e) => setPageUrl(e.target.value)}
          sx={{ height: 38, fontSize: 13, bgcolor: "background.default", fontFamily: "monospace", mb: 2 }}
        />

        <UtmControls state={utm} onChange={(patch) => setUtm((s) => ({ ...s, ...patch }))} />
        <UtmSegments segments={segments} />

        <Typography sx={labelSx}>Result</Typography>
        <Box
          sx={{
            p: 1.25,
            borderRadius: 1,
            bgcolor: "background.default",
            border: 1,
            borderColor: "divider",
            fontFamily: "monospace",
            fontSize: 12,
            wordBreak: "break-all",
            color: url ? "text.primary" : "text.disabled",
            minHeight: 20,
          }}
        >
          {url || "Enter a Page URL…"}
        </Box>
      </Box>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} sx={{ textTransform: "none", color: "text.secondary" }}>
          Cancel
        </Button>
        <Button
          onClick={() => {
            onApply(url);
            onClose();
          }}
          disabled={!url}
          variant="contained"
          sx={{ textTransform: "none", fontWeight: 700 }}
        >
          Apply to link
        </Button>
      </DialogActions>
    </Dialog>
  );
}
