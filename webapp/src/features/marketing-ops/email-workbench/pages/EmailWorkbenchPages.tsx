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
import { Alert, Box, CircularProgress, Stack, Typography } from "@wso2/oxygen-ui";
import { describeError } from "@api/errors";
import { MARKETING_OPS_EYEBROW } from "@constants/marketingOpsApps";
import MarketingOpsShell from "../../components/MarketingOpsShell";
import { useDraft, useTemplate } from "../../api/useEmailWorkbench";
import AdvancedEditor from "../components/AdvancedEditor";
import TemplateForm from "../components/TemplateForm";
import TemplateHistory from "../components/TemplateHistory";
import TemplateLibrary from "../components/TemplateLibrary";

// The three Email Workbench routes.
//
// Opening a template or a draft is TRANSIENT STATE layered over the route rather
// than a route of its own — the same shape Marketing Ops used. The editor is an
// immersive workspace, not a step in a wizard, and keeping it out of the URL means a
// half-finished composition can't be deep-linked to and then lost on reload.
//
// The editor gets a tall flex container because its canvas is a full-height iframe;
// everything else is a normal document-flow page.

function EditorFrame({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "calc(100vh - 190px)", minHeight: 420 }}>
      <Box sx={{ flex: 1, minHeight: 0 }}>{children}</Box>
    </Box>
  );
}

function Loading({ what }: { what: string }) {
  return (
    <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", py: 4 }}>
      <CircularProgress size={16} />
      <Typography sx={{ fontSize: 13, color: "text.secondary" }}>Opening {what}…</Typography>
    </Stack>
  );
}

// ---- Create an email -------------------------------------------------------

export function EmailWorkbenchCreatePage() {
  const [openId, setOpenId] = useState<string | null>(null);
  const template = useTemplate(openId);

  if (openId) {
    if (template.isLoading) {
      return (
        <MarketingOpsShell eyebrow={MARKETING_OPS_EYEBROW.emailWorkbench} title="Create an email">
          <Loading what="the template" />
        </MarketingOpsShell>
      );
    }
    if (template.isError) {
      return (
        <MarketingOpsShell eyebrow={MARKETING_OPS_EYEBROW.emailWorkbench} title="Create an email">
          <Alert severity="error">
            Could not open that template. {describeError(template.error)}
          </Alert>
        </MarketingOpsShell>
      );
    }
    if (template.data) {
      return (
        <MarketingOpsShell eyebrow={MARKETING_OPS_EYEBROW.emailWorkbench} title={template.data.name}>
          <EditorFrame>
            <AdvancedEditor
              html={template.data.html}
              name={template.data.name}
              sourceTemplateId={template.data.id}
              onBack={() => setOpenId(null)}
            />
          </EditorFrame>
        </MarketingOpsShell>
      );
    }
  }

  return (
    <MarketingOpsShell
      eyebrow={MARKETING_OPS_EYEBROW.emailWorkbench}
      title="Create an email"
      subtitle="Start from an approved template, edit its content in place, then push the finished email to Pardot."
    >
      <TemplateLibrary mode="compose" onOpen={setOpenId} />
    </MarketingOpsShell>
  );
}

// ---- My emails (per-user drafts) -------------------------------------------

export function EmailWorkbenchHistoryPage() {
  const [openId, setOpenId] = useState<string | null>(null);
  const draft = useDraft(openId);

  if (openId) {
    if (draft.isLoading) {
      return (
        <MarketingOpsShell eyebrow={MARKETING_OPS_EYEBROW.emailWorkbench} title="My emails">
          <Loading what="your email" />
        </MarketingOpsShell>
      );
    }
    if (draft.isError) {
      return (
        <MarketingOpsShell eyebrow={MARKETING_OPS_EYEBROW.emailWorkbench} title="My emails">
          <Alert severity="error">Could not open that email. {describeError(draft.error)}</Alert>
        </MarketingOpsShell>
      );
    }
    if (draft.data) {
      return (
        <MarketingOpsShell eyebrow={MARKETING_OPS_EYEBROW.emailWorkbench} title={draft.data.name}>
          <EditorFrame>
            <AdvancedEditor
              html={draft.data.html}
              name={draft.data.name}
              draftId={draft.data.id}
              pardotTemplateId={draft.data.pardot_template_id ?? null}
              onBack={() => setOpenId(null)}
            />
          </EditorFrame>
        </MarketingOpsShell>
      );
    }
  }

  return (
    <MarketingOpsShell
      eyebrow={MARKETING_OPS_EYEBROW.emailWorkbench}
      title="My emails"
      subtitle="Your drafts and completed emails. Rows are scoped to you — nobody else sees them."
    >
      <TemplateHistory onOpen={setOpenId} />
    </MarketingOpsShell>
  );
}

// ---- Manage templates (admin) ----------------------------------------------

export function EmailWorkbenchManagePage() {
  // `undefined` = list; `null` = new; a string = editing that template.
  const [editing, setEditing] = useState<string | null | undefined>(undefined);

  if (editing !== undefined) {
    return (
      <MarketingOpsShell
        eyebrow={MARKETING_OPS_EYEBROW.emailWorkbench}
        title="Manage templates"
        subtitle="Onboard the approved HTML marketers build from."
      >
        <TemplateForm
          editId={editing}
          onCancel={() => setEditing(undefined)}
          onSaved={() => setEditing(undefined)}
        />
      </MarketingOpsShell>
    );
  }

  return (
    <MarketingOpsShell
      eyebrow={MARKETING_OPS_EYEBROW.emailWorkbench}
      title="Manage templates"
      subtitle="Onboard, edit, or remove the templates marketers can use. Editing a template does not change emails already built from it."
    >
      <TemplateLibrary
        mode="manage"
        onOpen={(id) => setEditing(id)}
        onNew={() => setEditing(null)}
        onEdit={(id) => setEditing(id)}
      />
    </MarketingOpsShell>
  );
}
