/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { useLeaves } from "../api/useLeaveData";
import SabbaticalHistoryTable from "./SabbaticalTable";

// The lead's own past decisions — ApproveHistoryTab.tsx:39-48. Approved and
// rejected only: a request still pending belongs on the Approve tab, and a
// cancelled one was never decided.
export default function SabbaticalApprovalHistoryTab() {
  const history = useLeaves({
    subordinatesLeaves: true,
    leaveCategory: ["sabbatical"],
    statuses: ["APPROVED", "REJECTED"],
    orderBy: "DESC",
  });

  return (
    <SabbaticalHistoryTable
      rows={history.data?.leaves ?? []}
      isLoading={history.isLoading}
      error={history.isError ? (history.error as Error) : null}
      emptyMessage="No sabbatical decisions yet."
    />
  );
}
