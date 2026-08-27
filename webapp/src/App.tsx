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

import { Navigate, Route, Routes } from "react-router";
import { landingPath } from "@config/landingConfig";
import SettingsPage from "@features/settings/pages/SettingsPage";
import MenuHomePage from "@features/menu/pages/MenuHomePage";
import AuthGuard from "@layouts/AuthGuard";
import AppLayout from "@layouts/AppLayout";
import PeopleOpsPage from "@features/people-ops/pages/PeopleOpsPage";
import MyProfilePage from "@features/my/pages/MyProfilePage";
import MyTeamPage from "@features/my/my-team/pages/MyTeamPage";
import TeamMemberPage from "@features/my/my-team/pages/TeamMemberPage";
import MyParPage from "@features/par/pages/MyParPage";
import ParHistoryPage from "@features/par/pages/ParHistoryPage";
import ParTeamPage from "@features/par/pages/ParTeamPage";
import FinancePage from "@features/finance/pages/FinancePage";
import WorkspacePage from "@features/workspace/pages/WorkspacePage";
import MarketingOpsPage from "@features/marketing-ops/pages/MarketingOpsPage";
import AdCampaignsAnalyticsPage from "@features/marketing-ops/ad-campaigns/pages/AdCampaignsAnalyticsPage";
import UtmGeneratorPage from "@features/marketing-ops/utilities/pages/UtmGeneratorPage";
import AssetNameGeneratorPage from "@features/marketing-ops/utilities/pages/AssetNameGeneratorPage";
import UtmSettingsPage from "@features/marketing-ops/admin/pages/UtmSettingsPage";
import AssetNameSettingsPage from "@features/marketing-ops/admin/pages/AssetNameSettingsPage";
import EmailWorkbenchSettingsPage from "@features/marketing-ops/admin/pages/EmailWorkbenchSettingsPage";
import BlockCatalogPage from "@features/marketing-ops/email-workbench/pages/BlockCatalogPage";
import EventsSettingsPage from "@features/marketing-ops/admin/pages/EventsSettingsPage";
import {
  EventsMinePage,
  EventsReviewPage,
} from "@features/marketing-ops/events/pages/EventsPages";
import {
  CrmUploadPipelinesPage,
  CrmUploadRecordsPage,
  CrmUploadReviewPage,
  CrmUploadRunLogPage,
} from "@features/marketing-ops/crm-upload/pages/CrmUploadPages";
import {
  EmailWorkbenchCreatePage,
  EmailWorkbenchHistoryPage,
  EmailWorkbenchManagePage,
} from "@features/marketing-ops/email-workbench/pages/EmailWorkbenchPages";
import LeaveApplyPage from "@features/leave/pages/LeaveApplyPage";
import LeaveHistoryPage from "@features/leave/pages/LeaveHistoryPage";
import LeaveReportsPage from "@features/leave/pages/LeaveReportsPage";
import LeaveSabbaticalComingSoonPage from "@features/leave/pages/LeaveSabbaticalComingSoonPage";
import OpdNewClaimPage from "@features/finance/opd/pages/OpdNewClaimPage";
import OpdHistoryPage from "@features/finance/opd/pages/OpdHistoryPage";
import OpdApprovalsPage from "@features/finance/opd/pages/OpdApprovalsPage";
import CcNewTransactionsPage from "@features/finance/cc/pages/CcNewTransactionsPage";
import CcPendingPage from "@features/finance/cc/pages/CcPendingPage";
import CcApprovePage from "@features/finance/cc/pages/CcApprovePage";
import CcHistoryPage from "@features/finance/cc/pages/CcHistoryPage";
import CcSettingsPage from "@features/finance/cc/pages/CcSettingsPage";
import ExpenseNewClaimPage from "@features/finance/expense/pages/ExpenseNewClaimPage";
import ExpenseHistoryPage from "@features/finance/expense/pages/ExpenseHistoryPage";
import {
  ExpenseLeadApprovalsPage,
  ExpenseFinanceApprovalsPage,
} from "@features/finance/expense/pages/ExpenseApprovalsPage";

