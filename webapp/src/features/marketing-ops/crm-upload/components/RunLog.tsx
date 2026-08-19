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

import { Box, Typography } from "@wso2/oxygen-ui";
import { AlertTriangle, CheckCircle2, CircleSlash, XCircle } from "@wso2/oxygen-ui-icons-react";
import type { PipelineRun } from "../crmUploadTypes";
import { RunStatusChip } from "./CrmUi";
import { NUMERIC, OUTCOME, eyebrow, fmtClock } from "./crmStyles";

// One run, told as four steps.
//
// The run itself has a single status field, which is too coarse to act on: "partial"
// could mean the Entity Service was down halfway through, or that a handful of records
// were flagged as duplicates and everything else went fine. Those need different
// reactions, so the steps below derive what actually happened from the counts.

interface Step {
  label: string;
  detail: string;
  outcome: "ok" | "warn" | "error" | "skip";
}

function deriveSteps(run: PipelineRun): Step[] {
  // A 'failed' run is a pipeline-level failure (an Entity Service outage or an
  // unhandled error), which is a different thing from records failing to insert.
  const pipelineFailed = run.status === "failed";
  const updated = run.updated ?? 0;
  const synced = run.inserted + updated;

  // There is no separate preflight duplicate stage — duplicates are reported by the
  // Entity Service DURING insertion. So the sync step carries the whole breakdown.
  const parts = [
    run.inserted ? `${run.inserted} inserted` : null,
    updated ? `${updated} updated` : null,
    run.duplicates ? `${run.duplicates} duplicate${run.duplicates === 1 ? "" : "s"}` : null,
    run.failed ? `${run.failed} failed` : null,
  ].filter(Boolean) as string[];

  const syncDetail =
    pipelineFailed && synced === 0
      ? "Not synced"
      : parts.length
        ? parts.join(" · ")
        : "Nothing to sync";

  return [
    { label: "Pipeline run created", detail: fmtClock(run.started_at), outcome: "ok" },
    {
      label: "Batch locked",
      detail: run.total_records > 0 ? `${run.total_records} records` : "No pending records",
      outcome: run.total_records > 0 ? "ok" : "skip",
    },
    {
      label: "CRM sync",
      detail: syncDetail,
      // Red ONLY on a pipeline failure that synced nothing. Duplicates flagged for
      // review, or records the service rejected, are an amber "needs attention" —
      // calling them a run error would train everyone to ignore the colour.
      outcome:
        pipelineFailed && synced === 0
          ? "error"
          : run.failed > 0 || run.duplicates > 0
            ? "warn"
            : "ok",
    },
    {
      label: "Run complete",
      // On a failure, show WHY rather than a timestamp — "Entity Service
      // unavailable: …" is the only thing anyone wants from this row.
      detail: pipelineFailed && run.error_message ? run.error_message : fmtClock(run.completed_at),
      outcome: pipelineFailed ? "error" : run.status === "partial" ? "warn" : "ok",
    },
  ];
}

const OUTCOME_COLOR = {
  ok: OUTCOME.synced,
  warn: OUTCOME.attention,
  error: OUTCOME.rejected,
  skip: OUTCOME.closed,
} as const;

const OUTCOME_ICON = {
  ok: CheckCircle2,
  warn: AlertTriangle,
  error: XCircle,
  skip: CircleSlash,
} as const;

export default function RunLog({ run }: { run: PipelineRun }) {
  const steps = deriveSteps(run);

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
        <Typography sx={eyebrow}>
          {run.scheduler_type === "leads" ? "Lead pipeline" : "Account pipeline"}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <RunStatusChip status={run.status} />
      </Box>

      {steps.map((step, i) => {
        const color = OUTCOME_COLOR[step.outcome];
        const Icon = OUTCOME_ICON[step.outcome];
        return (
          <Box
            key={step.label}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.25,
              py: 1,
              borderTop: i === 0 ? 0 : 1,
              borderColor: "divider",
            }}
          >
            <Box sx={{ display: "flex", color, flexShrink: 0 }}>
              <Icon size={15} />
            </Box>
            <Typography sx={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{step.label}</Typography>
            <Typography
              sx={{ fontSize: 12, color: "text.secondary", fontWeight: 500, ...NUMERIC }}
            >
              {step.detail}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}
