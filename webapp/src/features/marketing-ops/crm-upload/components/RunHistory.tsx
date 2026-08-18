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
  Dialog,
  DialogContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@wso2/oxygen-ui";
import { describeError } from "@api/errors";
import { useRuns } from "../../api/useCrmUpload";
import type { PipelineRun } from "../crmUploadTypes";
import RecordBrowser from "./RecordBrowser";
import RunLog from "./RunLog";
import {
  CrmLoading,
  Empty,
  KindChip,
  Panel,
  PagingFooter,
  ProportionBar,
  RunStatusChip,
  StatCell,
  StatStrip,
  type ProportionSegment,
} from "./CrmUi";
import {
  CRM_LOADING,
  NUMERIC,
  OUTCOME,
  TH,
  WINDOW_DAYS,
  eyebrow,
  fmtDuration,
  fmtTime,
  quietBtn,
  windowFromDate,
} from "./crmStyles";

// Every run of both schedulers, newest first, with what each one did.
//
// The outcome column is a proportion bar rather than four numbers, because the
// question asked of a run history is comparative — "was that run like the others?" —
// and four columns of digits answer it much more slowly than four bars of the same
// widths do. The exact counts are in the legend under each bar.

const PAGE_SIZE = 20;

function segmentsFor(run: PipelineRun): ProportionSegment[] {
  return [
    { value: run.inserted, color: OUTCOME.synced, label: "Inserted" },
    { value: run.updated ?? 0, color: OUTCOME.changed, label: "Updated" },
    { value: run.duplicates, color: OUTCOME.attention, label: "Duplicates" },
    { value: run.failed, color: OUTCOME.rejected, label: "Failed" },
  ];
}

export default function RunHistory() {
  const [page, setPage] = useState(1);
  const [drill, setDrill] = useState<PipelineRun | null>(null);

  const params = useMemo(
    () =>
      new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
        from_date: windowFromDate(),
      }),
    [page],
  );

  const query = useRuns(params);
  const data = query.data;
  const runs = data?.items ?? [];

  return (
    <Box>
      <Typography sx={{ fontSize: 12, color: "text.secondary", mb: 1.5 }}>
        Showing pipeline runs from the last {WINDOW_DAYS} days.
      </Typography>

      {query.isError ? (
        <Alert severity="error">
          Could not load the pipeline runs. {describeError(query.error)}
        </Alert>
      ) : !data ? (
        <CrmLoading messages={CRM_LOADING.runs} />
      ) : runs.length === 0 ? (
        <Empty>No pipeline runs in the last {WINDOW_DAYS} days</Empty>
      ) : (
        <Panel>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={TH}>Pipeline</TableCell>
                <TableCell sx={TH}>Started</TableCell>
                <TableCell sx={TH}>Duration</TableCell>
                <TableCell sx={TH}>Status</TableCell>
                <TableCell sx={{ ...TH, minWidth: 320 }}>Outcome</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {runs.map((run) => (
                <TableRow key={run.id} hover>
                  <TableCell>
                    <Box
                      component="button"
                      type="button"
                      onClick={() => setDrill(run)}
                      aria-label={`Open run ${run.id}`}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        border: 0,
                        p: 0,
                        bgcolor: "transparent",
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      <KindChip kind={run.scheduler_type === "leads" ? "lead" : "account"} />
                      <Typography
                        sx={{ fontSize: 11.5, color: "text.secondary", fontWeight: 600, ...NUMERIC }}
                      >
                        {run.id.slice(0, 8)}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ fontSize: 12.5, fontWeight: 600, ...NUMERIC }}>
                      {fmtTime(run.started_at)}
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: "text.secondary" }}>
                      by {run.triggered_by}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ fontSize: 13, fontWeight: 700, ...NUMERIC }}>
                      {fmtDuration(run)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <RunStatusChip status={run.status} />
                  </TableCell>
                  <TableCell>
                    <ProportionBar segments={segmentsFor(run)} total={run.total_records} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      )}

      {data && (
        <PagingFooter
          page={page}
          pageSize={PAGE_SIZE}
          total={data.total}
          pageCount={data.pages}
          onPageChange={setPage}
        />
      )}

      {drill && <RunDrillDown run={drill} onClose={() => setDrill(null)} />}
    </Box>
  );
}

// One run in full: its step log, its totals, and every record it touched.
//
// The record browser inside is the same component the Records screen uses, scoped by
// `runId` — so "which records did this run fail on" is answered by the same filters,
// the same status tabs and the same detail dialog as everywhere else, rather than by a
// second, thinner table that would drift from it.
function RunDrillDown({ run, onClose }: { run: PipelineRun; onClose: () => void }) {
  return (
    <Dialog open fullWidth maxWidth="lg" onClose={onClose}>
      <Box sx={{ px: 3, pt: 3, pb: 2.5, borderBottom: 1, borderColor: "divider" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
          <Typography sx={eyebrow}>
            Pipeline · {run.scheduler_type === "leads" ? "Lead" : "Account"} run
          </Typography>
          <RunStatusChip status={run.status} />
        </Box>
        <Typography sx={{ fontSize: 21, fontWeight: 800, letterSpacing: "-0.02em" }}>
          {run.scheduler_type === "leads" ? "Leads" : "Accounts"}
          <Box component="span" sx={{ color: "text.disabled", mx: 0.75, fontWeight: 400 }}>
            —
          </Box>
          {fmtTime(run.started_at)}
        </Typography>
        <Typography sx={{ fontSize: 11.5, color: "text.secondary", ...NUMERIC }}>
          {run.id}
        </Typography>
      </Box>

      <DialogContent sx={{ px: 3, pt: 2.5 }}>
        <StatStrip>
          <StatCell
            label="Batch total"
            value={run.total_records}
            color="text.primary"
            total={run.total_records}
            isTotal
          />
          <StatCell
            label="Inserted"
            value={run.inserted}
            color={OUTCOME.synced}
            total={run.total_records}
          />
          <StatCell
            label="Updated"
            value={run.updated ?? 0}
            color={OUTCOME.changed}
            total={run.total_records}
          />
          <StatCell
            label="Duplicates"
            value={run.duplicates}
            color={OUTCOME.attention}
            total={run.total_records}
          />
          <StatCell
            label="Failed"
            value={run.failed}
            color={OUTCOME.rejected}
            total={run.total_records}
          />
        </StatStrip>

        <Box sx={{ mb: 3 }}>
          <Panel>
            <Box sx={{ px: 2, py: 1.5 }}>
              <RunLog run={run} />
            </Box>
          </Panel>
        </Box>

        <RecordBrowser
          type={run.scheduler_type === "leads" ? "leads" : "accounts"}
          runId={run.id}
        />
      </DialogContent>
      <Box sx={{ px: 3, py: 2, display: "flex", justifyContent: "flex-end" }}>
        <Button onClick={onClose} sx={quietBtn}>
          Close
        </Button>
      </Box>
    </Dialog>
  );
}
