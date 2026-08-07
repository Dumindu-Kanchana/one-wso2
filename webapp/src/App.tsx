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
import PeopleOpsDashboardPage from "@features/people-ops/pages/PeopleOpsDashboardPage";
import MyProfilePage from "@features/my/pages/MyProfilePage";
import FinancePage from "@features/finance/pages/FinancePage";
import LeaveApplyPage from "@features/leave/pages/LeaveApplyPage";
import LeaveApprovePage from "@features/leave/pages/LeaveApprovePage";
import LeaveHistoryPage from "@features/leave/pages/LeaveHistoryPage";
import LeaveReportsPage from "@features/leave/pages/LeaveReportsPage";
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
          {/* Default landing = People → Me (everyone's own profile). */}
          <Route index element={<Navigate to="/people-ops/me" replace />} />
          <Route path="people-ops" element={<PeopleOpsPage />} />
          <Route path="people-ops/dashboard" element={<PeopleOpsDashboardPage />} />
          {/* People → Me: the profile page (formerly the "My" perspective). */}
          <Route path="people-ops/me" element={<MyProfilePage />} />
          {/* People Ops → Leave: native screens ported from leave-app. */}
          <Route path="people-ops/leave/apply" element={<LeaveApplyPage />} />
          <Route path="people-ops/leave/approve" element={<LeaveApprovePage />} />
          <Route path="people-ops/leave/history" element={<LeaveHistoryPage />} />
          <Route path="people-ops/leave/reports" element={<LeaveReportsPage />} />
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
          {/* Legacy /my bookmarks → the new Me location. */}
          <Route path="my" element={<Navigate to="/people-ops/me" replace />} />
          {/* Catch-all → landing */}
          <Route path="*" element={<Navigate to="/people-ops/me" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
