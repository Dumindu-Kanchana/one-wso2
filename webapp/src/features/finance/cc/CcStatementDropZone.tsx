/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { useRef, useState } from "react";
import { Box, IconButton, Stack, Typography } from "@wso2/oxygen-ui";
import { FileTextIcon, UploadCloudIcon, XIcon } from "@wso2/oxygen-ui-icons-react";

/** FileUpload.tsx:128-134 — same units, same two-decimal trim. */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i] ?? "GB"}`;
}

/** FileUpload.tsx:89-94 — the extension, not the browser's guess at the type. */
function isCsv(file: File): boolean {
  return file.name.toLowerCase().split(".").pop() === "csv";
}

/**
 * Where a bank statement gets dropped.
 *
 * The source's own control (FileUpload.tsx): a drop target that takes a click
 * too, the file's name and size once chosen, and a clear button. The port had
 * a single "Upload statement CSV" button, so the only way in was the file
 * picker and a chosen file could not be taken back.
 *
 * The extension check stays here rather than living on the input's `accept`,
 * which filters the picker's default view and nothing else — a drop bypasses
 * it entirely.
 */
export function CcStatementDropZone({
  file,
  disabled,
  onPick,
  onClear,
}: {
  file: File | null;
  disabled?: boolean;
  onPick: (file: File) => void;
  onClear: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");

  const take = (picked: File | undefined) => {
    if (!picked) return;
    if (!isCsv(picked)) {
      setError("Invalid file type. Please upload a CSV file.");
      return;
    }
    setError("");
    onPick(picked);
  };

  if (file) {
    return (
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ border: 1, borderColor: "divider", borderRadius: 1.5, p: 1.5 }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <FileTextIcon size={28} style={{ flexShrink: 0 }} />
          <Box>
            <Typography sx={{ fontSize: 13.5, fontWeight: 600 }}>{file.name}</Typography>
            <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
              {formatFileSize(file.size)}
            </Typography>
          </Box>
        </Stack>
        <IconButton size="small" aria-label="Clear file" onClick={onClear} disabled={disabled}>
          <XIcon size={16} />
        </IconButton>
      </Stack>
    );
  }

  return (
    <Box>
      <Box
        role="button"
        tabIndex={0}
        aria-label="Drag & drop your CSV file here or click"
        onDragEnter={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          take(e.dataTransfer.files?.[0]);
        }}
        onClick={() => input.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") input.current?.click();
        }}
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 1,
          py: 4,
          px: 2,
          border: "1px dashed",
          borderColor: dragging ? "primary.main" : "divider",
          borderRadius: 1.5,
          bgcolor: dragging ? "action.hover" : "transparent",
          cursor: disabled ? "default" : "pointer",
          opacity: disabled ? 0.6 : 1,
          textAlign: "center",
        }}
      >
        <input
          ref={input}
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            take(e.target.files?.[0]);
            if (input.current) input.current.value = "";
          }}
          style={{ display: "none" }}
        />
        <UploadCloudIcon size={34} style={{ opacity: dragging ? 1 : 0.6 }} />
        <Typography sx={{ fontSize: 14, color: dragging ? "primary.main" : "text.secondary" }}>
          {dragging ? "Drop your file here" : "Drag & drop your CSV file here or click"}
        </Typography>
      </Box>
      {error && (
        <Typography sx={{ fontSize: 12.5, color: "error.main", mt: 0.75 }}>{error}</Typography>
      )}
    </Box>
  );
}
