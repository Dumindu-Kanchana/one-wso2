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
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { describeError } from "@api/errors";
import {
  useSaveQuotaGroups,
  useSetParCycleStatus,
  useUngroupedQuotaTeams,
} from "../api/useParAdmin";
import type { ParCycle, ParQuotaGroupDraft, ParQuotaTeam } from "../api/parTypes";
import { defaultQuotaForHeadCount, isFlexibleQuota } from "../util/parQuotaDefaults";
import ParEmpty from "./ParEmpty";
import ParPanel from "./ParPanel";
import ParSection from "./ParSection";

// Allocating Top 5% / 20% quota before a cycle can open.
//
// The flow, as the standalone app has it: every team in the cycle starts
// ungrouped; the admin selects some, names a group, and the group's quota is
// suggested from the combined headcount (util/parQuotaDefaults.ts, which is
// where the arithmetic and its surprises live). When no ungrouped team is left,
// the whole grouping is saved in one call and the cycle is opened.
//
// §9.4 is reproduced, not fixed: **the grouping lives in browser state until
// that single save succeeds.** There is no per-group endpoint, so a refresh
// part-way through loses the work. The screen says so, which the standalone app
// does not — that is the one addition here, and it withholds nothing.

const teamLabel = (t: ParQuotaTeam) =>
  [t.businessUnit, t.department, t.team, t.subTeam].filter(Boolean).join(" · ") || "—";

