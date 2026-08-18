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
import { Alert, Box, Button, Snackbar } from "@wso2/oxygen-ui";
import { Play } from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import MarketingOpsShell from "../../components/MarketingOpsShell";
import { useLatestRun, useTriggerRun } from "../../api/useCrmUpload";
import type { PipelineRun, SchedulerType } from "../crmUploadTypes";
import RecordBrowser from "../components/RecordBrowser";
import ReviewQueue from "../components/ReviewQueue";
import RunHistory from "../components/RunHistory";
import RunLog from "../components/RunLog";
import {
  CrmLoading,
  Empty,
  NumberedSection,
  StatCell,
  StatStrip,
} from "../components/CrmUi";
import { CRM_LOADING, OUTCOME } from "../components/crmStyles";

// The four CRM Upload routes.
//
// Marketing Ops had these as four tabs on one page holding all their state at the top:
// two runs, a duplicates page, two view toggles, a trigger flag, a snackbar and a
// refresh key, with the tab deciding which of them mattered. Here each is a route, so
// each screen owns only its own state and TanStack Query owns the refreshing — the
// "refreshKey" that was threaded into three components as a prop was a cache
// invalidation written by hand.
//
// The tab labels are also reassigned, deliberately. What Marketing Ops called
// "Last Run" is the state of the two pipelines, and what it called "Pipelines" is a
// history of runs. One WSO2's registry already described them that way round, and the
// registry's descriptions are the ones that match what the screens do.

const EYEBROW = "🔄 CRM Upload";

// ---- Pipelines: what the two schedulers did last -----------------------------

function runCaption(run: PipelineRun | null | undefined): string | undefined {
  if (run === undefined) return undefined;
  if (run === null) return "No runs recorded";
  const when = run.completed_at ?? run.started_at;
  const stamp = when
    ? new Date(when).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
  return `Last ${run.completed_at ? "completed" : "started"} · ${stamp} · ${run.total_records} records`;
}

