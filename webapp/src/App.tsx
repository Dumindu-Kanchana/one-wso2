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
import AuthGuard from "@layouts/AuthGuard";
import AppLayout from "@layouts/AppLayout";
import PeopleOpsPage from "@features/people-ops/pages/PeopleOpsPage";
import MyProfilePage from "@features/my/pages/MyProfilePage";
import FinancePage from "@features/finance/pages/FinancePage";
import MarketingOpsPage from "@features/marketing-ops/pages/MarketingOpsPage";
import UtmGeneratorPage from "@features/marketing-ops/utilities/pages/UtmGeneratorPage";
import AssetNameGeneratorPage from "@features/marketing-ops/utilities/pages/AssetNameGeneratorPage";
import UtmSettingsPage from "@features/marketing-ops/admin/pages/UtmSettingsPage";
import AssetNameSettingsPage from "@features/marketing-ops/admin/pages/AssetNameSettingsPage";
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
          {/* Default landing = the Me home (own profile + connected apps). */}
          <Route index element={<Navigate to="/me" replace />} />
          {/* Me home — the full profile page including Connected apps. */}
          <Route path="me" element={<MyProfilePage variant="home" />} />
          {/* Me → Leave: native screens ported from leave-app. Lives here
              (not People Ops) — it's something every employee does for
              themself, not an HR-team tool. */}
          <Route path="me/leave/apply" element={<LeaveApplyPage />} />
          <Route path="me/leave/history" element={<LeaveHistoryPage />} />
          <Route path="me/leave/reports" element={<LeaveReportsPage />} />
          {/* Sabbatical use cases (apply/approve/report) are on hold this
              iteration — placeholder links out to the Leave app instead. */}
          <Route path="me/leave/sabbatical" element={<LeaveSabbaticalComingSoonPage />} />
          <Route path="people-ops" element={<PeopleOpsPage />} />
          {/* People Ops → Me: the people-app profile sections only (no
              Connected apps — that lives on the Me home). */}
          <Route path="people-ops/me" element={<MyProfilePage variant="peopleOps" />} />
          {/* Finance perspective — overview + native screens ported from the
              three digiops-finance apps (opd-claims, cc-expenses,
              expense-claims). */}
          <Route path="finance" element={<FinancePage />} />
          {/* OPD claims */}
          <Route path="finance/opd/new" element={<OpdNewClaimPage />} />
          <Route path="finance/opd/history" element={<OpdHistoryPage />} />
          <Route path="finance/opd/approvals" element={<OpdApprovalsPage />} />
          {/* Credit-card expenses */}
          <Route path="finance/cc/new" element={<CcNewTransactionsPage />} />
          <Route path="finance/cc/pending" element={<CcPendingPage />} />
          <Route path="finance/cc/approve" element={<CcApprovePage />} />
          <Route path="finance/cc/history" element={<CcHistoryPage />} />
          <Route path="finance/cc/settings" element={<CcSettingsPage />} />
          {/* Expense claims */}
          <Route path="finance/expense/new" element={<ExpenseNewClaimPage />} />
          <Route path="finance/expense/history" element={<ExpenseHistoryPage />} />
          <Route path="finance/expense/lead-approvals" element={<ExpenseLeadApprovalsPage />} />
          <Route path="finance/expense/finance-approvals" element={<ExpenseFinanceApprovalsPage />} />
          {/* Marketing Ops perspective — overview + the Phase 1 Utilities
              screens, ported from the Marketing Ops frontend. The remaining
              operations (Ad Campaigns, Email Workbench, Events, CRM Upload)
              still live in Marketing Ops; the overview deep-links out to them
              until their phase lands. */}
          <Route path="marketing-ops" element={<MarketingOpsPage />} />
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
          {/* Legacy /my bookmarks → the Me home. */}
          <Route path="my" element={<Navigate to="/me" replace />} />
          {/* Catch-all → landing */}
          <Route path="*" element={<Navigate to="/me" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
