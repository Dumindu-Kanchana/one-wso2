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
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { describeError } from "@api/errors";
import { useSaveLeadReview } from "../api/useParLead";
import type { ParCycle, ParRating, ParSpecialRating } from "../api/parTypes";
import { canLeadEdit, isCycleClosed } from "../util/parDeadlines";
import { isParHtmlEmpty } from "../util/parHtml";
import {
  canPickSpecialRating,
  draftAfterRatingChange,
  isEvidenceRating,
  isSpecialRatingEligible,
  leadShareBlocker,
  parRatingRules,
  type LeadReviewDraft,
  type LeadShareBlocker,
} from "../util/parLeadReview";
import { parLeadStatusMeta } from "../util/parStatus";
import { parseEvidenceUrls, serializeEvidenceUrls, type ParEvidenceFile } from "../util/parEvidence";
import ParEvidenceField from "./ParEvidenceField";
import ParHtml from "./ParHtml";
import ParRichText from "./ParRichText";
import ParSection from "./ParSection";

// The lead's own half of a report's PAR: what they write, the rating, and the
// one-way share.
//
// None of the conditions that block a share are computed here — they come from
// util/parLeadReview.ts, which is tested at each boundary. This file's job is
// to render the reason.

const BLOCKER_TEXT: Record<LeadShareBlocker, string> = {
  locked: "This review is already shared, or the cycle has closed.",
  employeeNotShared:
    "They haven't shared their own PAR yet. You'll be able to review it once they do.",
  deadlinePassed: "The deadline for lead reviews has passed.",
  evidenceIncomplete:
    "This rating needs a confirmation that the discussions were held, and at least one supporting document.",
};

const SPECIAL_OPTIONS: { value: ParSpecialRating; label: string }[] = [
  { value: "NOT_ASSIGNED", label: "Not assigned" },
  { value: "TOP5P", label: "Top 5%" },
  { value: "TOP20P", label: "Top 20%" },
];

