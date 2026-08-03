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

// Registry of the digiops-finance apps and their top-level menu items,
// surfaced inside the One WSO2 Finance perspective. Every item is now a
// native route (built under src/features/finance/*), so each carries a
// `path` — the left rail navigates straight to it and the Finance overview
// links to it (same as People Ops → Leave).
//
// Transcribed from each app's own webapp nav (routes.tsx / route.ts /
// Sidebar). Finance app roles (USER / EMPLOYEE / LEAD / FINANCE) map onto
// One WSO2 capabilities as: USER/EMPLOYEE/all → everyone, LEAD → lead,
// FINANCE → admin (One WSO2 has no dedicated Finance privilege number).
// Each app's own backend still enforces its real role scheme; these
// capability gates just decide what shows in the rail.

import type { MenuApp } from "@constants/appMenu";

export const FINANCE_APPS: readonly MenuApp[] = [
  {
    key: "opd",
    name: "OPD Claims",
    emoji: "🏥",
    purpose: "Outpatient (OPD) medical expense claims — submit and track reimbursements.",
    items: [
      { id: "opd-new", label: "New Claim", desc: "Submit an OPD medical expense claim.", path: "/finance/opd/new" },
      { id: "opd-history", label: "Claim History", desc: "Your submitted OPD claims and their status.", path: "/finance/opd/history" },
      { id: "opd-approvals", label: "Approvals", desc: "Finance review and approval of OPD claims.", requires: ["admin"], path: "/finance/opd/approvals" },
    ],
  },
  {
    key: "cc",
    name: "Credit Card Expenses",
    emoji: "💳",
    purpose: "Reconcile and submit corporate credit-card transactions for approval.",
    items: [
      { id: "cc-new", label: "New Transactions", desc: "Unsubmitted card transactions to categorise and submit.", path: "/finance/cc/new" },
      { id: "cc-pending", label: "Pending Submissions", desc: "Submissions awaiting approval.", path: "/finance/cc/pending" },
      { id: "cc-approve", label: "Approve Submissions", desc: "Review and approve your team's card submissions.", requires: ["lead", "admin"], path: "/finance/cc/approve" },
      { id: "cc-history", label: "History", desc: "Your past card submissions.", path: "/finance/cc/history" },
      { id: "cc-settings", label: "Statement ingestion", desc: "Upload and reconcile bank statements (finance).", requires: ["admin"], path: "/finance/cc/settings" },
    ],
  },
  {
    key: "expense",
    name: "Expense Claims",
    emoji: "🧾",
    purpose: "Submit and track out-of-pocket expense claims and reimbursements.",
    items: [
      { id: "expense-new", label: "New Claim", desc: "Submit an expense claim / reimbursement.", path: "/finance/expense/new" },
      { id: "expense-history", label: "Claim History", desc: "Your submitted expense claims and their status.", path: "/finance/expense/history" },
      { id: "expense-lead", label: "Lead Approvals", desc: "Approve your team's expense claims.", requires: ["lead"], path: "/finance/expense/lead-approvals" },
      { id: "expense-finance", label: "Finance Approvals", desc: "Finance review and approval of expense claims.", requires: ["admin"], path: "/finance/expense/finance-approvals" },
    ],
  },
];
