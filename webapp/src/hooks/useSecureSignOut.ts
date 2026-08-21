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

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { SIGNING_OUT_EVENT } from "@constants/appEvents";

// Sign out AND purge client-held state. React Query keeps fetched profile /
// leave / finance data in memory; Asgardeo signOut() alone leaves it there
// until a reload, so on a shared or kiosk browser it stays recoverable
// (threat-model risk ONEWSO2-R1). Clear the cache BEFORE signOut, because
// signOut redirects away and code after it may not run. Asgardeo clears its
// own session/token storage as part of signOut.
export function useSecureSignOut(): () => void {
  const { signOut } = useAsgardeo();
  const qc = useQueryClient();
  return useCallback(() => {
    try {
      qc.clear();
    } catch {
      // best effort — never block sign-out on a cache-clear failure
    }
    try {
      window.dispatchEvent(new CustomEvent(SIGNING_OUT_EVENT));
    } catch {
      // best effort — a listener throwing must not strand the user signed in
    }
    void signOut();
  }, [qc, signOut]);
}