export default function App() {
  return (
    <Routes>
      <Route element={<AuthGuard />}>
        <Route element={<AppLayout />}>
          {/* Where the app opens, from ONE_WSO2_DEFAULT_PERSPECTIVE. */}
          <Route index element={<Navigate to={landingPath()} replace />} />
          {/* Me home — the full profile page including Connected apps. */}
          <Route path="me" element={<MyProfilePage />} />
          {/* My Team — placeholder for now; the real subordinates view is on
              hold this iteration (mirrors people-app's lead-only nav item). */}
          {/* My Team — a lead's reporting chain, ported from people-app. The
              spec and the deviation list are in docs/ported-apps/my-team.md. */}
          <Route path="me/my-team" element={<MyTeamPage />} />
          <Route path="me/my-team/:employeeId" element={<TeamMemberPage />} />
          {/* PAR. The specification, the deadline table and the deliberate
              deviations are in docs/ported-apps/par-app.md. */}
          <Route path="me/par" element={<MyParPage />} />
          <Route path="me/par/history" element={<ParHistoryPage />} />
          <Route path="me/par/team" element={<ParTeamPage />} />
          {/* Me → Leave: native screens ported from leave-app. Lives here
              (not People Ops) — it's something every employee does for
              themself, not an HR-team tool. */}
          <Route path="me/leave/apply" element={<LeaveApplyPage />} />
          <Route path="me/leave/history" element={<LeaveHistoryPage />} />
          <Route path="me/leave/reports" element={<LeaveReportsPage />} />
          {/* Sabbatical use cases (apply/approve/report) are on hold this
              iteration — placeholder links out to the Leave app instead. */}
          <Route path="me/leave/sabbatical" element={<LeaveSabbaticalComingSoonPage />} />
          {/* Me → digiops-finance claim apps: native screens ported from the
              three finance apps (opd-claims, cc-expenses, expense-claims).
              Moved in from the Finance perspective — same rationale as
              Leave, an employee submits/tracks these for themself (a
              lead/finance-approver subset of items approves others'). The
              Finance perspective itself is now just a skeleton tile (see
              FinancePage) — these apps don't live there anymore. */}
          <Route path="me/opd/new" element={<OpdNewClaimPage />} />
          <Route path="me/opd/history" element={<OpdHistoryPage />} />
          <Route path="me/opd/approvals" element={<OpdApprovalsPage />} />
          <Route path="me/cc/new" element={<CcNewTransactionsPage />} />
          <Route path="me/cc/pending" element={<CcPendingPage />} />
          <Route path="me/cc/approve" element={<CcApprovePage />} />
          <Route path="me/cc/history" element={<CcHistoryPage />} />
          <Route path="me/cc/settings" element={<CcSettingsPage />} />
          <Route path="me/expense/new" element={<ExpenseNewClaimPage />} />
          <Route path="me/expense/history" element={<ExpenseHistoryPage />} />
          <Route path="me/expense/lead-approvals" element={<ExpenseLeadApprovalsPage />} />
          <Route path="me/expense/finance-approvals" element={<ExpenseFinanceApprovalsPage />} />
          <Route path="people-ops" element={<PeopleOpsPage />} />
          {/* Finance perspective — skeleton "coming soon" tile; the actual
              claim apps are the me/opd, me/cc, me/expense routes above. */}
          <Route path="finance" element={<FinancePage />} />
          {/* Workspace perspective — office-amenity apps split out of People
              Ops (starting with the cafeteria Menu app). */}
          <Route path="workspace" element={<WorkspacePage />} />
          {/* Marketing Ops perspective — overview + the Phase 1 Utilities
              screens, ported from the Marketing Ops frontend. The remaining
              operations (Ad Campaigns, Email Workbench, Events, CRM Upload)
              still live in Marketing Ops; the overview deep-links out to them
              until their phase lands. */}
          <Route path="marketing-ops" element={<MarketingOpsPage />} />
          {/* Email Workbench. The editor is transient state inside these pages, not
              a route of its own — see EmailWorkbenchPages. */}
          <Route
            path="marketing-ops/email-workbench/create"
            element={<EmailWorkbenchCreatePage />}
          />
          <Route
            path="marketing-ops/email-workbench/history"
            element={<EmailWorkbenchHistoryPage />}
          />
          <Route
            path="marketing-ops/email-workbench/manage"
            element={<EmailWorkbenchManagePage />}
          />
          <Route
            path="marketing-ops/email-workbench/blocks"
            element={<BlockCatalogPage />}
          />
          {/* Ad Campaigns → Analytics. Read-only reports computed on demand. */}
          <Route
            path="marketing-ops/ad-campaigns/analytics"
            element={<AdCampaignsAnalyticsPage />}
          />
          {/* Utilities — open to any authorized Marketing Ops caller. */}
          <Route path="marketing-ops/utilities/utm" element={<UtmGeneratorPage />} />
          <Route
            path="marketing-ops/utilities/asset-name"
            element={<AssetNameGeneratorPage />}
          />
          {/* Marketing Admin — each operation's configuration lands with the
              operation, so this grows one panel per phase. Admin-gated by the
              rail and by MarketingOpsShell; the backend enforces it too. */}
          <Route path="marketing-ops/admin/utm" element={<UtmSettingsPage />} />
          <Route
            path="marketing-ops/admin/asset-name"
            element={<AssetNameSettingsPage />}
          />
          <Route path="marketing-ops/admin/pardot" element={<EmailWorkbenchSettingsPage />} />
          <Route path="marketing-ops/admin/events" element={<EventsSettingsPage />} />
          <Route path="marketing-ops/events/mine" element={<EventsMinePage />} />
          <Route path="marketing-ops/events/review" element={<EventsReviewPage />} />
          <Route
            path="marketing-ops/crm-upload/pipelines"
            element={<CrmUploadPipelinesPage />}
          />
          <Route path="marketing-ops/crm-upload/runs" element={<CrmUploadRunLogPage />} />
          <Route path="marketing-ops/crm-upload/records" element={<CrmUploadRecordsPage />} />
          <Route path="marketing-ops/crm-upload/review" element={<CrmUploadReviewPage />} />
          <Route path="settings" element={<SettingsPage />} />
          {/* Workspace → Menu: the cafeteria screen ported from the standalone
              menu app. One page, as the original was. The functional spec and
              the deviation list live in docs/ported-apps/menu-app.md. */}
          <Route path="workspace/menu" element={<MenuHomePage />} />
          {/* Catch-all → landing */}
          <Route path="*" element={<Navigate to={landingPath()} replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
