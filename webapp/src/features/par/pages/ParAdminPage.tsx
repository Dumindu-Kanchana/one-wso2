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
  CircularProgress,
  Skeleton,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  Typography,
} from "@wso2/oxygen-ui";
import { ShieldIcon } from "@wso2/oxygen-ui-icons-react";
import { useSearchParams } from "react-router";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { describeError } from "@api/errors";
import ParShell from "../components/ParShell";
import ParPanel from "../components/ParPanel";
import ParSection from "../components/ParSection";
import ParEmpty from "../components/ParEmpty";
import ParCycleForm from "../components/ParCycleForm";
import ParAdminQuotaPanel from "../components/ParAdminQuotaPanel";
import ParAdminSummaryPanel from "../components/ParAdminSummaryPanel";
import {
  useCreateParCycle,
  useCyclesByStatus,
  useGlobalConfigurations,
} from "../api/useParAdmin";
import { formatParDate, formatParPeriod } from "../util/parDates";
import { parCycleStatusMeta } from "../util/parStatus";
import { parAdminCycle, parAdminView } from "../util/parAdminState";
import type { ParCycleFormValues } from "../util/parCycleForm";

// PAR administration.
//
// See docs/ported-apps/par-app.md §6.2. The Ongoing tab is a state machine over
// which cycle exists — the branch order is in util/parAdminState.ts, ported from
// the standalone app, and the PENDING poll with it.
//
// Placement under Me is provisional and was always recorded as such (§8.8):
// creating cycles and setting org-wide quota is an HR function, and People Ops
// is the perspective that exists for it. Everything here is gate-restricted to
// admins either way, so moving it is a registry entry and a route prefix.

const VIEWS = [
  { key: "ongoing", label: "Ongoing" },
  { key: "history", label: "History" },
] as const;

type ViewKey = (typeof VIEWS)[number]["key"];

export default function ParAdminPage(): JSX.Element {
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab");
  const view: ViewKey = VIEWS.some((v) => v.key === requested) ? (requested as ViewKey) : "ongoing";

  return (
    <ParShell
      eyebrow={{ icon: ShieldIcon, label: "PAR" }}
      title="PAR administration"
      subtitle="Create and configure review cycles for the organisation."
      require="admin"
    >
      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 2.25 }}>
        <Tabs
          value={view}
          onChange={(_e, next: ViewKey) => {
            const nextParams = new URLSearchParams(params);
            if (next === "ongoing") nextParams.delete("tab");
            else nextParams.set("tab", next);
            setParams(nextParams, { replace: true });
          }}
        >
          {VIEWS.map((v) => (
            <Tab key={v.key} value={v.key} label={v.label} sx={{ textTransform: "none" }} />
          ))}
        </Tabs>
      </Box>

      {view === "history" ? <ClosedCycles /> : <OngoingAdmin />}
    </ParShell>
  );
}

