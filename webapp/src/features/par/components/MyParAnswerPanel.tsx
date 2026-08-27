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
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from "@wso2/oxygen-ui";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { describeError } from "@api/errors";
import { useSaveMyPar } from "../api/useParEmployeeMutations";
import type { ParCycle, ParRating } from "../api/parTypes";
import { parEmployeeStatusMeta } from "../util/parStatus";
import { isParHtmlEmpty } from "../util/parHtml";
import { myParLockReason, type ParLockReason } from "../util/parEditability";
import ParHtml from "./ParHtml";
import ParRichText from "./ParRichText";
import ParSection from "./ParSection";

// The employee's own answer: write it, save drafts, then share it once.
//
// Sharing is one-way and the backend enforces that, so it asks first. Saving a
// draft does not, since a draft can be saved again.

/** Why the field is read-only, said in the second person. */
const LOCK_TEXT: Record<ParLockReason, string> = {
  noCycle: "No review cycle is open at the moment.",
  cycleClosed: "This cycle is closed, so nothing in it can change.",
  alreadyShared:
    "You've shared this with your lead. Sharing is one-way, so it can no longer be edited.",
  deadlinePassed: "The deadline for your part has passed, so this can no longer be edited.",
};

export default function MyParAnswerPanel({
  now,
  cycle,
  rating,
}: {
  now: Date;
  cycle: ParCycle | undefined;
  rating: ParRating | undefined;
}): JSX.Element {
  const notifications = useNotifications();
  const save = useSaveMyPar();
  const lock = myParLockReason(now, cycle, rating);
  const canEdit = lock === null;

  // The draft lives here while editing. Seeded from the record, and the field
  // itself is remounted by the parent when a different PAR loads — see the note
  // on ParRichText about why it cannot be a controlled value.
  const [draft, setDraft] = useState<string>(rating?.parEmployeeComment ?? "");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const question =
    cycle?.parCycleConfigurations?.employeeParQuestion ??
    "Share anything about your performance this cycle that your lead should know.";

  const saved = rating?.parEmployeeComment ?? "";
  const dirty = draft !== saved;
  const empty = isParHtmlEmpty(draft);
  const status = parEmployeeStatusMeta(rating?.parEmployeeStatus);

  const persist = (share: boolean) => {
    if (!cycle || !rating) return;
    save.mutate(
      {
        parCycleId: cycle.parCycleId,
        parRatingId: rating.parRatingId,
        parEmployeeComment: draft,
        share,
      },
      {
        onSuccess: () => {
          setConfirmOpen(false);
          notifications.showSuccess(share ? "Shared with your lead" : "Draft saved");
        },
        onError: (err) => {
          setConfirmOpen(false);
          notifications.showError(describeError(err));
        },
      },
    );
  };

  return (
    <ParSection
      title="Your review"
      subtitle={question}
      action={<Chip size="small" label={status.label} color={status.color} variant="outlined" />}
    >
      {!canEdit ? (
        <>
          {/* An Alert, not a locked-door card: unlike a permission the reader
              does not have, this is a stage of their own review having ended. */}
          <Alert severity="info" sx={{ mb: 1.75 }}>
            {LOCK_TEXT[lock]}
          </Alert>
          <ParHtml html={saved} emptyText="You didn't write anything for this cycle." />
        </>
      ) : (
        <>
          <ParRichText
            initialHtml={saved}
            onChange={setDraft}
            label="Your review"
            maxChars={5000}
          />

          {save.isError && (
            <Alert severity="error" sx={{ mt: 1.5 }}>
              {describeError(save.error)}
            </Alert>
          )}

          <Stack
            direction="row"
            spacing={1}
            sx={{ mt: 1.75, justifyContent: "flex-end", alignItems: "center" }}
          >
            {/* Says what sharing costs before the button is pressed, rather than
                only in the dialog that follows it. */}
            <Typography variant="caption" color="text.secondary" sx={{ mr: "auto" }}>
              Drafts are private to you. Sharing is one-way.
            </Typography>
            <Button
              size="small"
              variant="outlined"
              onClick={() => persist(false)}
              disabled={!dirty || save.isPending}
              sx={{ textTransform: "none", fontWeight: 600 }}
            >
              {save.isPending && !confirmOpen ? "Saving…" : "Save draft"}
            </Button>
            <Button
              size="small"
              variant="contained"
              onClick={() => setConfirmOpen(true)}
              // Empty, not merely unchanged: an untouched draft that already has
              // content is perfectly shareable, but nothing is not.
              disabled={empty || save.isPending}
              sx={{ fontWeight: 600 }}
            >
              Share with lead
            </Button>
          </Stack>
        </>
      )}

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        maxWidth="xs"
        fullWidth
        aria-labelledby="par-share-title"
      >
        <DialogTitle id="par-share-title">Share this with your lead?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Your lead will be able to read it, and you won&apos;t be able to change it
            afterwards.
            {dirty && " Anything unsaved here is shared as it stands."}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button size="small" onClick={() => setConfirmOpen(false)} disabled={save.isPending}>
            Cancel
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={() => persist(true)}
            disabled={save.isPending}
            sx={{ fontWeight: 600 }}
          >
            {save.isPending ? "Sharing…" : "Share"}
          </Button>
        </DialogActions>
      </Dialog>
    </ParSection>
  );
}
