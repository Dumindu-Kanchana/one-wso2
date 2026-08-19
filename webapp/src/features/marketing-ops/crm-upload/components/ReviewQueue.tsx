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
  DialogActions,
  DialogContent,
  DialogTitle,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { ExternalLink } from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import { salesforceRecordUrl } from "@config/apiConfig";
import { useDuplicates, useResolveDuplicate } from "../../api/useCrmUpload";
import type { DuplicateReview, RecordKind } from "../crmUploadTypes";
import DiffView from "./DiffView";
import { CrmLoading, Empty, PagingFooter } from "./CrmUi";
import { CRM_LOADING, NUMERIC, eyebrow, primaryBtn, quietBtn } from "./crmStyles";

// The one decision a machine can't make: is this incoming record the same person or
// company as one Salesforce already holds?
//
// Grouped by the INCOMING record rather than listed flat, because one incoming record
// can collide with several Salesforce records and the choice between them is a single
// decision. A flat list would offer the same record three times and let a reviewer
// merge it into two different masters.

const PAGE_SIZE = 50;

type View = "all" | "leads" | "accounts";

const VIEWS: { key: View; label: string }[] = [
  { key: "all", label: "All" },
  { key: "leads", label: "Leads" },
  { key: "accounts", label: "Accounts" },
];

/** How an incoming record introduces itself. */
function describeIncoming(dup: DuplicateReview): { name: string; sub: string } {
  const p = dup.incoming;
  if (dup.record_type === "lead") {
    return {
      name: [p.firstName, p.lastName].filter(Boolean).map(String).join(" ") || String(p.email ?? "—"),
      sub: String(p.email ?? ""),
    };
  }
  return { name: String(p.name ?? "—"), sub: String(p.website ?? "") };
}

const sfObject = (kind: RecordKind) => (kind === "lead" ? "Lead" : "Account");

