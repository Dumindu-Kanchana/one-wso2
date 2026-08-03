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

import { useEffect, useState } from "react";
import { useAsgardeo } from "@asgardeo/react";

// Resolve the signed-in user's `sub` claim so each finance backend's
// user-info / app-data cache is scoped per-user (no cross-user leak on an
// account switch in the same tab). Decoding the id_token is the one path
// that always works — mirrors the inline pattern in @api/useUserInfo and
// the Leave feature.
export function useUserSub(): string | undefined {
  const { isSignedIn, getDecodedIdToken } = useAsgardeo();
  const [sub, setSub] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (!isSignedIn) {
      setSub(undefined);
      return;
    }
    let cancelled = false;
    getDecodedIdToken()
      .then((token) => {
        if (cancelled) return;
        const s = (token as { sub?: string } | null | undefined)?.sub;
        setSub(typeof s === "string" && s.length > 0 ? s : undefined);
      })
      .catch(() => {
        if (!cancelled) setSub(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, getDecodedIdToken]);
  return sub;
}
