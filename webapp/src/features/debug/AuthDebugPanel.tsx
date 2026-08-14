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

import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { useAsgardeo } from "@asgardeo/react";
import { peopleBackendUrl } from "@config/apiConfig";

// Dev-only debug: floating pill at bottom-right that opens a dialog with
// the decoded id_token AND access_token, so we can eyeball whether email +
// groups (the id_token claims people-app's backend requires) are actually
// being issued, and — separately — whether the access_token actually being
// sent as the Bearer credential on every API call (see @api/http) is the
// one a rejecting backend is unhappy with.
//
// Only mounted in dev (import.meta.env.DEV). Nothing in this component
// makes a network request — it just decodes each JWT client-side. Payload
// is displayed in a monospace <pre> that scrolls, and a couple of quick
// verdict chips call out the two id_token claims the backend cares about.
export default function AuthDebugPanel() {
  if (!import.meta.env.DEV) return null;
  return <AuthDebugPanelInner />;
}

interface DecodedToken {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
}

// Memo output is a discriminated union so we never call setState during
// render — parse errors are represented as a variant instead.
type DecodeResult =
  | { kind: "empty" }
  | { kind: "ok"; decoded: DecodedToken }
  | { kind: "error"; message: string };

function decodeJwt(rawToken: string): DecodeResult {
  if (!rawToken) return { kind: "empty" };
  try {
    const parts = rawToken.split(".");
    if (parts.length < 2) throw new Error("Not a JWT (expected header.payload.signature)");
    return {
      kind: "ok",
      decoded: {
        header: JSON.parse(b64urlDecode(parts[0])),
        payload: JSON.parse(b64urlDecode(parts[1])),
      },
    };
  } catch (e) {
    return { kind: "error", message: e instanceof Error ? e.message : String(e) };
  }
}

function useDecodedToken(open: boolean, isSignedIn: boolean, getToken: () => Promise<string>) {
  const [rawToken, setRawToken] = useState<string>("");
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !isSignedIn) return;
    let cancelled = false;
    getToken()
      .then((t) => {
        if (cancelled) return;
        setRawToken(t ?? "");
        setFetchError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        setFetchError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [open, isSignedIn, getToken]);

  const result = useMemo(() => decodeJwt(rawToken), [rawToken]);
  const decoded = result.kind === "ok" ? result.decoded : null;
  const displayError = fetchError ?? (result.kind === "error" ? result.message : null);

  return { rawToken, decoded, displayError };
}

