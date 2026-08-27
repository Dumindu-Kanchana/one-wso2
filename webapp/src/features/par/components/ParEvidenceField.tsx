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


import { useState, type JSX } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Stack,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { FileTextIcon, PlusIcon, XIcon } from "@wso2/oxygen-ui-icons-react";
import {
  DRIVE_PICKER_ERROR_TEXT,
  useDrivePicker,
} from "../util/useDrivePicker";
import {
  addEvidenceUrl,
  isEvidenceUrl,
  type ParEvidenceFile,
} from "../util/parEvidence";

// Supporting documents for a rating that demands them.
//
// Two ways in, and the paste field is not a lesser one: the stored value is a
// list of URLs either way, so a pasted link is exactly as good as a picked one.
// That matters because the evidence requirement BLOCKS sharing — a lead whose
// Drive consent fails must still be able to finish the review.
//
// Picking is offered first because it produces a real filename, which is the
// only way a document appears as anything other than its own URL.

export default function ParEvidenceField({
  files,
  onChange,
  disabled = false,
}: {
  files: readonly ParEvidenceFile[];
  onChange: (files: ParEvidenceFile[]) => void;
  disabled?: boolean;
}): JSX.Element {
  const picker = useDrivePicker();
  const [pasted, setPasted] = useState("");
  const [pasteProblem, setPasteProblem] = useState<string | null>(null);

  const addPasted = () => {
    const url = pasted.trim();
    if (url === "") return;
    if (!isEvidenceUrl(url)) {
      setPasteProblem("That doesn't look like a Google Docs or Drive link.");
      return;
    }
    const next = addEvidenceUrl(files, url);
    if (next.length === files.length) {
      // Silently doing nothing looks like the button is broken.
      setPasteProblem("That document is already attached.");
      return;
    }
    setPasteProblem(null);
    setPasted("");
    onChange(next);
  };

  const remove = (url: string) => onChange(files.filter((f) => f.url !== url));

  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
        SUPPORTING DOCUMENTS
      </Typography>

      {files.length > 0 && (
        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1, mt: 0.75 }}>
          {files.map((f) => (
            <Chip
              key={f.url}
              size="small"
              icon={<FileTextIcon size={13} />}
              // The URL is the label when the picker did not supply a name, so
              // it is truncated rather than allowed to run the width of the panel.
              label={f.name.length > 48 ? `${f.name.slice(0, 47)}…` : f.name}
              onDelete={disabled ? undefined : () => remove(f.url)}
              deleteIcon={<XIcon size={14} />}
              component="a"
              href={f.url}
              target="_blank"
              rel="noopener noreferrer"
              clickable
              sx={{ maxWidth: 360 }}
            />
          ))}
        </Stack>
      )}

      {files.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Nothing attached yet.
        </Typography>
      )}

      {!disabled && (
        <>
          <Stack direction="row" spacing={1} sx={{ mt: 1.5, alignItems: "flex-start" }}>
            {picker.isAvailable && (
              <Button
                size="small"
                variant="outlined"
                onClick={() => picker.openPicker((picked) => onChange([...files, ...picked]))}
                disabled={picker.isLoading}
                sx={{ textTransform: "none", fontWeight: 600, flexShrink: 0 }}
              >
                {picker.isLoading ? "Opening Drive…" : "Choose from Drive"}
              </Button>
            )}
            <TextField
              size="small"
              label="Or paste a document link"
              value={pasted}
              onChange={(e) => {
                setPasted(e.target.value);
                setPasteProblem(null);
              }}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                // Enter attaches the link. It must not submit the review, which
                // is a separate and one-way act.
                e.preventDefault();
                addPasted();
              }}
              error={pasteProblem !== null}
              helperText={pasteProblem ?? " "}
              sx={{ flex: 1, maxWidth: 460 }}
            />
            <Button
              size="small"
              onClick={addPasted}
              disabled={pasted.trim() === ""}
              startIcon={<PlusIcon size={15} />}
              sx={{ textTransform: "none", fontWeight: 600, mt: 0.25, flexShrink: 0 }}
            >
              Attach
            </Button>
          </Stack>

          {/* Every picker failure names the fallback, because the requirement
              blocks sharing and the lead has to be able to finish regardless. */}
          {picker.error && (
            <Alert severity="warning" sx={{ mt: 1 }}>
              {DRIVE_PICKER_ERROR_TEXT[picker.error]}
            </Alert>
          )}
        </>
      )}
    </Box>
  );
}
