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

import { useCallback, useEffect, useState } from "react";
import { useAsgardeo } from "@asgardeo/react";
import { refreshIdToken } from "@api/authBridge";

// Resolves the current Asgardeo user's `sub` claim. Used as an identity
// discriminator in downstream query keys so a sign-out → different-user
// sign-in in the same tab can't briefly serve the previous user's cached
// data.
//
// We can't use useAsgardeo().user for this — that field is only populated
// when `preferences.user.fetchUserProfile` is true (we disable it) or on
// the AsgardeoV2 platform (our tenant isn't). Decoding the id_token via
// the SDK is the one path that always works.
//
// Returns a three-state value so a caller can distinguish loading
// (`{status: "loading"}`), success (`{status: "ready", sub}`), and
// terminal failure (`{status: "error", message}`). Callers surface the
// error state in the UI instead of leaving downstream queries silently
// disabled with an undefined key.
//
// Single-source-of-truth by design: every hook that needs the user's
// `sub` (useMeProfile, useUserInfo, and others) consumes this hook, so
// the resolved `sub` is byte-identical across every consumer within a
// render tree.
export type SubState =
  | { status: "loading" }
  | { status: "ready"; sub: string }
  | { status: "error"; message: string };

export function useAsgardeoSub(): { state: SubState; retry: () => void } {
  const { isSignedIn, getDecodedIdToken } = useAsgardeo();
  const [state, setState] = useState<SubState>({ status: "loading" });
  // A tick counter drives the identity-resolution effect: bumping it
  // re-runs getDecodedIdToken() so a user-visible "Retry" can recover
  // from a decode error without having to sign out and back in.
  const [retryTick, setRetryTick] = useState(0);
  const retry = useCallback(() => setRetryTick((n) => n + 1), []);

  useEffect(() => {
    if (!isSignedIn) {
      setState({ status: "loading" });
      return;
    }
    let cancelled = false;
    setState({ status: "loading" });
    getDecodedIdToken()
      .then((token) => {
        if (cancelled) return;
        const s = (token as { sub?: string } | null | undefined)?.sub;
        if (typeof s === "string" && s.length > 0) {
          setState({ status: "ready", sub: s });
        } else {
          setState({
            status: "error",
            message: "Signed in, but the identity token has no `sub` claim.",
          });
        }
      })
      .catch(async (e: unknown) => {
        if (cancelled) return;
        // getDecodedIdToken() rejects once the cached id_token has expired
        // (~15min in practice) — try one silent re-auth via the same
        // bridge @api/http uses for 401s, then retry the decode, instead
        // of leaving every sub-keyed query (useUserInfo, useLeaveUserInfo,
        // useLeaves, ...) silently disabled with no visible error.
        try {
          await refreshIdToken();
          const token = await getDecodedIdToken();
          if (cancelled) return;
          const s = (token as { sub?: string } | null | undefined)?.sub;
          if (typeof s === "string" && s.length > 0) {
            setState({ status: "ready", sub: s });
            return;
          }
        } catch {
          // Refresh or the retried decode also failed — fall through to
          // the terminal error state below, using the original error.
        }
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        setState({ status: "error", message: `Couldn't decode identity token: ${msg}` });
      });
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, getDecodedIdToken, retryTick]);

  return { state, retry };
}
