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
// surfaced inside the Me perspective — claims/expenses are something an
// employee submits and tracks for themself, same rationale as Leave. Every
// item is a native route (built under src/features/finance/*), so each
// carries a `path` — the left rail navigates straight to it.
//
// Transcribed from each app's own webapp nav (routes.tsx / route.ts /
// Sidebar). Finance app roles (USER / EMPLOYEE / LEAD / FINANCE) map onto
// One WSO2 capabilities as: USER/EMPLOYEE/all → everyone, LEAD → lead,
// FINANCE → admin (One WSO2 has no dedicated Finance privilege number).
// Each app's own backend still enforces its real role scheme; these
// capability gates just decide what shows in the rail.

import { CreditCardIcon, ReceiptTextIcon, StethoscopeIcon } from "@wso2/oxygen-ui-icons-react";
import type { MenuApp } from "@constants/appMenu";

export const FINANCE_APPS: readonly MenuApp[] = [
  {
    key: "opd",
    name: "OPD Claims",
    icon: StethoscopeIcon,
    purpose: "Outpatient (OPD) medical expense claims — submit and track reimbursements.",
    items: [
      { id: "opd-new", label: "New Claim", desc: "Submit an OPD medical expense claim.", path: "/me/opd/new" },
      { id: "opd-history", label: "Claim History", desc: "Your submitted OPD claims and their status.", path: "/me/opd/history" },
      { id: "opd-approvals", label: "Approvals", desc: "Finance review and approval of OPD claims.", requires: ["admin"], path: "/me/opd/approvals" },
    ],
  },
  {
    key: "cc",
    name: "Credit Card Expenses",
    icon: CreditCardIcon,
    purpose: "Reconcile and submit corporate credit-card transactions for approval.",
    items: [
      { id: "cc-dashboard", label: "Dashboard", desc: "Unsubmitted spend, how long it has been sitting, and what has been claimed.", path: "/me/cc/dashboard" },
      { id: "cc-new", label: "New Transactions", desc: "Unsubmitted card transactions to categorise and submit.", path: "/me/cc/new" },
      { id: "cc-pending", label: "Pending Submissions", desc: "Submissions awaiting approval.", path: "/me/cc/pending" },
      { id: "cc-approve", label: "Approve Submissions", desc: "Review and approve your team's submitted card transactions.", requires: ["lead", "admin"], path: "/me/cc/approve" },
      { id: "cc-history", label: "History", desc: "Your submitted past card transactions.", path: "/me/cc/history" },
      { id: "cc-settings", label: "Statement ingestion", desc: "Upload and reconcile bank statements (finance).", requires: ["admin"], path: "/me/cc/settings" },
    ],
  },
  {
    key: "expense",
    name: "Expense Claims",
    icon: ReceiptTextIcon,
    purpose: "Submit and track out-of-pocket expense claims and reimbursements.",
    items: [
      { id: "expense-new", label: "New Claim", desc: "Submit an expense claim / reimbursement.", path: "/me/expense/new" },
      { id: "expense-history", label: "Claim History", desc: "Your submitted expense claims and their status.", path: "/me/expense/history" },
      { id: "expense-lead", label: "Lead Approvals", desc: "Approve your team's expense claims.", requires: ["lead"], path: "/me/expense/lead-approvals" },
      { id: "expense-finance", label: "Finance Approvals", desc: "Finance review and approval of expense claims.", requires: ["admin"], path: "/me/expense/finance-approvals" },
    ],
  },
];

// Every item id across the three apps — lets the rail dispatch gating to
// useFinanceGate (each app's OWN backend roles) instead of the coarse
// people-app capabilities, regardless of which perspective section it's
// rendered under.
export const FINANCE_ITEM_IDS: ReadonlySet<string> = new Set(
  FINANCE_APPS.flatMap((app) => app.items.map((it) => it.id)),
);

// Eyebrow descriptors for FinanceShell, derived from the registry above so the
// chip on every finance screen can't drift from the app's own name and icon.
function eyebrowFor(key: string): { icon: MenuApp["icon"]; label: string } {
  const app = FINANCE_APPS.find((a) => a.key === key)!;
  return { icon: app.icon, label: app.name };
}

export const FINANCE_EYEBROW = {
  opd: eyebrowFor("opd"),
  cc: eyebrowFor("cc"),
  expense: eyebrowFor("expense"),
} as const;
