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

import { useAsgardeoSub } from "@hooks/useAsgardeoSub";

// Resolve the signed-in user's `sub` claim via the shared hook, so each
// finance backend's user-info / app-data cache is scoped per-user (no
// cross-user leak on an account switch in the same tab) and gets the same
// retry-after-silent-reauth resilience as every other sub-keyed query —
// see @hooks/useAsgardeoSub.
export function useUserSub(): string | undefined {
  const { state } = useAsgardeoSub();
  return state.status === "ready" ? state.sub : undefined;
}
