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

// Theme selection. Mirrors csm-portal's themeConfig.ts shape: this file only
// picks between shipped Oxygen presets plus One WSO2's own brand theme, and
// applies the shared accessibility overlay. The brand layer itself (palette,
// typography, surfaces) lives in brandTheme.ts.

import { ClassicTheme, HighContrastTheme } from "@wso2/oxygen-ui";
import type { OxygenTheme } from "@wso2/oxygen-ui/styles/Themes/OxygenThemeBase";
import { OneWso2Theme } from "@config/brandTheme";
import { withA11yOverrides } from "@config/a11yThemeOverrides";

export const THEMES = {
  oneWso2: OneWso2Theme,
  // Back-compat: deployments already ship ONE_WSO2_THEME="acrylicOrange" in
  // public/config.js and expect the brand theme, not raw AcrylicOrange.
  acrylicOrange: OneWso2Theme,
  classic: ClassicTheme,
  highContrast: HighContrastTheme,
} satisfies Record<string, OxygenTheme>;

export type ThemeKey = keyof typeof THEMES;

export const DEFAULT_THEME_KEY: ThemeKey = "oneWso2";

export const THEME_OPTIONS: { key: ThemeKey; label: string }[] = [
  { key: "oneWso2", label: "One WSO2" },
  { key: "classic", label: "Classic" },
  { key: "highContrast", label: "High Contrast" },
];

export function isThemeKey(value: unknown): value is ThemeKey {
  return typeof value === "string" && value in THEMES;
}

/** The theme key configured for this deployment, falling back to the default. */
export function configThemeKey(): ThemeKey {
  const configured = window.config?.ONE_WSO2_THEME;
  return isThemeKey(configured) ? configured : DEFAULT_THEME_KEY;
}

/** Resolve a key to a ready-to-use theme, accessibility overlay included. */
export function resolveTheme(key: string | undefined): OxygenTheme {
  return withA11yOverrides(isThemeKey(key) ? THEMES[key] : THEMES[DEFAULT_THEME_KEY]);
}

// The theme this deployment renders with. Resolved once at module load — there
// is no runtime theme switcher yet; when one lands it should call resolveTheme()
// from a provider instead of reading this.
export const themeConfig = resolveTheme(configThemeKey());