/** The state machine: whichever cycle exists decides the screen. */
function OngoingAdmin(): JSX.Element {
  const notifications = useNotifications();
  const [creating, setCreating] = useState(false);

  const open = useCyclesByStatus("OPEN");
  const quotaPending = useCyclesByStatus("PENDING_QUOTA");
  // Polls every ten seconds while anything is in it, and stops when it empties —
  // the standalone app's behaviour, and the reason it stops is §9.3.
  const pending = useCyclesByStatus("PENDING", { pollWhileNonEmpty: true });

  const state = {
    open: open.data,
    quotaPending: quotaPending.data,
    pending: pending.data,
  };

  const globalConfig = useGlobalConfigurations(creating);
  const create = useCreateParCycle();

  const anyPending = open.isPending || quotaPending.isPending || pending.isPending;
  const anyError = open.isError || quotaPending.isError || pending.isError;
  const errorFrom = open.isError
    ? open.error
    : quotaPending.isError
      ? quotaPending.error
      : pending.error;

  if (anyPending) {
    return <Skeleton variant="rectangular" height={240} sx={{ borderRadius: 1.5 }} />;
  }
  if (anyError) {
    return (
      <Alert severity="error">
        Couldn&apos;t load the cycle state. {describeError(errorFrom)}
      </Alert>
    );
  }

  const cycle = parAdminCycle(state);
  const which = creating ? "createForm" : parAdminView(state);

  if (which === "createForm") {
    return (
      <ParPanel>
        <ParCycleForm
          mode="create"
          isSaving={create.isPending}
          initial={{
            // The org-wide defaults seed a new cycle; the standalone app fetches
            // them when the form opens, for the same reason.
            employeeParQuestion: globalConfig.data?.employeeParQuestion ?? "",
            threeSixtyReviewQuestion: globalConfig.data?.threeSixtyReviewQuestion ?? "",
            parRatings: globalConfig.data?.parRatings ?? [],
            threeSixtyReviewRatings: globalConfig.data?.threeSixtyReviewRatings ?? [],
          }}
          onCancel={() => setCreating(false)}
          onSubmit={(values: ParCycleFormValues) =>
            create.mutate(values as unknown as Record<string, unknown>, {
              onSuccess: () => {
                setCreating(false);
                notifications.showSuccess("Cycle creation started");
              },
              onError: (err) => notifications.showError(describeError(err)),
            })
          }
        />
      </ParPanel>
    );
  }

  if (which === "creating") {
    return (
      <ParPanel>
        <ParSection title={cycle?.parCycleName ?? "New cycle"} subtitle="Being created.">
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", py: 2 }}>
            <CircularProgress size={18} />
            <Box>
              <Typography variant="body2">
                The backend is setting the cycle up. This screen re-checks every ten seconds.
              </Typography>
              {/* §9.3, carried forward deliberately: a job that fails sets a
                  status no screen queries, so this simply stops and the screen
                  offers to create a cycle whose slot is still taken. */}
              <Typography variant="caption" color="text.secondary">
                If this stops without the cycle appearing, the job failed — creating another will be
                refused, and it needs looking at on the backend.
              </Typography>
            </Box>
          </Stack>
        </ParSection>
      </ParPanel>
    );
  }

  if (which === "assignQuota" && cycle) {
    return <ParAdminQuotaPanel cycle={cycle} />;
  }

  if (which === "summary" && cycle) {
    return <ParAdminSummaryPanel cycle={cycle} />;
  }

  return (
    <ParPanel>
      <ParSection
        title="No cycle in progress"
        subtitle="Creating one starts a background job that sets up every participant."
      >
        <Stack spacing={2} sx={{ alignItems: "flex-start" }}>
          <Typography variant="body2" color="text.secondary">
            Only one cycle can be in progress at a time. The org-wide defaults on the settings
            screen seed the new cycle&apos;s questions and rating scales.
          </Typography>
          <Button
            size="small"
            variant="contained"
            onClick={() => setCreating(true)}
            sx={{ fontWeight: 600 }}
          >
            Create a cycle
          </Button>
        </Stack>
      </ParSection>
    </ParPanel>
  );
}

/** Closed cycles, and the summary of whichever one is opened. */
function ClosedCycles(): JSX.Element {
  const closed = useCyclesByStatus("CLOSED");
  const [openId, setOpenId] = useState<number | null>(null);
  const list = closed.data ?? [];
  const selected = list.find((c) => c.parCycleId === openId);

  return (
    <>
      <ParPanel>
        <ParSection title="Closed cycles" subtitle="Newest first.">
          {closed.isPending ? (
            <Skeleton variant="rectangular" height={140} sx={{ borderRadius: 1.5 }} />
          ) : closed.isError ? (
            <Alert severity="error">
              Couldn&apos;t load closed cycles. {describeError(closed.error)}
            </Alert>
          ) : list.length === 0 ? (
            <ParEmpty>No cycle has been closed yet.</ParEmpty>
          ) : (
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {["Cycle", "Period", "Closed", "Status", ""].map((h, i) => (
                      <TableCell
                        key={h || `blank-${i}`}
                        sx={{ fontWeight: 700, whiteSpace: "nowrap" }}
                      >
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {[...list]
                    .sort((a, b) =>
                      (b.parCycleEndDate ?? "").localeCompare(a.parCycleEndDate ?? ""),
                    )
                    .map((c) => {
                      const isOpen = openId === c.parCycleId;
                      const meta = parCycleStatusMeta(c.parCycleStatus);
                      return (
                        <TableRow key={c.parCycleId} hover>
                          <TableCell sx={{ fontWeight: 600 }}>{c.parCycleName}</TableCell>
                          <TableCell>
                            {formatParPeriod(c.parCycleStartDate, c.parCycleEndDate)}
                          </TableCell>
                          <TableCell>{formatParDate(c.parCycleEndDate)}</TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              variant="outlined"
                              color={meta.color}
                              label={meta.label}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Button
                              size="small"
                              variant={isOpen ? "contained" : "outlined"}
                              onClick={() => setOpenId(isOpen ? null : c.parCycleId)}
                              sx={{ textTransform: "none", fontWeight: 600 }}
                            >
                              {isOpen ? "Hide" : "Open"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </Box>
          )}
        </ParSection>
      </ParPanel>

      {selected && <ParAdminSummaryPanel key={selected.parCycleId} cycle={selected} readOnly />}
    </>
  );
}
