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

import { useMemo } from "react";
import { Alert, Skeleton, Typography } from "@wso2/oxygen-ui";
import { isCcBackendConfigured } from "@config/apiConfig";
import FinanceShell from "../../components/FinanceShell";
import { describeError } from "../../util/financeError";
import { CcTxnTable } from "../CcTxnTable";
import { useCcTransactions, useCcUserInfo } from "../useCc";
import { FINANCE_EYEBROW } from "@constants/financeApps";

export default function CcPendingPage() {
  return (
    <FinanceShell
      eyebrow={FINANCE_EYEBROW.cc}
      title="Pending submissions"
      subtitle="Your card transactions awaiting lead or finance approval."
      configured={isCcBackendConfigured()}
      configKey="ONE_WSO2_CC_EXPENSES_BACKEND_URL"
    >
      <PendingBody />
    </FinanceShell>
  );
}

function PendingBody() {
  const userInfo = useCcUserInfo();
  const txns = useCcTransactions();
  const email = userInfo.data?.workEmail;

  const rows = useMemo(
    () =>
      (txns.data ?? []).filter(
        (t) =>
          t.employeeEmail === email &&
          (t.status === "pending_lead" || t.status === "pending_finance"),
      ),
    [txns.data, email],
  );

  if (userInfo.isLoading || txns.isLoading) {
    return <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 1.5 }} />;
  }
  if (userInfo.isError || txns.isError) {
    return (
      <Alert severity="error">
        Couldn't load transactions. {describeError(userInfo.error ?? txns.error)}
      </Alert>
    );
  }
  if (rows.length === 0) {
    return (
      <Typography sx={{ fontSize: 13, color: "text.secondary", py: 3 }}>
        Nothing awaiting approval right now.
      </Typography>
    );
  }
  return <CcTxnTable txns={rows} showCard />;
}
