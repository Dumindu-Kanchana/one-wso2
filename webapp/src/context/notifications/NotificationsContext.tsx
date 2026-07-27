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

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import NotificationBanner, { type NotificationSeverity } from "./NotificationBanner";

// Global success/error banner with a proper FIFO queue. Same shape as
// cs-tools/apps/customer-portal's SuccessBanner + ErrorBanner contexts,
// folded into one provider — but earlier revisions used a single-slot
// state that silently dropped an earlier notification when two calls
// landed in the same tick (e.g. a mutation onSuccess and a background
// query error). We now queue; the head renders until it auto-dismisses,
// then the next one takes over. Errors are prioritized: showError
// preempts an active success banner so a critical error can't be
// masked by a trivial success toast.

const AUTO_DISMISS_MS = 3500;

interface NotificationsContextValue {
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
}

interface Notification {
  severity: NotificationSeverity;
  message: string;
  // Monotonically increasing so React sees a fresh key when the same
  // message is enqueued twice — restarts the auto-dismiss timer visibly.
  key: number;
}

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<Notification[]>([]);

  const enqueue = useCallback(
    (severity: NotificationSeverity) => (message: string) => {
      setQueue((q) => {
        // Errors preempt an active success banner (but not an active
        // error — an error is worth reading in full before the next
        // one). Non-error notifications always append.
        if (severity === "error" && q.length > 0 && q[0].severity === "success") {
          return [
            { severity, message, key: nextKey() },
            ...q.slice(1),
          ];
        }
        return [...q, { severity, message, key: nextKey() }];
      });
    },
    [],
  );

  const showSuccess = useMemo(() => enqueue("success"), [enqueue]);
  const showError = useMemo(() => enqueue("error"), [enqueue]);

  // `expectedKey` prevents a stale close callback — a manual X-click on
  // an earlier banner racing an error preemption, or an auto-dismiss
  // timer that fired between the head rotating and its cleanup — from
  // silently shifting the queue and dropping the CURRENT head. Passing
  // no key falls back to the old "always shift" behaviour, which no
  // caller uses today but keeps the API forgiving.
  const dismiss = useCallback((expectedKey?: number) => {
    setQueue((q) =>
      expectedKey === undefined || q[0]?.key === expectedKey ? q.slice(1) : q,
    );
  }, []);

  const head = queue[0];

  useEffect(() => {
    if (!head) return;
    // Capture the head key at the moment we schedule the timer so a
    // preemption that changes the head between now and 3.5s later
    // doesn't pop the new head instead.
    const key = head.key;
    const t = setTimeout(() => dismiss(key), AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [head?.key, dismiss]);

  const value = useMemo(() => ({ showSuccess, showError }), [showSuccess, showError]);

  return (
    <NotificationsContext.Provider value={value}>
      {children}
      {head && (
        <NotificationBanner
          severity={head.severity}
          message={head.message}
          onClose={() => dismiss(head.key)}
        />
      )}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationsProvider");
  return ctx;
}

// Module-scoped counter so keys don't collide across enqueue closures.
let _keyCounter = 0;
function nextKey(): number {
  _keyCounter += 1;
  return _keyCounter;
}
