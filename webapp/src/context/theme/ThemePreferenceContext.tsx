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

import { OxygenUIThemeProvider } from "@wso2/oxygen-ui";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type JSX,
  type ReactNode,
} from "react";
import {
  THEME_OPTIONS,
  canonicalThemeKey,
  configThemeKey,
  isThemeKey,
  resolveTheme,
  type ThemeKey,
} from "@config/themeConfig";

/**
 * Namespaced like the app's other browser-stored keys (`one-wso2.pinned.v1`,
 * `one-wso2.sidebar.collapsed`) so everything this app writes is greppable.
 */
const STORAGE_KEY = "one-wso2.theme";

interface ThemePreferenceContextValue {
  /** The applied theme key. */
  themeKey: ThemeKey;
  /** Apply and persist a theme. */
  setThemeKey: (next: ThemeKey) => void;
  /** Keys and labels for the picker, in display order. */
  options: typeof THEME_OPTIONS;
}

const ThemePreferenceContext = createContext<ThemePreferenceContextValue | undefined>(
  undefined,
);

/**
 * A saved choice wins over the deployment default, so a user's pick survives a
 * reload. Validated on read rather than trusted: localStorage is user-editable,
 * and an unknown key must fall back rather than reach resolveTheme as garbage.
 */
function readInitialKey(): ThemeKey {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    // Canonicalised so a preference saved under an alias still ticks its row.
    if (isThemeKey(saved)) return canonicalThemeKey(saved);
  } catch {
    // Private-browsing modes and disabled storage both land here. The
    // deployment default is a fine answer.
  }
  return configThemeKey();
}

/**
 * Owns the theme at runtime.
 *
 * This replaces a module-level `resolveTheme(configThemeKey())` that was
 * evaluated once at import. A theme that can change has to live in React state,
 * or switching it would need a reload.
 *
 * Must sit above everything that reads the theme — including the picker in the
 * header, which has to re-render under the theme it just selected.
 *
 * Note this is orthogonal to the light/dark colour scheme, which Oxygen's own
 * `ColorSchemeToggle` owns and persists separately. This picks the palette; that
 * picks which of the palette's two schemes is showing. Both survive a reload,
 * independently.
 */
export function ThemePreferenceProvider({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  const [themeKey, setKey] = useState<ThemeKey>(readInitialKey);

  // resolveTheme already layers the accessibility overrides, so there is nothing
  // to compose here. Memoised so a re-render doesn't hand Oxygen a new theme
  // object and retrigger a full restyle.
  const theme = useMemo(() => resolveTheme(themeKey), [themeKey]);

  const setThemeKey = useCallback((next: ThemeKey) => {
    setKey(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // The choice still applies for this session; only persistence is lost.
    }
  }, []);

  const value = useMemo(
    () => ({ themeKey, setThemeKey, options: THEME_OPTIONS }),
    [themeKey, setThemeKey],
  );

  return (
    <ThemePreferenceContext.Provider value={value}>
      <OxygenUIThemeProvider theme={theme}>{children}</OxygenUIThemeProvider>
    </ThemePreferenceContext.Provider>
  );
}

export function useThemePreference(): ThemePreferenceContextValue {
  const ctx = useContext(ThemePreferenceContext);
  if (!ctx) {
    throw new Error("useThemePreference must be used within a ThemePreferenceProvider");
  }
  return ctx;
}