export default function LeadFeedbackPanel({
  now,
  cycle,
  rating,
  adminAuditView = false,
}: {
  now: Date;
  cycle: ParCycle;
  rating: ParRating;
  /** An admin auditing a live cycle. See §6.4 and §9 — deliberate. */
  adminAuditView?: boolean;
}): JSX.Element {
  const notifications = useNotifications();
  const save = useSaveLeadReview();
  const rules = parRatingRules();

  const [comment, setComment] = useState(rating.parLeadComment ?? "");
  const [files, setFiles] = useState<ParEvidenceFile[]>(() =>
    parseEvidenceUrls(rating.parPerformanceNoticeAck),
  );
  const [draft, setDraft] = useState<LeadReviewDraft>(() => ({
    rating: rating.parRating ?? "",
    specialRating: rating.parSpecialRating ?? "NOT_ASSIGNED",
    // Both confirmations start unticked even on a saved draft: they attest to
    // something the lead did, and a tick restored from storage would assert it
    // on their behalf.
    evidenceConfirmed: false,
    evidenceFileCount: parseEvidenceUrls(rating.parPerformanceNoticeAck).length,
    top5p20pConfirmed: false,
  }));
  const [confirmOpen, setConfirmOpen] = useState(false);

  const locked = isCycleClosed(cycle) || rating.parLeadStatus === "SHARED";
  const blocker = leadShareBlocker(
    {
      locked,
      leadDeadlinePassed: !canLeadEdit(now, cycle),
      employeeStatus: rating.parEmployeeStatus,
      adminAuditView,
      draft: { ...draft, evidenceFileCount: files.length },
    },
    rules,
  );
  // Editing stops for the same reasons sharing does, minus the evidence rule —
  // which is about the record being complete, not about being allowed to write.
  const readOnly =
    locked ||
    (!adminAuditView && !canLeadEdit(now, cycle)) ||
    (!adminAuditView && rating.parEmployeeStatus === "PENDING");

  const options = cycle.parCycleConfigurations?.parRatings ?? [];
  const status = parLeadStatusMeta(rating.parLeadStatus);
  const showEvidence = isEvidenceRating(draft.rating, rules);
  const showSpecial = isSpecialRatingEligible(draft.rating, rules);

  const changeRating = (next: string) => {
    // The reset rule lives in the predicate module, so a rating change cannot
    // leave a special rating or evidence attached that the new rating forbids.
    const updated = draftAfterRatingChange({ ...draft, evidenceFileCount: files.length }, next, rules);
    setDraft(updated);
    if (updated.evidenceFileCount === 0) setFiles([]);
  };

  const persist = (share: boolean) => {
    save.mutate(
      {
        parCycleId: cycle.parCycleId,
        parRatingId: rating.parRatingId,
        employeeEmail: rating.parEmployeeEmail,
        parLeadComment: comment,
        parRating: draft.rating,
        parSpecialRating: draft.specialRating,
        parPerformanceNoticeAck: serializeEvidenceUrls(files),
        share,
      },
      {
        onSuccess: () => {
          setConfirmOpen(false);
          notifications.showSuccess(share ? "Review shared" : "Draft saved");
        },
        onError: (err) => {
          setConfirmOpen(false);
          notifications.showError(describeError(err));
        },
      },
    );
  };

  return (
    <>
      <ParSection
        title="Their review"
        subtitle="What they wrote for this cycle."
      >
        <ParHtml
          html={rating.parEmployeeComment}
          emptyText={
            rating.parEmployeeStatus === "PENDING"
              ? "They haven't shared their PAR yet."
              : "They didn't write anything."
          }
        />
      </ParSection>

      <ParSection
        title="Your review"
        subtitle="Visible to them once shared. Sharing is one-way."
        action={<Chip size="small" variant="outlined" color={status.color} label={status.label} />}
      >
        {readOnly ? (
          <>
            <Alert severity="info" sx={{ mb: 1.75 }}>
              {BLOCKER_TEXT[blocker ?? "locked"]}
            </Alert>
            <ParHtml html={rating.parLeadComment} emptyText="No feedback was written." />
          </>
        ) : (
          <Stack spacing={2.25}>
            <TextField
              select
              size="small"
              label="Rating"
              value={draft.rating}
              onChange={(e) => changeRating(e.target.value)}
              sx={{ minWidth: 260 }}
              helperText="Changing this clears anything the previous rating unlocked."
            >
              {options.map((o) => (
                <MenuItem key={o} value={o}>
                  {o}
                </MenuItem>
              ))}
            </TextField>

            <ParRichText
              initialHtml={rating.parLeadComment}
              onChange={setComment}
              label="Your feedback"
              maxChars={5000}
            />

            {showSpecial && (
              <Box>
                <Divider sx={{ mb: 1.5 }} />
                <FormControlLabel
                  control={
                    <Checkbox
                      size="small"
                      checked={draft.top5p20pConfirmed}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          top5p20pConfirmed: e.target.checked,
                          // Unticking withdraws the choice it authorised.
                          specialRating: e.target.checked ? d.specialRating : "NOT_ASSIGNED",
                        }))
                      }
                    />
                  }
                  label={
                    <Typography variant="body2">
                      The Top 5% / 20% decision was discussed and finalised with the functional
                      lead
                    </Typography>
                  }
                />
                <TextField
                  select
                  size="small"
                  label="Top 5% / 20%"
                  value={draft.specialRating}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, specialRating: e.target.value as ParSpecialRating }))
                  }
                  disabled={!canPickSpecialRating(draft, rules)}
                  sx={{ minWidth: 260, display: "block", mt: 1 }}
                  helperText={
                    canPickSpecialRating(draft, rules)
                      ? "Quota is checked when you save; a full group is refused."
                      : "Confirm the decision above to choose one."
                  }
                >
                  {SPECIAL_OPTIONS.map((o) => (
                    <MenuItem key={o.value} value={o.value}>
                      {o.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Box>
            )}

            {showEvidence && (
              <Box>
                <Divider sx={{ mb: 1.5 }} />
                <FormControlLabel
                  control={
                    <Checkbox
                      size="small"
                      checked={draft.evidenceConfirmed}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, evidenceConfirmed: e.target.checked }))
                      }
                    />
                  }
                  label={
                    <Typography variant="body2">
                      At least two performance discussions were held with this person during the
                      cycle
                    </Typography>
                  }
                />
                <Box sx={{ mt: 1 }}>
                  <ParEvidenceField files={files} onChange={setFiles} />
                </Box>
              </Box>
            )}

            {save.isError && <Alert severity="error">{describeError(save.error)}</Alert>}

            {/* The reason is shown next to the disabled button rather than only
                as a tooltip: a control that cannot be pressed and does not say
                why reads as broken. */}
            {blocker !== null && <Alert severity="info">{BLOCKER_TEXT[blocker]}</Alert>}

            <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
              <Button
                size="small"
                variant="outlined"
                onClick={() => persist(false)}
                disabled={save.isPending}
                sx={{ textTransform: "none", fontWeight: 600 }}
              >
                {save.isPending && !confirmOpen ? "Saving…" : "Save draft"}
              </Button>
              <Button
                size="small"
                variant="contained"
                onClick={() => setConfirmOpen(true)}
                disabled={blocker !== null || isParHtmlEmpty(comment) || save.isPending}
                sx={{ fontWeight: 600 }}
              >
                Share with them
              </Button>
            </Stack>
          </Stack>
        )}
      </ParSection>

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        maxWidth="xs"
        fullWidth
        aria-labelledby="lead-share-title"
      >
        <DialogTitle id="lead-share-title">Share this review?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {rating.parEmployeeName ?? rating.parEmployeeEmail} will be able to read it, and you
            won&apos;t be able to change it afterwards. It also opens the face-to-face record.
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
    </>
  );
}
