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
  OutlinedInput,
  Stack,
  Switch,
  Typography,
} from "@wso2/oxygen-ui";
import { describeError } from "@api/errors";
import { MARKETING_OPS_EYEBROW } from "@constants/marketingOpsApps";
import MarketingOpsShell from "../../components/MarketingOpsShell";
import {
  usePardotSettings,
  useSavePardotSettings,
} from "../../api/useEmailWorkbench";
import type { PardotSettings } from "../../email-workbench/emailWorkbenchTypes";

// Marketing Admin → Email Workbench Pardot send defaults.
//
// Pardot's create-email-template API requires these on every send (campaignId,
// trackerDomainId, the four type flags, senderOptions). They're identical for every
// email, so they're set once here and applied automatically on Push to Pardot —
// which is why a marketer never sees them in the editor.
//
// A singleton config, not an editable value list, so this is a plain form rather
// than the ParameterListManager the other admin panels use.

const TYPE_FLAGS: { key: keyof PardotSettings; label: string; help: string }[] = [
  { key: "is_list_email", label: "List email", help: "Can be sent to a prospect list." },
  { key: "is_drip_email", label: "Drip email", help: "Usable in Engagement Studio drip programs." },
  {
    key: "is_auto_responder_email",
    label: "Auto-responder",
    help: "Usable as a form/completion auto-response.",
  },
  { key: "is_one_to_one_email", label: "One-to-one", help: "Sent individually from a prospect record." },
];

// Compare only the EDITABLE fields for the dirty flag — updated_by/updated_at come
// back changed from the server on every save and would otherwise make the form look
// permanently unsaved.
//
// Keys are listed explicitly rather than rest-destructured away: the audit fields are
// the exception, so naming what IS compared means a field added to PardotSettings
// later has to be considered rather than silently included.
const COMPARED: (keyof PardotSettings)[] = [
  "campaign_id",
  "tracker_domain_id",
  "is_one_to_one_email",
  "is_auto_responder_email",
  "is_drip_email",
  "is_list_email",
  "sender_options_address",
  "sender_options_name",
];

function editable(s: PardotSettings): string {
  return JSON.stringify(COMPARED.map((k) => s[k] ?? null));
}

const LABEL = {
  fontSize: 11,
  fontWeight: 700,
  color: "text.secondary",
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
  mb: 0.5,
};
const inputSx = { fontSize: 13, bgcolor: "background.default" } as const;

