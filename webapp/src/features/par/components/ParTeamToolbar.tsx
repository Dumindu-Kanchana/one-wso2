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
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { BellIcon, CopyIcon, SendIcon, UserPlusIcon } from "@wso2/oxygen-ui-icons-react";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { describeError } from "@api/errors";
import {
  useBulkShareLeadReviews,
  useSendThreeSixtyReminders,
  useSyncEmployeeIntoCycle,
} from "../api/useParLead";
import type { ParTeamMember } from "../api/parTypes";
import {
  BULK_SHARE_PROBLEM_TEXT,
  bulkShareProblem,
  describeBulkShare,
} from "../util/parBulkShare";

// The actions a lead takes across a whole team rather than one person.
//
// Bulk sharing is the one with teeth: it is one PATCH per person with no bulk
// endpoint, so a partial result is normal and the summary is reported in full
// rather than collapsed to success or failure.

export default function ParTeamToolbar({
  parCycleId,
  members,
  selectedIds,
  onClearSelection,
}: {
  parCycleId: number;
  members: readonly ParTeamMember[];
  selectedIds: ReadonlySet<number>;
  onClearSelection: () => void;
}): JSX.Element {
  const notifications = useNotifications();
  const bulkShare = useBulkShareLeadReviews();
  const remind = useSendThreeSixtyReminders();
  const sync = useSyncEmployeeIntoCycle();

  const [confirmShare, setConfirmShare] = useState(false);
  const [confirmRemind, setConfirmRemind] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [syncEmail, setSyncEmail] = useState("");
  const [lastSummary, setLastSummary] = useState<string[] | null>(null);

  const selected = members.filter((m) => selectedIds.has(m.parRatingId));
  const problem = bulkShareProblem(selected);

  const copyEmails = () => {
    const emails = selected.map((m) => m.parEmployeeEmail).join(", ");
    if (emails === "") {
      notifications.showWarning("Select some people first.");
      return;
    }
    // Clipboard access is not guaranteed — an insecure origin or a denied
    // permission both leave it unavailable, and silently doing nothing reads
    // as the button being broken.
    void navigator.clipboard
      ?.writeText(emails)
      .then(() =>
        notifications.showSuccess(
          selected.length === 1 ? "Email copied" : `${selected.length} emails copied`,
        ),
      )
      .catch(() => notifications.showError("Couldn't copy — your browser refused clipboard access."));
  };

  const runBulkShare = () => {
    bulkShare.mutate(
      { parCycleId, selected },
      {
        onSuccess: (summary) => {
          setConfirmShare(false);
          // Never a bare "done": some may have failed, and which people did is
          // what the lead has to act on.
          if (summary.failed === 0) {
            notifications.showSuccess(describeBulkShare(summary));
            setLastSummary(null);
            onClearSelection();
            return;
          }
          notifications.showWarning(describeBulkShare(summary));
          setLastSummary([
            `${describeBulkShare(summary)}.`,
            `Not shared: ${summary.failedEmails.join(", ")}.`,
            ...summary.reasons,
          ]);
        },
        onError: (err) => {
          setConfirmShare(false);
          notifications.showError(describeError(err));
        },
      },
    );
  };

  return (
    <>
      <Stack
        direction="row"
        sx={{ flexWrap: "wrap", gap: 1, mb: 1.75, alignItems: "center" }}
      >
        <Typography variant="body2" color="text.secondary" sx={{ mr: "auto" }}>
          {selectedIds.size === 0
            ? "Select people to share or copy in bulk."
            : `${selectedIds.size} selected`}
        </Typography>

        <Button
          size="small"
          variant="outlined"
          startIcon={<CopyIcon size={15} />}
          onClick={copyEmails}
          disabled={selectedIds.size === 0}
          sx={{ textTransform: "none", fontWeight: 600 }}
        >
          Copy emails
        </Button>
        <Button
          size="small"
          variant="outlined"
          startIcon={<UserPlusIcon size={15} />}
          onClick={() => setSyncOpen(true)}
          sx={{ textTransform: "none", fontWeight: 600 }}
        >
          Add someone
        </Button>
        <Button
          size="small"
          variant="outlined"
          startIcon={<BellIcon size={15} />}
          onClick={() => setConfirmRemind(true)}
          disabled={remind.isPending}
          sx={{ textTransform: "none", fontWeight: 600 }}
        >
          {remind.isPending ? "Sending…" : "Remind 360° reviewers"}
        </Button>
        <Button
          size="small"
          variant="contained"
          startIcon={<SendIcon size={15} />}
          onClick={() => setConfirmShare(true)}
          disabled={problem !== null || bulkShare.isPending}
          sx={{ fontWeight: 600 }}
        >
          Share selected
        </Button>
      </Stack>

      {/* Only once something is selected: the all-or-nothing rule is not a
          standing warning, it is an answer to an attempt. */}
      {problem === "notAllDrafts" && (
        <Alert severity="info" sx={{ mb: 1.75 }}>
          {BULK_SHARE_PROBLEM_TEXT[problem]}
        </Alert>
      )}

      {lastSummary && (
        <Alert severity="warning" sx={{ mb: 1.75 }} onClose={() => setLastSummary(null)}>
          {lastSummary.map((line, i) => (
            <Typography key={i} variant="body2" sx={{ display: "block" }}>
              {line}
            </Typography>
          ))}
        </Alert>
      )}

      <Dialog open={confirmShare} onClose={() => setConfirmShare(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Share {selected.length} review{selected.length === 1 ? "" : "s"}?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Each person will be able to read theirs, and you won&apos;t be able to change it
            afterwards. They are shared one at a time, so some can succeed while others are
            refused — a full Top 5% / 20% group is the usual reason.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button size="small" onClick={() => setConfirmShare(false)} disabled={bulkShare.isPending}>
            Cancel
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={runBulkShare}
            disabled={bulkShare.isPending}
            sx={{ fontWeight: 600 }}
          >
            {bulkShare.isPending ? "Sharing…" : "Share"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmRemind} onClose={() => setConfirmRemind(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Remind outstanding 360° reviewers?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Everyone who still owes feedback about someone in your teams gets an email. You
            can&apos;t choose who — the server decides who is outstanding.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button size="small" onClick={() => setConfirmRemind(false)}>
            Cancel
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={() =>
              remind.mutate(undefined, {
                onSuccess: () => {
                  setConfirmRemind(false);
                  notifications.showSuccess("Reminders sent");
                },
                onError: (err) => {
                  setConfirmRemind(false);
                  notifications.showError(describeError(err));
                },
              })
            }
            disabled={remind.isPending}
            sx={{ fontWeight: 600 }}
          >
            Send
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={syncOpen} onClose={() => setSyncOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add someone to this cycle</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            For somebody who joined or moved after the cycle opened and so has no PAR in it.
          </Typography>
          <TextField
            size="small"
            fullWidth
            type="email"
            label="Their work email"
            value={syncEmail}
            onChange={(e) => setSyncEmail(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button size="small" onClick={() => setSyncOpen(false)} disabled={sync.isPending}>
            Cancel
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={() =>
              sync.mutate(
                { parCycleId, employeeEmail: syncEmail.trim() },
                {
                  onSuccess: () => {
                    setSyncOpen(false);
                    setSyncEmail("");
                    notifications.showSuccess("Added to the cycle");
                  },
                  onError: (err) => notifications.showError(describeError(err)),
                },
              )
            }
            // Shape only — whether they exist and belong to this team is the
            // backend's call, and guessing here would refuse valid addresses.
            disabled={!syncEmail.includes("@") || sync.isPending}
            sx={{ fontWeight: 600 }}
          >
            {sync.isPending ? "Adding…" : "Add"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