function AuthDebugPanelInner() {
  const { isSignedIn, getIdToken, getAccessToken } = useAsgardeo();
  const [open, setOpen] = useState(false);

  const idToken = useDecodedToken(open, isSignedIn, getIdToken);
  const accessToken = useDecodedToken(open, isSignedIn, getAccessToken);

  const email = idToken.decoded?.payload["email"];
  const groups = idToken.decoded?.payload["groups"];
  const hasEmail = typeof email === "string" && email.length > 0;
  const hasGroups = Array.isArray(groups) && groups.length > 0;

  return (
    <>
      <Tooltip title="Auth debug — decode id_token & access_token">
        <Button
          variant="contained"
          size="small"
          onClick={() => setOpen(true)}
          sx={{
            position: "fixed",
            right: 16,
            bottom: 16,
            zIndex: (t) => t.zIndex.tooltip + 1,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            boxShadow: 4,
            opacity: 0.9,
          }}
        >
          🔐 auth
        </Button>
      </Tooltip>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <span>Auth debug — id_token & access_token</span>
          <Chip
            size="small"
            label={isSignedIn ? "signed in" : "signed out"}
            color={isSignedIn ? "success" : "default"}
            sx={{ height: 20, fontSize: 10.5 }}
          />
        </DialogTitle>
        <DialogContent dividers>
          <Section title="Environment">
            <KVRow k="peopleBackendUrl" v={peopleBackendUrl || "(unset)"} mono />
          </Section>

          <Section title="Required claims (id_token)">
            <Stack direction="row" spacing={1}>
              <Chip
                size="small"
                label={hasEmail ? `email: ${email}` : "email missing"}
                color={hasEmail ? "success" : "error"}
              />
              <Chip
                size="small"
                label={hasGroups ? `groups: ${(groups as string[]).length}` : "groups missing"}
                color={hasGroups ? "success" : "error"}
              />
            </Stack>
            {hasGroups && (
              <Typography sx={{ fontSize: 12, color: "text.secondary", mt: 1, fontFamily: "monospace" }}>
                {(groups as string[]).join(", ")}
              </Typography>
            )}
            <Typography sx={{ fontSize: 11.5, color: "text.disabled", mt: 1, lineHeight: 1.5 }}>
              The Ballerina <code>JwtInterceptor</code> in people-app decodes <code>x-jwt-assertion</code> and
              casts it to <code>{"{ email: string, groups: string[] }"}</code>. Both must be present or the
              request 500s with <em>Malformed Invoker info object!</em>.
            </Typography>
          </Section>

          <TokenSection label="ID token" token={idToken} />
          <TokenSection
            label="Access token"
            token={accessToken}
            note="This is the token actually attached as the Bearer credential on every API call — check this one first when a backend rejects a request."
          />
        </DialogContent>
        <DialogActions>
          <Box sx={{ flex: 1 }} />
          <Button size="small" variant="contained" onClick={() => setOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function TokenSection({
  label,
  token,
  note,
}: {
  label: string;
  token: { rawToken: string; decoded: DecodedToken | null; displayError: string | null };
  note?: string;
}) {
  const { rawToken, decoded, displayError } = token;
  return (
    <Section title={label}>
      {note && (
        <Typography sx={{ fontSize: 11.5, color: "text.disabled", mb: 1, lineHeight: 1.5 }}>{note}</Typography>
      )}

      {displayError && (
        <Typography sx={{ fontSize: 12.5, color: "error.main", fontFamily: "monospace", mb: 1 }}>
          {displayError}
        </Typography>
      )}

      <Typography sx={{ fontSize: 11, fontWeight: 700, color: "text.disabled", mb: 0.5 }}>
        Decoded header
      </Typography>
      <Pre>{decoded ? pretty(decoded.header) : rawToken ? "decoding…" : "(no token yet)"}</Pre>

      <Typography sx={{ fontSize: 11, fontWeight: 700, color: "text.disabled", mt: 1.25, mb: 0.5 }}>
        Decoded payload
      </Typography>
      <Pre>{decoded ? pretty(decoded.payload) : rawToken ? "decoding…" : "(no token yet)"}</Pre>

      <Typography sx={{ fontSize: 11, fontWeight: 700, color: "text.disabled", mt: 1.25, mb: 0.5 }}>
        Raw token
      </Typography>
      <Pre wrap>{rawToken || "(no token yet — open this dialog while signed in)"}</Pre>

      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
        <Button
          size="small"
          onClick={() => {
            if (rawToken) void navigator.clipboard.writeText(rawToken);
          }}
          disabled={!rawToken}
        >
          Copy raw
        </Button>
        <Button
          size="small"
          onClick={() => {
            if (decoded) void navigator.clipboard.writeText(pretty(decoded.payload));
          }}
          disabled={!decoded}
        >
          Copy payload
        </Button>
      </Stack>
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box sx={{ mb: 2 }}>
      <Typography
        sx={{
          fontSize: 10.5,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "text.disabled",
          fontWeight: 700,
          mb: 0.75,
        }}
      >
        {title}
      </Typography>
      {children}
    </Box>
  );
}

function KVRow({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "baseline" }}>
      <Typography sx={{ fontSize: 12, fontWeight: 600, minWidth: 140 }}>{k}</Typography>
      <Typography sx={{ fontSize: 12, fontFamily: mono ? "monospace" : undefined, wordBreak: "break-all" }}>
        {v}
      </Typography>
    </Stack>
  );
}

function Pre({ children, wrap }: { children: React.ReactNode; wrap?: boolean }) {
  return (
    <Box
      component="pre"
      sx={{
        fontSize: 11.5,
        fontFamily: "monospace",
        bgcolor: "action.hover",
        border: 1,
        borderColor: "divider",
        borderRadius: 1,
        p: 1.25,
        m: 0,
        maxHeight: 260,
        overflow: "auto",
        whiteSpace: wrap ? "pre-wrap" : "pre",
        wordBreak: wrap ? "break-all" : "normal",
      }}
    >
      {children}
    </Box>
  );
}

// base64url → utf8 string. Browser atob() doesn't accept the url-safe
// alphabet or missing padding, so we normalise first.
function b64urlDecode(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  // Convert binary string to UTF-8 (JWT payloads are UTF-8 JSON).
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}

function pretty(obj: unknown): string {
  return JSON.stringify(obj, null, 2);
}
