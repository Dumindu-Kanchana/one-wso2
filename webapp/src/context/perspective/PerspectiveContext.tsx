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

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useLocation } from "react-router";
import {
  findPerspectiveByPath,
  findPerspectiveByKey,
  type PerspectiveDef,
} from "@constants/perspectives";

interface PerspectiveContextValue {
  active: PerspectiveDef;
}

const PerspectiveContext = createContext<PerspectiveContextValue | undefined>(
  undefined,
);

// Derive the "active" perspective from the current route so the rail /
// top-bar stay in sync without a duplicate state store.
//
// Not every route belongs to a perspective. `/settings` is top-level and owned
// by none of them (it is the only such route — every other path in App.tsx sits
// under one), and the fallback used to be People Ops. So opening Settings
// relabelled the rail "People Ops", swapped in its Reports and Master Data
// sections, offered an Overview row pointing at /people-ops, and switched off
// the finance gate, which is keyed on `active.key === "me"`. SideRail also
// navigates to `active.path` when the pathname differs, so it could bounce the
// user out of Settings altogether.
//
// Me is the right fallback: it is the cross-perspective home every user has,
// and the one landingConfig already defaults to. People Ops is a functional
// area not everyone can even open.
//
// Where the rail stays put: whoever sends the user to a route that owns no
// perspective passes the one they were in as navigation state. SideRail's
// Settings item does exactly that. It lives in the navigation rather than in a
// ref or an effect because both are closed here — a ref cannot be read during
// render, and mirroring the location into state is the cascading-render pattern
// the hooks lint rules forbid.
//
// A cold deep link to /settings carries no state, so it still lands on Me.
export function PerspectiveProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const fromPerspective = (location.state as { fromPerspective?: unknown } | null)
    ?.fromPerspective;
  const value = useMemo<PerspectiveContextValue>(
    () => ({
      active:
        findPerspectiveByPath(location.pathname) ??
        (typeof fromPerspective === "string"
          ? findPerspectiveByKey(fromPerspective)
          : undefined) ??
        findPerspectiveByKey("me")!,
    }),
    [location.pathname, fromPerspective],
  );
  return (
    <PerspectiveContext.Provider value={value}>
      {children}
    </PerspectiveContext.Provider>
  );
}

export function useActivePerspective(): PerspectiveDef {
  const ctx = useContext(PerspectiveContext);
  if (!ctx) {
    throw new Error(
      "useActivePerspective must be used inside <PerspectiveProvider>",
    );
  }
  return ctx.active;
}
