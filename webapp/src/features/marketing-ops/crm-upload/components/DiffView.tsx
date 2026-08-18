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
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  IconButton,
  Typography,
} from "@wso2/oxygen-ui";
import { ArrowLeft, CheckCircle2 } from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import { useExistingRecord, useResolveDuplicate } from "../../api/useCrmUpload";
import type { DuplicateReview } from "../crmUploadTypes";
import { CrmLoading, Empty } from "./CrmUi";
import { CRM_LOADING, NUMERIC, eyebrow, primaryBtn, quietBtn } from "./crmStyles";

// Merging one collision, field by field.
//
// The default is that the INCOMING values win — that is what an ingest is for, and
// making a reviewer approve each field one at a time would turn a queue of hundreds
// into a day's work. So every row starts on incoming, and the arrow pulls one value
// back from the master record. What gets written is the left column.
//
// A field with no difference between the two sides has no toggle at all: an arrow that
// changes nothing is a control that has to be read before it can be ignored.

type Json = Record<string, unknown>;

/** Set by the resolve handler, not by a reviewer; never offered as a merge field. */
const RESERVED = new Set(["Id", "id", "sfId", "referenceId", "attributes"]);

/** Flatten to leaf dot-paths, so a nested `address` block is mergeable per field. */
function leafPaths(obj: Json, prefix = ""): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (!prefix && RESERVED.has(k)) continue;
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out.push(...leafPaths(v as Json, path));
    } else {
      out.push(path);
    }
  }
  return out;
}

function getPath(obj: Json | null | undefined, path: string): unknown {
  if (!obj) return undefined;
  return path.split(".").reduce<unknown>((o, k) => (o == null ? undefined : (o as Json)[k]), obj);
}

// The Entity Service's Customer carries billing fields both nested under `address` and
// flattened at the top level, so a miss on the dotted path falls back to the leaf key.
// Without this, half an account's address reads as empty on the master side.
function existingValue(existing: Json | null | undefined, path: string): unknown {
  const v = getPath(existing, path);
  if (v !== undefined) return v;
  if (path.includes(".")) return getPath(existing, path.split(".").pop()!);
  return undefined;
}

function setPath(target: Json, path: string, value: unknown) {
  const parts = path.split(".");
  let node = target;
  for (let i = 0; i < parts.length - 1; i++) {
    node[parts[i]] = (node[parts[i]] as Json) ?? {};
    node = node[parts[i]] as Json;
  }
  node[parts[parts.length - 1]] = value;
}

function Value({ v }: { v: unknown }) {
  if (v === null || v === undefined || v === "") {
    return (
      <Typography
        component="span"
        sx={{ color: "text.disabled", fontStyle: "italic", fontSize: 13 }}
      >
        —
      </Typography>
    );
  }
  return (
    <Typography component="span" sx={{ fontSize: 13, ...NUMERIC }}>
      {String(v)}
    </Typography>
  );
}

const GRID = "160px 1fr 44px 1fr";

