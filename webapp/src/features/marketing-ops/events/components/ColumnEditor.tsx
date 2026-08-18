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
  IconButton,
  MenuItem,
  Select,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Plus,
  Trash2,
} from "@wso2/oxygen-ui-icons-react";
import { COMPUTED_LABEL, MAPPABLE_COMPUTED } from "../rules/schema";
import type { FieldDef } from "../eventsTypes";
import { fieldHint, fieldInput, fieldLabel, primaryBtn, quietBtn } from "./eventsStyles";

// The columns of one member status.
//
// Two facts about a column, kept apart deliberately: what the SHEET calls it, and what
// MOP calls it. That separation is why the template can say
// "Area of interest - MQL stage (Pick from the drop down)" while the grid and the CSV
// say "Area of interest" — and why marketing can reword the template's guidance text
// without breaking an import.
//
// Rendered inside StatusEditor, below the status' own fields — a column list belongs to
// exactly one status and is meaningless without it.
//
// Two types only. There is no email type: an email is a text column with a pattern.
// Baking email in would have meant a release for every other format anyone wanted — a
// phone shape, an employee id, a URL.

/** The pattern the seed uses for an email column, offered as a shortcut so nobody has
 *  to write it from memory. Deliberately permissive — Pardot does the real check. */
const EMAIL_PATTERN = String.raw`^[^@\s]+@[^@\s.]+\.[^@\s]+$`;

const blank = (): FieldDef => ({
  header_label: "",
  field_name: "",
  data_type: "text",
  pattern: null,
  picklist: [],
  mandatory: false,
  computed: false,
});

/** Does this compile, and does it say anything? An invalid pattern stored unchecked
 *  would reject every value on every upload with no clue why. */
function patternError(pattern: string | null | undefined): string | null {
  if (!pattern) return null;
  try {
    new RegExp(pattern);
  } catch (e) {
    return e instanceof Error ? e.message : "invalid";
  }
  return null;
}