export default function ReviewQueue() {
  const [view, setView] = useState<View>("all");
  const [merging, setMerging] = useState<DuplicateReview | null>(null);
  const [dismissing, setDismissing] = useState<DuplicateReview | null>(null);

  // Paging is held with the view it belongs to, so switching to Leads shows Leads from
  // the start rather than page 4 of a list that may only have one page.
  const [paging, setPaging] = useState({ view, page: 1 });
  const page = paging.view === view ? paging.page : 1;
  const setPage = (p: number) => setPaging({ view, page: p });

  const params = useMemo(() => {
    const p = new URLSearchParams({
      resolution: "pending",
      page: String(page),
      limit: String(PAGE_SIZE),
    });
    if (view === "leads") p.set("record_type", "lead");
    if (view === "accounts") p.set("record_type", "account");
    return p;
  }, [page, view]);

  const query = useDuplicates(params);
  const data = query.data;

  // Group by the incoming record. Object key order is insertion order for string keys,
  // so the queue keeps the server's ordering.
  const groups = useMemo(() => {
    const by = new Map<string, DuplicateReview[]>();
    for (const d of data?.items ?? []) {
      const list = by.get(d.crm_record_id);
      if (list) list.push(d);
      else by.set(d.crm_record_id, [d]);
    }
    return [...by.entries()];
  }, [data]);

  return (
    <Box>
      {/* View switch, plus the count as the headline — a review queue's size IS its
          status, so it reads as a number rather than a caption. */}
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 2,
          flexWrap: "wrap",
          mb: 2,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
          <Typography
            sx={{
              fontSize: 27,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              lineHeight: 1,
              color: data && data.total > 0 ? "warning.main" : "text.disabled",
              ...NUMERIC,
            }}
          >
            {(data?.total ?? 0).toLocaleString()}
          </Typography>
          <Box>
            <Typography sx={eyebrow}>Pending review</Typography>
            <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
              {data?.total === 1 ? "Record awaiting a decision" : "Records awaiting a decision"}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: "flex", gap: 0.5 }}>
          {VIEWS.map((v) => {
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
      </Box>

      {query.isError ? (
        <Alert severity="error">
          Could not load the review queue. {describeError(query.error)}
        </Alert>
      ) : !data ? (
        <CrmLoading messages={CRM_LOADING.queue} />
      ) : groups.length === 0 ? (
        <Empty>No pending duplicates</Empty>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {groups.map(([crmRecordId, matches]) => {
            const head = matches[0];
            const { name, sub } = describeIncoming(head);
            return (
              <Box
                key={crmRecordId}
                sx={{ border: 1, borderColor: "divider", borderRadius: 1.5, overflow: "hidden" }}
              >
                {/* Who arrived */}
                <Box
                  sx={{
                    px: 2,
                    py: 1.5,
                    bgcolor: "background.default",
                    borderBottom: 1,
                    borderColor: "divider",
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                  }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ ...eyebrow, mb: 0.4 }}>
                      Incoming {head.record_type}
                    </Typography>
                    <Typography sx={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em" }}>
                      {name}
                    </Typography>
                    {sub && (
                      <Typography sx={{ fontSize: 12, color: "text.secondary" }}>{sub}</Typography>
                    )}
                  </Box>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: 0.5,
                      px: 1,
                      py: 0.5,
                      borderRadius: 1,
                      border: 1,
                      borderColor: "divider",
                    }}
                  >
                    <Typography sx={{ fontSize: 15, fontWeight: 800, lineHeight: 1, ...NUMERIC }}>
                      {matches.length}
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: "text.secondary", fontWeight: 600 }}>
                      {matches.length === 1 ? "match" : "matches"}
                    </Typography>
                  </Box>
                </Box>

                {/* What it collided with, one row each */}
                {matches.map((m) => (
                  <Box
                    key={m.id}
                    sx={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      alignItems: "center",
                      gap: 1.5,
                      px: 2,
                      py: 1.25,
                      borderBottom: 1,
                      borderColor: "divider",
                      "&:hover": { bgcolor: "action.hover" },
                    }}
                  >
                    <Tooltip title={`Open ${m.sf_existing_id} in Salesforce`} arrow>
                      <Box
                        component="a"
                        href={salesforceRecordUrl(sfObject(m.record_type), m.sf_existing_id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 0.5,
                          justifySelf: "start",
                          color: "info.main",
                          fontSize: 12.5,
                          fontWeight: 600,
                          textDecoration: "none",
                          ...NUMERIC,
                          "&:hover": { textDecoration: "underline" },
                        }}
                      >
                        {m.sf_existing_id}
                        <ExternalLink size={12} />
                      </Box>
                    </Tooltip>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => setMerging(m)}
                      sx={primaryBtn}
                    >
                      Merge into this record
                    </Button>
                  </Box>
                ))}

                {/* Dropping the incoming record is a decision about the GROUP — every
                    match resolves with it — so it sits under them all, not on a row. */}
                <Box
                  sx={{
                    px: 2,
                    py: 1,
                    bgcolor: "background.default",
                    display: "flex",
                    justifyContent: "flex-end",
                  }}
                >
                  <Tooltip
                    title="Drop the incoming record. Every match in this group will be marked dismissed."
                    arrow
                  >
                    <Button
                      size="small"
                      onClick={() => setDismissing(head)}
                      sx={{ ...quietBtn, "&:hover": { color: "error.main" } }}
                    >
                      Dismiss
                    </Button>
                  </Tooltip>
                </Box>
              </Box>
            );
          })}
        </Box>
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

      {merging && (
        <DiffView
          dup={merging}
          onClose={() => setMerging(null)}
          onResolved={() => setMerging(null)}
        />
      )}

      {dismissing && (
        <DismissDialog
          dup={dismissing}
          onClose={() => setDismissing(null)}
          onDone={() => setDismissing(null)}
        />
      )}
    </Box>
  );
}

function DismissDialog({
  dup,
  onClose,
  onDone,
}: {
  dup: DuplicateReview;
  onClose: () => void;
  onDone: () => void;
}) {
  const resolve = useResolveDuplicate();
  const [error, setError] = useState<string | null>(null);

  async function dismiss() {
    setError(null);
    try {
      await resolve.mutateAsync({ id: dup.id, body: { action: "dismiss" } });
      onDone();
    } catch (e) {
      setError(describeError(e));
    }
  }

  return (
    <Dialog open onClose={resolve.isPending ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontSize: 16, fontWeight: 800 }}>Dismiss this duplicate?</DialogTitle>
      <DialogContent>
        <Typography sx={{ fontSize: 13, color: "text.secondary", lineHeight: 1.5 }}>
          The incoming record will not be written. The duplicate is marked resolved and leaves the
          review queue — nothing in Salesforce changes.
        </Typography>
        {error && (
          <Alert severity="error" sx={{ mt: 2, fontSize: 12.5 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={resolve.isPending} sx={quietBtn}>
          Cancel
        </Button>
        <Button
          onClick={() => void dismiss()}
          disabled={resolve.isPending}
          variant="contained"
          color="inherit"
          sx={primaryBtn}
        >
          {resolve.isPending ? "Working…" : "Dismiss"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