export default function ParAdminQuotaPanel({ cycle }: { cycle: ParCycle }): JSX.Element {
  const notifications = useNotifications();
  const teams = useUngroupedQuotaTeams(cycle.parCycleId);
  const save = useSaveQuotaGroups();
  const setStatus = useSetParCycleStatus();

  const [groups, setGroups] = useState<ParQuotaGroupDraft[]>([]);
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
  const [naming, setNaming] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [nextLocalId, setNextLocalId] = useState(1);

  const grouped = new Set(groups.flatMap((g) => g.teams.map((t) => t.specialRatingGroupId)));
  const ungrouped = (teams.data ?? []).filter((t) => !grouped.has(t.specialRatingGroupId));
  const selectedTeams = ungrouped.filter((t) => selected.has(t.specialRatingGroupId));
  const selectedHeads = selectedTeams.reduce((n, t) => n + (t.headCount ?? 0), 0);
  const allGrouped = ungrouped.length === 0 && groups.length > 0;

  const createGroup = () => {
    const name = draftName.trim();
    if (name === "" || selectedTeams.length === 0) return;
    const quota = defaultQuotaForHeadCount(selectedHeads);
    setGroups((g) => [
      ...g,
      {
        localId: nextLocalId,
        name,
        top5Quota: quota.top5,
        top20Quota: quota.top20,
        teams: selectedTeams,
      },
    ]);
    setNextLocalId((n) => n + 1);
    setSelected(new Set());
    setDraftName("");
    setNaming(false);
  };

  const saveAndOpen = () => {
    save.mutate(
      { parCycleId: cycle.parCycleId, groups },
      {
        onSuccess: () => {
          // Opening is a second call, as in the standalone app. If it fails the
          // quota is already stored — see the note below the button.
          setStatus.mutate(
            { parCycleId: cycle.parCycleId, parCycleStatus: "OPEN" },
            {
              onSuccess: () => notifications.showSuccess("Quota saved and the cycle is open"),
              onError: (err) =>
                notifications.showError(
                  `Quota saved, but the cycle didn't open. ${describeError(err)}`,
                ),
            },
          );
        },
        onError: (err) => notifications.showError(describeError(err)),
      },
    );
  };

  const busy = save.isPending || setStatus.isPending;

  return (
    <ParPanel>
      <ParSection
        title={`${cycle.parCycleName} — allocate quota`}
        subtitle="Every team needs a group before the cycle can open."
        action={
          <Chip
            size="small"
            variant="outlined"
            color={allGrouped ? "success" : "warning"}
            label={allGrouped ? "All teams grouped" : `${ungrouped.length} ungrouped`}
          />
        }
      >
        {/* Said plainly because it is true and costly: there is no per-group
            endpoint, so nothing here is stored until the single save. */}
        <Alert severity="info" sx={{ mb: 2 }}>
          Groups are held in this browser until you save. Leaving or reloading this page loses
          them — there is no way to save one group at a time.
        </Alert>

        {teams.isPending ? (
          <Skeleton variant="rectangular" height={160} sx={{ borderRadius: 1.5 }} />
        ) : teams.isError ? (
          <Alert severity="error">
            Couldn&apos;t load the cycle&apos;s teams. {describeError(teams.error)}
          </Alert>
        ) : (
          <>
            <Stack
              direction="row"
              sx={{ alignItems: "center", gap: 1.5, mb: 1.5, flexWrap: "wrap" }}
            >
              <Typography variant="body2" color="text.secondary" sx={{ mr: "auto" }}>
                {selected.size === 0
                  ? "Select the teams that should share a quota."
                  : `${selected.size} selected · ${selectedHeads} people`}
              </Typography>
              <Button
                size="small"
                variant="contained"
                onClick={() => setNaming(true)}
                disabled={selected.size === 0 || busy}
                sx={{ fontWeight: 600 }}
              >
                Group these
              </Button>
            </Stack>

            {ungrouped.length === 0 ? (
              <ParEmpty>
                {groups.length === 0
                  ? "This cycle has no teams to group."
                  : "Every team is in a group."}
              </ParEmpty>
            ) : (
              <Box sx={{ overflowX: "auto" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox">
                        <Checkbox
                          size="small"
                          checked={ungrouped.length > 0 && selected.size === ungrouped.length}
                          indeterminate={selected.size > 0 && selected.size < ungrouped.length}
                          onChange={(e) =>
                            setSelected(
                              e.target.checked
                                ? new Set(ungrouped.map((t) => t.specialRatingGroupId))
                                : new Set(),
                            )
                          }
                          inputProps={{ "aria-label": "Select every ungrouped team" }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Team</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right">
                        People
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {ungrouped.map((t) => (
                      <TableRow key={t.specialRatingGroupId} hover>
                        <TableCell padding="checkbox">
                          <Checkbox
                            size="small"
                            checked={selected.has(t.specialRatingGroupId)}
                            onChange={() =>
                              setSelected((prev) => {
                                const next = new Set(prev);
                                if (next.has(t.specialRatingGroupId))
                                  next.delete(t.specialRatingGroupId);
                                else next.add(t.specialRatingGroupId);
                                return next;
                              })
                            }
                            inputProps={{ "aria-label": `Select ${teamLabel(t)}` }}
                          />
                        </TableCell>
                        <TableCell>{teamLabel(t)}</TableCell>
                        <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums" }}>
                          {t.headCount ?? 0}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            )}
          </>
        )}
      </ParSection>

      <ParSection
        title="Groups"
        subtitle="Quota is suggested from headcount. Adjust it before saving."
      >
        {groups.length === 0 ? (
          <ParEmpty>No groups yet.</ParEmpty>
        ) : (
          <Stack spacing={1.5}>
            {groups.map((g) => (
              <Box
                key={g.localId}
                sx={{ border: 1, borderColor: "divider", borderRadius: 1.5, p: 1.75 }}
              >
                <Stack
                  direction="row"
                  sx={{ alignItems: "center", gap: 1.5, mb: 1, flexWrap: "wrap" }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 700, mr: "auto" }}>
                    {g.name}
                  </Typography>
                  {isFlexibleQuota({ top5: g.top5Quota, top20: g.top20Quota }) && (
                    <Chip
                      size="small"
                      variant="outlined"
                      color="warning"
                      label="1 slot · Top 5% or Top 20%"
                    />
                  )}
                  <TextField
                    size="small"
                    type="number"
                    label="Top 5%"
                    value={g.top5Quota}
                    onChange={(e) =>
                      setGroups((prev) =>
                        prev.map((x) =>
                          x.localId === g.localId
                            ? { ...x, top5Quota: Math.max(0, Number(e.target.value) || 0) }
                            : x,
                        ),
                      )
                    }
                    sx={{ width: 110 }}
                  />
                  <TextField
                    size="small"
                    type="number"
                    label="Top 20%"
                    value={g.top20Quota}
                    onChange={(e) =>
                      setGroups((prev) =>
                        prev.map((x) =>
                          x.localId === g.localId
                            ? { ...x, top20Quota: Math.max(0, Number(e.target.value) || 0) }
                            : x,
                        ),
                      )
                    }
                    sx={{ width: 110 }}
                  />
                  <Button
                    size="small"
                    color="error"
                    onClick={() =>
                      setGroups((prev) => prev.filter((x) => x.localId !== g.localId))
                    }
                    disabled={busy}
                    sx={{ textTransform: "none", fontWeight: 600 }}
                  >
                    Ungroup
                  </Button>
                </Stack>
                <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75 }}>
                  {g.teams.map((t) => (
                    <Chip key={t.specialRatingGroupId} size="small" label={teamLabel(t)} />
                  ))}
                </Stack>
              </Box>
            ))}
          </Stack>
        )}

        <Stack direction="row" spacing={1} sx={{ mt: 2, justifyContent: "flex-end" }}>
          <Button
            size="small"
            variant="contained"
            onClick={saveAndOpen}
            // Every team must be in a group: the cycle cannot open with a team
            // that has no quota to draw on.
            disabled={!allGrouped || busy}
            sx={{ fontWeight: 600 }}
          >
            {busy ? "Saving…" : "Save quota and open the cycle"}
          </Button>
        </Stack>
        {!allGrouped && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5, textAlign: "right" }}>
            Group every team first.
          </Typography>
        )}
      </ParSection>

      <Dialog open={naming} onClose={() => setNaming(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Name this group</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {selectedTeams.length} {selectedTeams.length === 1 ? "team" : "teams"} ·{" "}
            {selectedHeads} people. Quota will start at{" "}
            {defaultQuotaForHeadCount(selectedHeads).top5} and{" "}
            {defaultQuotaForHeadCount(selectedHeads).top20}, and you can change it after.
          </Typography>
          <TextField
            size="small"
            fullWidth
            label="Group name"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              createGroup();
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button size="small" onClick={() => setNaming(false)}>
            Cancel
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={createGroup}
            disabled={draftName.trim() === ""}
            sx={{ fontWeight: 600 }}
          >
            Create group
          </Button>
        </DialogActions>
      </Dialog>
    </ParPanel>
  );
}
