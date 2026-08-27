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
  Skeleton,
  Stack,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { PlusIcon, SettingsIcon, XIcon } from "@wso2/oxygen-ui-icons-react";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { describeError } from "@api/errors";
import ParShell from "../components/ParShell";
import ParPanel from "../components/ParPanel";
import ParSection from "../components/ParSection";
import ParRichText from "../components/ParRichText";
import { useGlobalConfigurations, useSaveGlobalConfigurations } from "../api/useParAdmin";
import type { ParCycleConfigurations } from "../api/parTypes";

// PAR settings — the org-wide defaults.
//
// See docs/ported-apps/par-app.md §6.3. These seed a NEW cycle and change
// nothing about one already running, which is the single most important thing
// for the reader to know, so the screen says it rather than implying it.
//
// Ported from views/globalSettings/GlobalSettings.tsx. Its validation is the
// same four rules as the creation form's: both questions required, and at least
// one rating in each list.

export default function ParSettingsPage(): JSX.Element {
  return (
    <ParShell
      eyebrow={{ icon: SettingsIcon, label: "PAR" }}
      title="PAR settings"
      subtitle="Defaults for cycles created from now on."
      require="admin"
    >
      <SettingsBody />
    </ParShell>
  );
}

function SettingsBody(): JSX.Element {
  const notifications = useNotifications();
  const config = useGlobalConfigurations();
  const save = useSaveGlobalConfigurations();

  // Seeded once the fetch lands. Tracked by what it was seeded FROM so a late
  // response still lands without overwriting typing.
  const [draft, setDraft] = useState<ParCycleConfigurations | null>(null);
  const loadedKey = config.isPending ? null : JSON.stringify(config.data ?? null);
  const [seededFrom, setSeededFrom] = useState<string | null>(null);
  if (loadedKey !== null && seededFrom !== loadedKey) {
    setSeededFrom(loadedKey);
    setDraft({
      employeeParQuestion: config.data?.employeeParQuestion ?? "",
      threeSixtyReviewQuestion: config.data?.threeSixtyReviewQuestion ?? "",
      parRatings: config.data?.parRatings ?? [],
      threeSixtyReviewRatings: config.data?.threeSixtyReviewRatings ?? [],
    });
  }

  if (config.isPending || draft === null) {
    return <Skeleton variant="rectangular" height={280} sx={{ borderRadius: 1.5 }} />;
  }
  if (config.isError) {
    return (
      <Alert severity="error">
        Couldn&apos;t load the settings. {describeError(config.error)}
      </Alert>
    );
  }

  // The same four rules as the creation form.
  const problems: string[] = [];
  if (draft.employeeParQuestion.trim() === "") problems.push("The employee's question is required.");
  if (draft.threeSixtyReviewQuestion.trim() === "")
    problems.push("The 360° question is required.");
  if (draft.parRatings.length === 0) problems.push("At least one PAR rating is required.");
  if (draft.threeSixtyReviewRatings.length === 0)
    problems.push("At least one 360° rating is required.");

  return (
    <ParPanel>
      <ParSection
        title="Defaults for new cycles"
        subtitle="Creating a cycle copies these into it. Changing them never affects a cycle already running."
      >
        <Stack spacing={2.5}>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
              THE EMPLOYEE&apos;S QUESTION
            </Typography>
            <Box sx={{ mt: 0.75 }}>
              <ParRichText
                initialHtml={draft.employeeParQuestion}
                onChange={(html) => setDraft({ ...draft, employeeParQuestion: html })}
                label="The employee's question"
                maxChars={2000}
              />
            </Box>
          </Box>

          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
              THE 360° QUESTION
            </Typography>
            <Box sx={{ mt: 0.75 }}>
              <ParRichText
                initialHtml={draft.threeSixtyReviewQuestion}
                onChange={(html) => setDraft({ ...draft, threeSixtyReviewQuestion: html })}
                label="The 360° question"
                maxChars={2000}
              />
            </Box>
          </Box>

          <RatingList
            label="PAR ratings"
            values={draft.parRatings}
            onChange={(parRatings) => setDraft({ ...draft, parRatings })}
          />
          <RatingList
            label="360° ratings"
            values={draft.threeSixtyReviewRatings}
            onChange={(threeSixtyReviewRatings) =>
              setDraft({ ...draft, threeSixtyReviewRatings })
            }
          />

          {problems.length > 0 && (
            <Alert severity="info">
              {problems.map((p) => (
                <Typography key={p} variant="body2" sx={{ display: "block" }}>
                  {p}
                </Typography>
              ))}
            </Alert>
          )}

          {save.isError && <Alert severity="error">{describeError(save.error)}</Alert>}

          <Stack direction="row" sx={{ justifyContent: "flex-end" }}>
            <Button
              size="small"
              variant="contained"
              disabled={problems.length > 0 || save.isPending}
              onClick={() =>
                save.mutate(draft, {
                  onSuccess: () => notifications.showSuccess("Defaults saved"),
                  onError: (err) => notifications.showError(describeError(err)),
                })
              }
              sx={{ fontWeight: 600 }}
            >
              {save.isPending ? "Saving…" : "Save defaults"}
            </Button>
          </Stack>
        </Stack>
      </ParSection>
    </ParPanel>
  );
}

/** A free-text list of rating values. Same behaviour as the cycle form's. */
function RatingList({
  label,
  values,
  onChange,
}: {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
}) {
  const [entry, setEntry] = useState("");
  const trimmed = entry.trim();
  const duplicate = values.some((v) => v.toLowerCase() === trimmed.toLowerCase());

  const add = () => {
    if (trimmed === "" || duplicate) return;
    onChange([...values, trimmed]);
    setEntry("");
  };

  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
        {label.toUpperCase()}
      </Typography>
      {values.length > 0 && (
        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75, mt: 0.75 }}>
          {values.map((v) => (
            <Chip
              key={v}
              size="small"
              label={v}
              onDelete={() => onChange(values.filter((x) => x !== v))}
              // Named: an icon-only delete has no accessible name of its own, so
              // it is unreachable for anyone not clicking it with a mouse.
              deleteIcon={<XIcon size={14} aria-label={`Remove ${v}`} />}
            />
          ))}
        </Stack>
      )}
      <Stack direction="row" spacing={1} sx={{ mt: 1, alignItems: "flex-start" }}>
        <TextField
          size="small"
          label="Add a rating"
          value={entry}
          onChange={(e) => setEntry(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            add();
          }}
          error={duplicate}
          helperText={duplicate ? "That rating is already listed." : " "}
          sx={{ maxWidth: 360, flex: 1 }}
        />
        <Button
          size="small"
          onClick={add}
          disabled={trimmed === "" || duplicate}
          startIcon={<PlusIcon size={15} />}
          sx={{ textTransform: "none", fontWeight: 600, mt: 0.25 }}
        >
          Add
        </Button>
      </Stack>
    </Box>
  );
}