export default function ColumnEditor({
  fields,
  baseline,
  onChange,
  onSave,
  onDiscard,
}: {
  fields: FieldDef[];
  baseline: FieldDef[];
  onChange: (fields: FieldDef[]) => void;
  onSave: (fields: FieldDef[]) => Promise<void>;
  onDiscard: () => void;
}) {
  const [saving, setSaving] = useState(false);
  /** Which column's form is open. One at a time — twenty expanded forms is not a list
   *  any more, it is a page nobody can find anything on. */
  const [open, setOpen] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty = JSON.stringify(fields) !== JSON.stringify(baseline);

  /** Computed keys already spoken for. MOP fills each in once, so two headings claiming
   *  the same one is a contradiction rather than a duplicate. */
  const taken = useMemo(
    () => new Set(fields.filter((f) => f.computed).map((f) => f.field_name)),
    [fields],
  );

  /** Everything that would be refused, found before the save rather than after. */
  const issues = useMemo(() => {
    const out: string[] = [];
    const headers = new Map<string, string>();
    const names = new Map<string, string>();
    const key = (s: string) => s.trim().split(/\s+/).join(" ").toLowerCase();

    for (const f of fields) {
      const header = f.header_label.trim();
      const name = f.computed
        ? (COMPUTED_LABEL[f.field_name] ?? f.field_name)
        : f.field_name.trim();
      if (!header) {
        out.push("Every column needs a heading.");
        continue;
      }
      if (!name) {
        out.push(`“${header}” needs a name to show in MOP.`);
        continue;
      }

      const hk = key(header);
      if (headers.has(hk)) {
        out.push(`“${header}” is read by two columns — ${headers.get(hk)} and ${name}.`);
      }
      headers.set(hk, name);

      const nk = name.toLowerCase();
      if (names.has(nk)) {
        out.push(
          f.computed
            ? `Two headings both stand for “${name}”. MOP fills it in once.`
            : `Two columns are both called “${name}”.`,
        );
      }
      names.set(nk, header);

      // A computed row carries no type, so there is nothing further to check.
      if (f.computed) continue;

      if (f.data_type === "picklist" && !f.picklist.length) {
        out.push(`“${name}” is a pick list with no values.`);
      }
      const bad = f.data_type === "text" ? patternError(f.pattern) : null;
      if (bad) out.push(`“${name}”: that pattern isn't valid (${bad}).`);
    }
    return [...new Set(out)];
  }, [fields]);

  const update = (i: number, patch: Partial<FieldDef>) =>
    onChange(fields.map((f, n) => (n === i ? { ...f, ...patch } : f)));

  /** Swap two columns, and keep the open form pointed at the one that moved.
   *
   *  `open` is an index, so that second half is an invariant rather than a nicety — it
   *  used to be maintained by each caller passing the new index, which works but leaves
   *  the rule in two places. Anything that reorders goes through here now. */
  const move = (i: number, by: number) => {
    const to = i + by;
    if (to < 0 || to >= fields.length) return;
    const next = [...fields];
    [next[i], next[to]] = [next[to], next[i]];
    onChange(next);
    setOpen(to);
  };

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await onSave(
        fields.map((f) =>
          f.computed
            ? {
                ...f,
                data_type: "text" as const,
                pattern: null,
                picklist: [],
                mandatory: false,
              }
            : { ...f, pattern: f.data_type === "text" ? f.pattern : null },
        ),
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Those columns could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mb: 0.75 }}>
        <Typography
          sx={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "text.disabled",
          }}
        >
          Columns · {fields.length}
        </Typography>
        <Typography sx={{ fontSize: 11, color: "text.disabled" }}>in the sheet's order</Typography>
      </Box>
      <Typography sx={{ fontSize: 13, color: "text.secondary", mb: 1.5, maxWidth: 760 }}>
        A column is imported only if it is listed here. <b>Heading in the sheet</b> is matched
        exactly, ignoring capitals and spacing. <b>Pardot field name</b> becomes the CSV heading, so
        getting it right is what saves mapping every column by hand on import.
      </Typography>

      <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1.5, overflow: "hidden", mb: 2 }}>
        {fields.length === 0 && (
          <Typography sx={{ fontSize: 13, color: "text.disabled", textAlign: "center", py: 4 }}>
            No columns defined, so nothing on this tab would be imported.
          </Typography>
        )}

        {fields.map((f, i) => {
          const isOpen = open === i;
          const shown = f.computed ? (COMPUTED_LABEL[f.field_name] ?? f.field_name) : f.field_name;
          const kind = f.computed
            ? "MOP fills this"
            : f.data_type === "picklist"
              ? `${f.picklist.length} values`
              : "Text";
          return (
            <Box
              // Index as key: a column has no id until it is saved, and reordering is a
              // swap of the whole array — a value-derived key would remount both rows.
              key={i}
              sx={{
                borderTop: i === 0 ? 0 : 1,
                borderColor: "divider",
                bgcolor: isOpen ? "action.hover" : "transparent",
              }}
            >
              {/* --- the summary line, always visible ------------------------------- */}
              <Box
                component="button"
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : i)}
                sx={{
                  display: "flex",
                  width: "100%",
                  textAlign: "left",
                  alignItems: "center",
                  gap: 1,
                  px: 1.25,
                  py: 0.85,
                  border: 0,
                  bgcolor: "transparent",
                  fontFamily: "inherit",
                  cursor: "pointer",
                  "&:hover": { bgcolor: "action.hover" },
                }}
              >
                <Box
                  sx={{
                    flexShrink: 0,
                    display: "flex",
                    color: "text.disabled",
                    transform: isOpen ? "none" : "rotate(-90deg)",
                    transition: "transform .12s",
                  }}
                >
                  <ChevronDown size={17} />
                </Box>
                <Typography
                  sx={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: "text.disabled",
                    width: 18,
                    flexShrink: 0,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {i + 1}
                </Typography>

                {/* The sheet's heading is the long one and gets the room. Truncated
                    rather than wrapped so twenty columns stay scannable; the full text
                    is one click away and in a field big enough to read it. */}
                <Typography
                  title={f.header_label}
                  sx={{
                    fontSize: 13,
                    flex: 1.6,
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    color: f.header_label ? "text.primary" : "error.main",
                  }}
                >
                  {f.header_label || "no heading yet"}
                </Typography>

                <Box sx={{ flexShrink: 0, display: "flex", color: "text.disabled" }}>
                  <ChevronRight size={13} />
                </Box>

                <Typography
                  title={shown}
                  sx={{
                    fontSize: 13,
                    fontWeight: 600,
                    flex: 1,
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    color: shown ? (f.computed ? "text.secondary" : "text.primary") : "error.main",
                  }}
                >
                  {shown || "no name yet"}
                </Typography>

                <Typography
                  sx={{
                    fontSize: 11,
                    color: "text.disabled",
                    width: 92,
                    flexShrink: 0,
                    textAlign: "right",
                  }}
                >
                  {kind}
                </Typography>
                <Box sx={{ width: 52, flexShrink: 0, textAlign: "right" }}>
                  {f.mandatory && (
                    <Typography
                      component="span"
                      sx={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: "primary.main",
                        letterSpacing: "0.06em",
                      }}
                    >
                      REQ
                    </Typography>
                  )}
                </Box>
              </Box>

              {/* --- the form, when it is open -------------------------------------- */}
              {isOpen && (
                <Box sx={{ px: 1.25, pb: 1.75, pt: 0.25 }}>
                  <Box sx={{ pl: "46px", display: "flex", flexDirection: "column", gap: 1.75 }}>
                    <Box>
                      <Typography sx={fieldLabel}>Heading in the sheet</Typography>
                      {/* Multiline: the real ones run to 60 characters of instructions
                          for whoever fills the template in, and a one-line input showed
                          about a third of that. */}
                      <TextField
                        size="small"
                        fullWidth
                        multiline
                        maxRows={3}
                        sx={fieldInput}
                        value={f.header_label}
                        placeholder="Exactly as the sheet writes it"
                        onChange={(e) => update(i, { header_label: e.target.value })}
                      />
                    </Box>

                    <Box sx={{ display: "flex", gap: 1.75, flexWrap: "wrap" }}>
                      <Box sx={{ flex: "1 1 260px", minWidth: 220 }}>
                        <Typography sx={fieldLabel}>
                          {f.computed ? "Which value MOP fills in" : "Pardot field name"}
                        </Typography>
                        {f.computed ? (
                          // Pick WHICH computed value this heading stands for — that is
                          // the whole of it. Nobody renames a value MOP supplies.
                          <Select
                            size="small"
                            fullWidth
                            value={f.field_name}
                            sx={fieldInput}
                            onChange={(e) => update(i, { field_name: String(e.target.value) })}
                          >
                            {MAPPABLE_COMPUTED.map((k) => (
                              <MenuItem
                                key={k}
                                value={k}
                                sx={{ fontSize: 13 }}
                                disabled={k !== f.field_name && taken.has(k)}
                              >
                                {COMPUTED_LABEL[k]}
                              </MenuItem>
                            ))}
                          </Select>
                        ) : (
                          <TextField
                            size="small"
                            fullWidth
                            sx={fieldInput}
                            value={f.field_name}
                            placeholder="Exactly as Pardot names the field"
                            onChange={(e) => update(i, { field_name: e.target.value })}
                          />
                        )}
                      </Box>

                      <Box sx={{ width: 170 }}>
                        <Typography sx={fieldLabel}>Type</Typography>
                        <Select
                          size="small"
                          fullWidth
                          sx={fieldInput}
                          value={f.computed ? "computed" : f.data_type}
                          onChange={(e) => {
                            const v = String(e.target.value);
                            if (v === "computed") {
                              // Everything a type carries is a rule about a value the
                              // sheet supplies. Dropping them here matches the server and
                              // the CHECK constraint — a rule that can never fire is
                              // worse kept than removed.
                              update(i, {
                                computed: true,
                                data_type: "text",
                                pattern: null,
                                picklist: [],
                                mandatory: false,
                                field_name: MAPPABLE_COMPUTED.find((k) => !taken.has(k)) ?? "score",
                              });
                              return;
                            }
                            update(i, {
                              computed: false,
                              data_type: v as FieldDef["data_type"],
                              // Values and patterns are mutually exclusive; carrying one
                              // across a type change leaves a rule nobody can see.
                              pattern: v === "text" ? f.pattern : null,
                              picklist: v === "picklist" ? f.picklist : [],
                              field_name: f.computed ? "" : f.field_name,
                            });
                          }}
                        >
                          <MenuItem value="text" sx={{ fontSize: 13 }}>
                            Text
                          </MenuItem>
                          <MenuItem value="picklist" sx={{ fontSize: 13 }}>
                            Pick list
                          </MenuItem>
                          <MenuItem value="computed" sx={{ fontSize: 13 }}>
                            MOP fills this
                          </MenuItem>
                        </Select>
                      </Box>

                      {!f.computed && (
                        <Box sx={{ pt: 2.1 }}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                            <Switch
                              size="small"
                              checked={f.mandatory}
                              inputProps={{ "aria-label": "Required" }}
                              onChange={(e) => update(i, { mandatory: e.target.checked })}
                            />
                            <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>
                              Required
                            </Typography>
                          </Box>
                        </Box>
                      )}
                    </Box>

                    {f.computed ? (
                      <Typography sx={{ fontSize: 12.5, color: "text.disabled" }}>
                        MOP works this out. The sheet's own column is matched so it is accounted
                        for, and its values are never read.
                      </Typography>
                    ) : f.data_type === "picklist" ? (
                      <Box>
                        <Typography sx={fieldLabel}>Allowed values</Typography>
                        {/* Was a one-line input holding seven comma-separated sources.
                            Given real room it is legible and editable. */}
                        <TextField
                          size="small"
                          fullWidth
                          multiline
                          minRows={2}
                          maxRows={8}
                          sx={fieldInput}
                          value={f.picklist.join(", ")}
                          placeholder="One, Two, Three"
                          error={!f.picklist.length}
                          onChange={(e) =>
                            update(i, {
                              picklist: e.target.value
                                .split(",")
                                .map((v) => v.trim())
                                .filter(Boolean),
                            })
                          }
                        />
                        <Typography
                          sx={{ ...fieldHint, ...(f.picklist.length ? {} : { color: "error.main" }) }}
                        >
                          {f.picklist.length
                            ? `${f.picklist.length} values, comma separated`
                            : "A pick list needs values"}
                        </Typography>
                      </Box>
                    ) : (
                      <Box>
                        <Typography sx={fieldLabel}>Pattern (optional)</Typography>
                        <TextField
                          size="small"
                          fullWidth
                          sx={fieldInput}
                          value={f.pattern ?? ""}
                          placeholder="A regular expression, e.g. ^\\d{4}$"
                          error={Boolean(patternError(f.pattern))}
                          onChange={(e) => update(i, { pattern: e.target.value || null })}
                        />
                        <Typography
                          sx={{
                            ...fieldHint,
                            ...(patternError(f.pattern) ? { color: "error.main" } : {}),
                          }}
                        >
                          {patternError(f.pattern) ?? "Leave empty to accept anything."}
                        </Typography>
                        {!f.pattern && (
                          <Box
                            component="button"
                            type="button"
                            onClick={() => update(i, { pattern: EMAIL_PATTERN })}
                            sx={{
                              fontSize: 11.5,
                              fontFamily: "inherit",
                              border: 0,
                              p: 0,
                              bgcolor: "transparent",
                              color: "primary.main",
                              cursor: "pointer",
                              "&:hover": { textDecoration: "underline" },
                            }}
                          >
                            use the email pattern
                          </Box>
                        )}
                      </Box>
                    )}

                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      <Tooltip title="Move up" arrow>
                        <span>
                          <IconButton
                            size="small"
                            aria-label="Move up"
                            disabled={i === 0}
                            onClick={() => move(i, -1)}
                          >
                            <ChevronUp size={17} />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Move down" arrow>
                        <span>
                          <IconButton
                            size="small"
                            aria-label="Move down"
                            disabled={i === fields.length - 1}
                            onClick={() => move(i, 1)}
                          >
                            <ChevronDown size={17} />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Box sx={{ flex: 1 }} />
                      <Button
                        size="small"
                        startIcon={<Trash2 size={15} />}
                        onClick={() => {
                          onChange(fields.filter((_, n) => n !== i));
                          setOpen(null);
                        }}
                        sx={{ ...quietBtn, "&:hover": { color: "error.main" } }}
                      >
                        Remove this column
                      </Button>
                    </Box>
                  </Box>
                </Box>
              )}
            </Box>
          );
        })}
      </Box>

      {issues.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2, fontSize: 12.5 }}>
          {issues.map((m) => (
            <Box key={m}>{m}</Box>
          ))}
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2, fontSize: 12.5 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Button
          onClick={() => {
            onChange([...fields, blank()]);
            setOpen(fields.length);
          }}
          size="small"
          startIcon={<Plus size={16} />}
          sx={quietBtn}
        >
          Add a column
        </Button>
        <Box sx={{ flex: 1 }} />
        {saved && (
          <Typography sx={{ fontSize: 12.5, color: "success.main", fontWeight: 600 }}>
            Saved
          </Typography>
        )}
        {dirty && (
          <Button onClick={onDiscard} size="small" sx={quietBtn}>
            Discard
          </Button>
        )}
        <Button
          onClick={() => void save()}
          variant="contained"
          size="small"
          disabled={!dirty || saving || issues.length > 0}
          sx={primaryBtn}
        >
          {saving ? "Saving…" : "Save"}
        </Button>
      </Box>
    </Box>
  );
}