export default function DiffView({
  dup,
  onClose,
  onResolved,
}: {
  dup: DuplicateReview;
  onClose: () => void;
  onResolved: () => void;
}) {
  const fields = useMemo(() => leafPaths(dup.incoming as Json), [dup.incoming]);

  const existingQuery = useExistingRecord(dup.id, dup.sf_existing_id);
  const existing = existingQuery.data?.existing as Json | undefined;

  const resolve = useResolveDuplicate();
  const [error, setError] = useState<string | null>(null);

  // Which side each field takes. Seeded to incoming for every field — see the note at
  // the top of the file on why that is the default rather than a neutral start.
  const [fromMaster, setFromMaster] = useState<Record<string, boolean>>({});

  const valueFor = (field: string) =>
    fromMaster[field] ? existingValue(existing, field) : getPath(dup.incoming as Json, field);

  const overridden = Object.values(fromMaster).filter(Boolean).length;

  // Every incoming field already matches the master — there is nothing to merge, so the
  // only meaningful resolution is to dismiss. The dialog changes its own primary action
  // rather than letting someone "merge" a no-op and wonder why nothing changed.
  const allIdentical =
    Boolean(existing) &&
    fields.length > 0 &&
    fields.every((f) => getPath(dup.incoming as Json, f) === existingValue(existing, f));

  async function act(body: Parameters<typeof resolve.mutateAsync>[0]["body"]) {
    setError(null);
    try {
      await resolve.mutateAsync({ id: dup.id, body });
      onResolved();
    } catch (e) {
      setError(describeError(e));
    }
  }

  function confirmMerge() {
    const merged_fields: Json = {};
    fields.forEach((f) => setPath(merged_fields, f, valueFor(f)));
    void act({ action: "merge", merged_fields });
  }

  const busy = resolve.isPending;

  return (
    <Dialog open fullWidth maxWidth="md" onClose={busy ? undefined : onClose}>
      <Box sx={{ px: 3, pt: 3, pb: 2.5, borderBottom: 1, borderColor: "divider" }}>
        <Typography sx={{ ...eyebrow, mb: 0.75 }}>Duplicate · Merge review</Typography>
        <Box
          sx={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 3,
            flexWrap: "wrap",
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography
              sx={{ fontSize: 21, fontWeight: 800, letterSpacing: "-0.02em", mb: 0.5 }}
            >
              Merge review
            </Typography>
            <Typography sx={{ fontSize: 12.5, color: "text.secondary", maxWidth: "60ch" }}>
              The values on the left will be written to the existing record. Use the arrow to pull
              a value from the master record instead.
            </Typography>
          </Box>
          <Chip
            label={dup.sf_existing_id}
            size="small"
            sx={{
              fontSize: 11,
              fontWeight: 700,
              height: 22,
              ...NUMERIC,
              bgcolor: "transparent",
              color: "warning.main",
              border: 1,
              borderColor: "warning.main",
            }}
          />
        </Box>
      </Box>

      <DialogContent sx={{ px: 3, pt: 2.5 }}>
        {existingQuery.isError ? (
          <Alert severity="error">
            Could not load the Salesforce record. {describeError(existingQuery.error)}
          </Alert>
        ) : !existing ? (
          <CrmLoading messages={CRM_LOADING.diff} />
        ) : (
          <>
            {allIdentical && (
              <Alert icon={<CheckCircle2 size={16} />} severity="success" sx={{ mb: 2, fontSize: 12.5 }}>
                <Box sx={{ fontWeight: 700 }}>Identical to the master record</Box>
                Every incoming field already matches Salesforce — there's nothing to merge. You can
                dismiss this record.
              </Alert>
            )}

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: GRID,
                gap: 1.5,
                mb: 1,
                pb: 1,
                borderBottom: 1,
                borderColor: "divider",
              }}
            >
              <Typography sx={eyebrow}>Field</Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                <Box sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: "primary.main" }} />
                <Typography sx={{ ...eyebrow, color: "primary.main" }}>Incoming (final)</Typography>
              </Box>
              <Box />
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                <Box sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: "text.disabled" }} />
                <Typography sx={eyebrow}>Master record</Typography>
              </Box>
            </Box>

            {fields.map((field) => {
              const incoming = getPath(dup.incoming as Json, field);
              const master = existingValue(existing, field);
              const differs = incoming !== master;
              const taken = Boolean(fromMaster[field]);

              return (
                <Box
                  key={field}
                  sx={{
                    display: "grid",
                    gridTemplateColumns: GRID,
                    gap: 1.5,
                    alignItems: "center",
                    py: 0.85,
                    borderBottom: 1,
                    borderColor: "divider",
                    "&:last-of-type": { borderBottom: 0 },
                  }}
                >
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: "text.secondary" }}>
                    {field}
                  </Typography>

                  <Box
                    sx={{
                      p: 0.85,
                      borderRadius: 1,
                      border: 1,
                      borderColor: taken ? "primary.main" : "transparent",
                    }}
                  >
                    <Value v={valueFor(field)} />
                    {taken && (
                      // What the incoming record actually said, kept visible: a merge is
                      // an edit to someone else's data, and the reviewer should be able
                      // to see what they overrode without undoing it.
                      <Typography
                        sx={{ fontSize: 11, color: "text.disabled", mt: 0.25, fontStyle: "italic" }}
                      >
                        was: {incoming === null || incoming === undefined || incoming === ""
                          ? "—"
                          : String(incoming)}
                      </Typography>
                    )}
                  </Box>

                  <Box sx={{ display: "flex", justifyContent: "center" }}>
                    {differs && (
                      <IconButton
                        size="small"
                        aria-label={`Take ${field} from the master record`}
                        aria-pressed={taken}
                        onClick={() => setFromMaster((s) => ({ ...s, [field]: !s[field] }))}
                        sx={{
                          width: 30,
                          height: 30,
                          bgcolor: taken ? "primary.main" : "transparent",
                          color: taken ? "primary.contrastText" : "primary.main",
                          border: 1,
                          borderColor: "primary.main",
                          "&:hover": { bgcolor: taken ? "primary.dark" : "action.hover" },
                        }}
                      >
                        <ArrowLeft size={15} />
                      </IconButton>
                    )}
                  </Box>

                  <Box sx={{ p: 0.85, color: differs ? "warning.main" : "inherit" }}>
                    <Value v={master} />
                  </Box>
                </Box>
              );
            })}

            {fields.length === 0 && <Empty>No fields to merge.</Empty>}

            {error && (
              <Alert severity="error" sx={{ mt: 2, fontSize: 12.5 }}>
                {error}
              </Alert>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions
        sx={{
          px: 3,
          pb: 2.5,
          pt: 1.5,
          gap: 1,
          borderTop: 1,
          borderColor: "divider",
          justifyContent: "space-between",
        }}
      >
        <Typography sx={{ fontSize: 11.5, color: "text.secondary", fontWeight: 600, ...NUMERIC }}>
          {allIdentical
            ? "No differences to merge"
            : overridden > 0
              ? `${overridden} field${overridden === 1 ? "" : "s"} overridden from master`
              : `${fields.length} field${fields.length === 1 ? "" : "s"} will be merged`}
        </Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button onClick={onClose} disabled={busy} sx={quietBtn}>
            Cancel
          </Button>
          {allIdentical ? (
            <Button
              variant="contained"
              color="inherit"
              onClick={() => void act({ action: "dismiss" })}
              disabled={busy}
              sx={primaryBtn}
            >
              {busy ? "Dismissing…" : "Dismiss record"}
            </Button>
          ) : (
            <Button
              variant="contained"
              onClick={confirmMerge}
              disabled={busy || !existing || fields.length === 0}
              sx={primaryBtn}
            >
              {busy ? "Saving…" : "Confirm merge"}
            </Button>
          )}
        </Box>
      </DialogActions>
    </Dialog>
  );
}
