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

import { useEffect, useRef, useState } from "react";

export type DraftState = "idle" | "saving" | "saved" | "error";

// Debounced draft autosave. `signature` is a stable string derived from the
// current line items; whenever it changes (after the first "ready" snapshot)
// the hook waits `delay` ms then runs `run` — which the caller wires to
// POST or DELETE /claim-drafts depending on whether any items remain.
//
// The first snapshot taken once `ready` is skipped so seeding the list from
// an existing server draft doesn't immediately re-save an identical draft.
export function useDraftAutosave(
  signature: string,
  ready: boolean,
  run: () => Promise<void>,
  delay = 1000,
): DraftState {
  const [state, setState] = useState<DraftState>("idle");
  const baseline = useRef<string | null>(null);
  const runRef = useRef(run);
  runRef.current = run;

  useEffect(() => {
    if (!ready) return;
    // First value seen while ready = the hydrated/seeded state; don't save it.
    if (baseline.current === null) {
      baseline.current = signature;
      return;
    }
    if (signature === baseline.current) return;
    setState("saving");
    const timer = window.setTimeout(() => {
      runRef
        .current()
        .then(() => setState("saved"))
        .catch(() => setState("error"));
    }, delay);
    return () => window.clearTimeout(timer);
  }, [signature, ready, delay]);

  return state;
}
