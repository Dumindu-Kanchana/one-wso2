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

import { FINANCE_APPS } from "@constants/financeApps";
import { useCcUserInfo } from "../cc/useCc";
import { ccHasAccess } from "../cc/ccTypes";
import { useOpdUserInfo } from "../opd/useOpd";
import { OPD_ROLE, opdHasRole } from "../opd/opdTypes";
import { useExpenseAppData } from "../expense/useExpense";

// Items that declare `requires` in the registry but aren't explicitly mapped
// below must fail CLOSED — otherwise a renamed or newly-added restricted item
// would silently become visible to everyone. Per-user items (no `requires`)
// stay open.
const RESTRICTED_IDS = new Set(
  FINANCE_APPS.flatMap((app) => app.items)
    .filter((it) => it.requires && it.requires.length > 0)
    .map((it) => it.id),
);

// Role-gates the Finance menu items against each app's OWN backend roles —
// not the coarse One WSO2 capabilities derived from people-app. The rail
// and the overview both use this so a menu item is only shown to someone
// who can actually use its page (e.g. cc "Approve Submissions" needs a
// cc-expenses lead/finance role, exactly like the page enforces).
//
// Only the restricted items are listed; anything not named here is a
// per-user view (New / Pending / History) and stays visible to everyone.
// `enabled` lets the caller avoid firing the finance /user-info calls when
// the Finance perspective isn't active (e.g. while on People Ops).
export interface FinanceGate {
  canSee: (itemId: string) => boolean;
  isResolving: boolean;
}

export function useFinanceGate(enabled = true): FinanceGate {
  const cc = useCcUserInfo(enabled);
  const opd = useOpdUserInfo(enabled);
  const expense = useExpenseAppData(enabled);

  const ccLeadOrFinance = ccHasAccess(cc.data, "lead") || ccHasAccess(cc.data, "finance");
  const ccFinance = ccHasAccess(cc.data, "finance");
  const opdFinance = opdHasRole(opd.data, OPD_ROLE.FINANCE_APPROVER);
  const expenseLead = Boolean(expense.data?.enableLeadView);
  const expenseFinance = Boolean(expense.data?.enableFinanceView);

  const canSee = (itemId: string): boolean => {
    switch (itemId) {
      case "cc-approve":
        return ccLeadOrFinance;
      case "cc-settings":
        return ccFinance;
      case "opd-approvals":
        return opdFinance;
      case "expense-lead":
        return expenseLead;
      case "expense-finance":
        return expenseFinance;
      default:
        // Per-user views (New / Pending / History) are open; any other item
        // that declares `requires` but reaches here fails closed rather than
        // leaking, so the menu can't drift ahead of the explicit mapping.
        return !RESTRICTED_IDS.has(itemId);
    }
  };

  const isResolving = enabled && (cc.isLoading || opd.isLoading || expense.isLoading);
  return { canSee, isResolving };
}
