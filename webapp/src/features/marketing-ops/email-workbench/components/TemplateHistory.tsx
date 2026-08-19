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

import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Link,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { ExternalLink, Pencil, Trash2 } from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import { pardotTemplateUrl } from "@config/apiConfig";
import { useDeleteDraft, useDrafts } from "../../api/useEmailWorkbench";
import type { DraftSummary } from "../emailWorkbenchTypes";

// "My emails" — the signed-in user's own drafts and completed emails. Rows are
// scoped server-side to the caller, so this only ever shows your own.

function fmt(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// A pushed email whose content changed after its last sync is out of date in
// Pardot. Worth calling out explicitly: the email exists in Pardot and looks fine
// there, so nothing else would tell the user that what they're about to send is
// not what they last edited.
function updatePending(d: DraftSummary): boolean {
  if (!d.pardot_template_id || !d.pardot_synced_at) return false;
  return new Date(d.updated_at).getTime() > new Date(d.pardot_synced_at).getTime();
}

export default function TemplateHistory({ onOpen }: { onOpen: (id: string) => void }) {
  const drafts = useDrafts();
  const del = useDeleteDraft();
  const [confirm, setConfirm] = useState<DraftSummary | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function doDelete() {
    if (!confirm) return;
    setDeleteError(null);
    try {
      await del.mutateAsync(confirm.id);
      setConfirm(null);
    } catch (e) {
      setDeleteError(describeError(e));
    }
  }

  if (drafts.isLoading) {
    return (
      <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", py: 4 }}>
        <CircularProgress size={16} />
        <Typography sx={{ fontSize: 13, color: "text.secondary" }}>Loading your emails…</Typography>
      </Stack>
    );
  }

  if (drafts.isError) {
    return <Alert severity="error">Could not load your emails. {describeError(drafts.error)}</Alert>;
  }

  const rows = drafts.data ?? [];

  if (rows.length === 0) {
    return (
      <Typography sx={{ fontSize: 13, color: "text.disabled", textAlign: "center", py: 4 }}>
        You haven't created any emails yet. Head to "Create an email", edit a template, then save a
        draft.
      </Typography>
    );
  }

  return (
    <>
      <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1.25, overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontSize: 11, fontWeight: 700 }}>Name</TableCell>
              <TableCell sx={{ fontSize: 11, fontWeight: 700 }}>Status</TableCell>
              <TableCell sx={{ fontSize: 11, fontWeight: 700 }}>Last modified</TableCell>
              <TableCell sx={{ fontSize: 11, fontWeight: 700 }}>Pardot</TableCell>
              <TableCell align="right" />
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((d) => {
              const completed = d.status === "Completed";
              const pending = updatePending(d);
              return (
                <TableRow key={d.id} hover>
                  <TableCell>
                    <Box
                      component="button"
                      type="button"
                      onClick={() => onOpen(d.id)}
                      sx={{
                        border: 0,
                        p: 0,
                        bgcolor: "transparent",
                        textAlign: "left",
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{d.name}</Typography>
                      {d.subject && (
                        <Typography sx={{ fontSize: 11, color: "text.secondary" }} noWrap>
                          {d.subject}
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={d.status}
                      size="small"
                      color={completed ? "success" : "default"}
                      variant={completed ? "filled" : "outlined"}
                      sx={{
                        height: 19,
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>
                      {fmt(d.updated_at)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {d.pardot_template_id ? (
                      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
                        <Link
                          href={pardotTemplateUrl(d.pardot_template_id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          sx={{
                            fontSize: 11.5,
                            fontWeight: 700,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 0.4,
                          }}
                        >
                          Open in Pardot <ExternalLink size={12} />
                        </Link>
                        {pending && (
                          <Typography sx={{ fontSize: 10.5, color: "warning.main", fontWeight: 600 }}>
                            Edited since last sync — update pending
                          </Typography>
                        )}
                      </Box>
                    ) : (
                      <Typography sx={{ fontSize: 11.5, color: "text.disabled" }}>
                        Not synced
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Open in editor" arrow>
                      <IconButton
                        size="small"
                        aria-label={`Open ${d.name}`}
                        onClick={() => onOpen(d.id)}
                        sx={{ color: "text.secondary" }}
                      >
                        <Pencil size={15} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete" arrow>
                      <IconButton
                        size="small"
                        aria-label={`Delete ${d.name}`}
                        onClick={() => setConfirm(d)}
                        sx={{ color: "text.secondary", "&:hover": { color: "error.main" } }}
                      >
                        <Trash2 size={15} />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Box>

      <Dialog
        open={Boolean(confirm)}
        onClose={() => {
          if (!del.isPending) {
            setConfirm(null);
            setDeleteError(null);
          }
        }}
      >
        <DialogTitle sx={{ fontSize: 16, fontWeight: 800 }}>Delete this email?</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
            "{confirm?.name}" will be removed from your history. This does{" "}
            <strong>not</strong> delete anything already pushed to Pardot.
          </Typography>
          {deleteError && (
            <Alert severity="error" sx={{ mt: 2, fontSize: 13 }}>
              {deleteError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => {
              setConfirm(null);
              setDeleteError(null);
            }}
            disabled={del.isPending}
            sx={{ textTransform: "none", color: "text.secondary" }}
          >
            Cancel
          </Button>
          <Button
            onClick={doDelete}
            disabled={del.isPending}
            variant="contained"
            color="error"
            sx={{ textTransform: "none", fontWeight: 700 }}
          >
            {del.isPending ? "Deleting…" : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