export function CrmUploadPipelinesPage() {
  const leads = useLatestRun("leads");
  const accounts = useLatestRun("accounts");
  const trigger = useTriggerRun();

  const [started, setStarted] = useState<SchedulerType | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(kind: SchedulerType) {
    setError(null);
    try {
      await trigger.mutateAsync(kind);
      setStarted(kind);
    } catch (e) {
      setError(describeError(e));
    }
  }

  const runs = [leads.data, accounts.data].filter(Boolean) as PipelineRun[];
  const sum = (pick: (r: PipelineRun) => number) => runs.reduce((s, r) => s + pick(r), 0);
  const total = sum((r) => r.total_records);

  const loading = leads.isLoading || accounts.isLoading;
  const failed = leads.error ?? accounts.error;

  return (
    <MarketingOpsShell
      eyebrow={EYEBROW}
      title="Pipelines"
      subtitle="Two schedulers ingest enriched leads and accounts into Salesforce through the Entity Service. This is where each one stands."
    >
      <Box sx={{ display: "flex", gap: 1, mb: 3, flexWrap: "wrap" }}>
        {(["leads", "accounts"] as const).map((kind) => (
          <Button
            key={kind}
            size="small"
            variant="outlined"
            startIcon={<Play size={14} />}
            disabled={trigger.isPending}
            onClick={() => void run(kind)}
            sx={{ textTransform: "none", fontSize: 12.5, fontWeight: 700 }}
          >
            {trigger.isPending && trigger.variables === kind
              ? "Starting…"
              : `Run ${kind}`}
          </Button>
        ))}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {failed ? (
        <Alert severity="error">Could not load the schedulers. {describeError(failed)}</Alert>
      ) : loading ? (
        <CrmLoading messages={CRM_LOADING.pipelines} />
      ) : (
        <>
          {/* Both schedulers' last runs added together. They run on the same cadence
              against the same Entity Service, so their combined shape is the honest
              answer to "is ingest healthy" — a per-pipeline split is one section down. */}
          <StatStrip>
            <StatCell label="Batch total" value={total} color="text.primary" total={total} isTotal />
            <StatCell
              label="Inserted"
              value={sum((r) => r.inserted)}
              color={OUTCOME.synced}
              total={total}
            />
            <StatCell
              label="Updated"
              value={sum((r) => r.updated ?? 0)}
              color={OUTCOME.changed}
              total={total}
            />
            <StatCell
              label="Duplicates"
              value={sum((r) => r.duplicates)}
              color={OUTCOME.attention}
              total={total}
            />
            <StatCell
              label="Failed"
              value={sum((r) => r.failed)}
              color={OUTCOME.rejected}
              total={total}
            />
          </StatStrip>

          <NumberedSection index="01" title="Lead scheduler" subtitle={runCaption(leads.data)}>
            {leads.data ? <RunLog run={leads.data} /> : <Empty>No lead runs yet</Empty>}
          </NumberedSection>

          <NumberedSection index="02" title="Account scheduler" subtitle={runCaption(accounts.data)}>
            {accounts.data ? <RunLog run={accounts.data} /> : <Empty>No account runs yet</Empty>}
          </NumberedSection>
        </>
      )}

      {/* A trigger returns as soon as the run is accepted, which is well before it
          finishes — so the confirmation says "started", and the lists refresh
          themselves as the run progresses. */}
      <Snackbar
        open={started !== null}
        autoHideDuration={5000}
        onClose={() => setStarted(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="success" variant="filled" onClose={() => setStarted(null)}>
          {started === "leads" ? "Lead" : "Account"} run started — it will appear in the run log.
        </Alert>
      </Snackbar>
    </MarketingOpsShell>
  );
}

// ---- Run log: every run, newest first ----------------------------------------

export function CrmUploadRunLogPage() {
  return (
    <MarketingOpsShell
      eyebrow={EYEBROW}
      title="Run log"
      subtitle="Every pipeline run and what it did. Open one to see its steps and the records it touched."
    >
      <RunHistory />
    </MarketingOpsShell>
  );
}

// ---- Records: everything ingested --------------------------------------------

const RECORD_VIEWS = [
  { key: "all", label: "All" },
  { key: "leads", label: "Leads" },
  { key: "accounts", label: "Accounts" },
] as const;

export function CrmUploadRecordsPage() {
  const [view, setView] = useState<(typeof RECORD_VIEWS)[number]["key"]>("all");

  return (
    <MarketingOpsShell
      eyebrow={EYEBROW}
      title="Records"
      subtitle="Every record the pipelines have ingested, and what became of it. Six of the nine statuses look like failures and aren't — hover one to see what it means."
    >
      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 0.5, mb: 1.5 }}>
        {RECORD_VIEWS.map((v) => {
          const on = view === v.key;
          return (
            <Button
              key={v.key}
              size="small"
              onClick={() => setView(v.key)}
              aria-pressed={on}
              sx={{
                textTransform: "none",
                fontSize: 12.5,
                fontWeight: on ? 700 : 600,
                color: on ? "primary.main" : "text.secondary",
                bgcolor: on ? "action.selected" : "transparent",
              }}
            >
              {v.label}
            </Button>
          );
        })}
      </Box>
      {/* Keyed on the view so switching Leads/Accounts starts from clean filters —
          a batch id or a search from the previous view rarely matches the new one,
          and an empty table nobody asked for reads as a broken screen. */}
      <RecordBrowser key={view} type={view} />
    </MarketingOpsShell>
  );
}

// ---- Review queue: the duplicates ---------------------------------------------

export function CrmUploadReviewPage() {
  return (
    <MarketingOpsShell
      eyebrow={EYEBROW}
      title="Review queue"
      subtitle="Incoming records Salesforce matched to something it already holds. Merge one into its match, or dismiss it."
    >
      <ReviewQueue />
    </MarketingOpsShell>
  );
}