export default function EmailWorkbenchSettingsPage() {
  const query = usePardotSettings();
  const save = useSavePardotSettings();

  // Server data is the baseline; `edits` holds only what changed. Same
  // derive-don't-sync shape as the other admin panels — a background refetch can't
  // discard in-progress edits, and after a save the baseline advances by itself.
  const [edits, setEdits] = useState<Partial<PardotSettings> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedOnce, setSavedOnce] = useState(false);

  const baseline = query.data;
  const settings = baseline ? { ...baseline, ...(edits ?? {}) } : undefined;
  const dirty = Boolean(baseline && settings && editable(settings) !== editable(baseline));

  function patch(p: Partial<PardotSettings>) {
    setEdits((s) => ({ ...(s ?? {}), ...p }));
    setSavedOnce(false);
  }

  // Empty clears the field rather than sending 0 — a campaign id of 0 is a real
  // (wrong) id, whereas null means "not configured".
  function num(v: string): number | null {
    const n = parseInt(v, 10);
    return v.trim() === "" || Number.isNaN(n) ? null : n;
  }

  async function submit() {
    if (!settings) return;
    setError(null);
    try {
      await save.mutateAsync(settings);
      setEdits(null);
      setSavedOnce(true);
    } catch (e) {
      setError(describeError(e));
    }
  }

  return (
    <MarketingOpsShell
      eyebrow={MARKETING_OPS_EYEBROW.admin}
      title="Email Workbench — Pardot defaults"
      subtitle="Applied automatically to every email pushed to Pardot. Marketers never see these, so a wrong value here is wrong for every send."
    >
      {query.isError ? (
        <Alert severity="error">
          Could not load the Pardot settings. {describeError(query.error)}
        </Alert>
      ) : !settings ? (
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", py: 3 }}>
          <CircularProgress size={16} />
          <Typography sx={{ fontSize: 13, color: "text.secondary" }}>Loading settings…</Typography>
        </Stack>
      ) : (
        <Box sx={{ maxWidth: 720 }}>
          <Typography sx={{ fontSize: 15, fontWeight: 800, mb: 1.5 }}>Campaign &amp; tracking</Typography>
          <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap" }}>
            <Box sx={{ flex: 1, minWidth: 200 }}>
              <Typography sx={LABEL}>Campaign ID</Typography>
              <OutlinedInput
                fullWidth
                size="small"
                type="number"
                value={settings.campaign_id ?? ""}
                onChange={(e) => patch({ campaign_id: num(e.target.value) })}
                sx={inputSx}
              />
            </Box>
            <Box sx={{ flex: 1, minWidth: 200 }}>
              <Typography sx={LABEL}>Tracker domain ID</Typography>
              <OutlinedInput
                fullWidth
                size="small"
                type="number"
                value={settings.tracker_domain_id ?? ""}
                onChange={(e) => patch({ tracker_domain_id: num(e.target.value) })}
                sx={inputSx}
              />
            </Box>
          </Box>

          <Typography sx={{ fontSize: 15, fontWeight: 800, mb: 0.5 }}>Email type</Typography>
          <Typography sx={{ fontSize: 12, color: "text.secondary", mb: 1 }}>
            Which Pardot email types this template qualifies as.
          </Typography>
          <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, mb: 3, overflow: "hidden" }}>
            {TYPE_FLAGS.map((f, i) => (
              <Box
                key={String(f.key)}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  px: 1.5,
                  py: 0.75,
                  borderTop: i ? 1 : 0,
                  borderColor: "divider",
                }}
              >
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{f.label}</Typography>
                  <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>{f.help}</Typography>
                </Box>
                <Switch
                  checked={Boolean(settings[f.key])}
                  inputProps={{ "aria-label": f.label }}
                  onChange={(e) => patch({ [f.key]: e.target.checked } as Partial<PardotSettings>)}
                />
              </Box>
            ))}
          </Box>

          <Typography sx={{ fontSize: 15, fontWeight: 800, mb: 0.5 }}>Sender options</Typography>
          <Typography sx={{ fontSize: 12, color: "text.secondary", mb: 1 }}>
            Who the email is sent from in Pardot. Only the name and address are configurable — the
            sender type is fixed server-side.
          </Typography>
          <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap" }}>
            <Box sx={{ flex: 1, minWidth: 180 }}>
              <Typography sx={LABEL}>Name</Typography>
              <OutlinedInput
                fullWidth
                size="small"
                placeholder="WSO2"
                value={settings.sender_options_name ?? ""}
                onChange={(e) => patch({ sender_options_name: e.target.value })}
                sx={inputSx}
              />
            </Box>
            <Box sx={{ flex: 1.4, minWidth: 220 }}>
              <Typography sx={LABEL}>Address</Typography>
              <OutlinedInput
                fullWidth
                size="small"
                placeholder="response@wso2.com"
                value={settings.sender_options_address ?? ""}
                onChange={(e) => patch({ sender_options_address: e.target.value })}
                sx={inputSx}
              />
            </Box>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mt: 2, fontSize: 13 }}>
              {error}
            </Alert>
          )}
          {savedOnce && !dirty && (
            <Alert severity="success" sx={{ mt: 2, fontSize: 13 }}>
              Settings saved.
            </Alert>
          )}

          <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end", mt: 3 }}>
            <Button
              onClick={() => {
                setEdits(null);
                setSavedOnce(false);
                setError(null);
              }}
              disabled={!dirty || save.isPending}
              sx={{ textTransform: "none", color: "text.secondary" }}
            >
              Discard
            </Button>
            <Button
              onClick={submit}
              disabled={!dirty || save.isPending}
              variant="contained"
              startIcon={save.isPending ? <CircularProgress size={15} color="inherit" /> : undefined}
              sx={{ textTransform: "none", fontWeight: 700 }}
            >
              {save.isPending ? "Saving…" : "Save changes"}
            </Button>
          </Box>
        </Box>
      )}
    </MarketingOpsShell>
  );
}
