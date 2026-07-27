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

import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Skeleton,
  Typography,
} from "@wso2/oxygen-ui";
import { useAsgardeo } from "@asgardeo/react";
import { HttpError } from "@api/http";
import { peopleServiceUrls } from "@config/apiConfig";

// Employee QR-code dialog. Mirrors people-app/webapp's view/me QR flow —
// GET /employees/{employeeId}/qr-code returns a PNG binary; we blob-URL it
// for the <img> and revoke on close. Backend enforces isSelf for non-admin
// users so we don't need to re-check here.
export default function EmployeeQrDialog({
  open,
  employeeId,
  email,
  onClose,
}: {
  open: boolean;
  employeeId?: string;
  email?: string;
  onClose: () => void;
}) {
  const { getIdToken } = useAsgardeo();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch on open. Effect cleanup covers cancelled fetches (dialog closed
  // mid-flight); a separate url-lifecycle effect below revokes the blob
  // URL on unmount / next fetch.
  useEffect(() => {
    if (!open || !employeeId) {
      setStatus("idle");
      setUrl(null);
      setError(null);
      return;
    }
    let cancelled = false;
    // AbortController actually cancels the in-flight request when the
    // dialog closes mid-fetch — `cancelled` alone only suppresses the
    // state update on the next tick; a hung backend would still keep
    // the connection open until it timed out.
    const controller = new AbortController();
    setStatus("loading");
    setError(null);
    (async () => {
      try {
        const idToken = await getIdToken();
        if (!idToken) throw new Error("No id_token available from Asgardeo");
        const res = await fetch(peopleServiceUrls.employeeQrCode(employeeId), {
          headers: { Authorization: `Bearer ${idToken}` },
          signal: controller.signal,
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new HttpError(res.url, res.status, text);
        }
        const blob = await res.blob();
        if (cancelled) return;
        setUrl(URL.createObjectURL(blob));
        setStatus("success");
      } catch (e) {
        if (cancelled) return;
        // A user-initiated abort (dialog closed while fetch was in
        // flight) shows up as a DOMException / AbortError — don't
        // surface it as a red error, the component is already gone.
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError(readableError(e));
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [open, employeeId, getIdToken]);

  useEffect(() => {
    if (!url) return;
    return () => URL.revokeObjectURL(url);
  }, [url]);

  const handleDownload = () => {
    if (!url || !employeeId) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `qr-${employeeId}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Typography sx={{ fontSize: 17, fontWeight: 700 }}>Employee QR Code</Typography>
        {email && (
          <Typography sx={{ fontSize: 12.5, color: "text.secondary", mt: 0.25 }}>
            {email}
          </Typography>
        )}
      </DialogTitle>
      <DialogContent
        dividers
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          // Reserve QR-sized space only while loading/rendering the image;
          // let error state collapse to natural Alert height so the dialog
          // isn't half-empty when the backend rejects.
          minHeight: status === "error" ? undefined : 280,
          p: status === "error" ? 2 : 3,
        }}
      >
        {status === "loading" && (
          <Skeleton variant="rectangular" width={240} height={240} sx={{ borderRadius: 1.5 }} />
        )}
        {status === "success" && url && (
          <Box
            component="img"
            src={url}
            alt="Employee QR Code"
            sx={{ maxWidth: "100%", display: "block", borderRadius: 1.5 }}
          />
        )}
        {status === "error" && (
          <Alert severity="error" sx={{ width: "100%", fontSize: 13 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 600, mb: 0.25 }}>
              Couldn't generate your QR code
            </Typography>
            <Typography sx={{ fontSize: 12.5, mb: 0.75 }}>
              {error ?? "Failed to load QR code."}
            </Typography>
            <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
              Contact People Ops to update your record, then try again.
            </Typography>
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        {status === "success" && url && (
          <Button size="small" onClick={handleDownload} startIcon={<DownloadIcon />}>
            Download
          </Button>
        )}
        <Button size="small" onClick={onClose}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function readableError(err: unknown): string {
  if (err instanceof HttpError && err.responseBody) {
    try {
      const parsed = JSON.parse(err.responseBody) as { message?: string };
      return parsed.message ?? err.responseBody;
    } catch {
      return err.responseBody;
    }
  }
  if (err instanceof Error) return err.message;
  return "Failed to load QR code";
}

function DownloadIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1={12} y1={15} x2={12} y2={3} />
    </svg>
  );
}
