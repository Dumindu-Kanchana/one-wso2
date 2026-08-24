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

// Theme selection, and nothing else: this file picks between shipped Oxygen
// presets plus One WSO2's own brand theme, then applies the accessibility
// overlay. Keeping selection separate from definition is what stops a theme
// file accreting palette edits — the brand layer itself (palette, typography,
// surfaces) lives in brandTheme.ts.

import {
  AcrylicPurpleTheme,
  ChoreoTheme,
  ClassicTheme,
  HighContrastTheme,
} from "@wso2/oxygen-ui";
import type { OxygenTheme } from "@wso2/oxygen-ui/styles/Themes/OxygenThemeBase";
import { OneWso2Theme } from "@config/brandTheme";
import { withA11yOverrides } from "@config/a11yThemeOverrides";

export const THEMES = {
  // The brand theme IS Acrylic Orange with One WSO2's palette and solid surfaces
  // layered on (see brandTheme.ts, which extends AcrylicOrangeTheme), so it keeps
  // that name. Deployments already ship ONE_WSO2_THEME="acrylicOrange".
  acrylicOrange: OneWso2Theme,
  // Alias, resolvable but not offered — an earlier iteration persisted this key,
  // so saved preferences must keep working. canonicalThemeKey() folds it back.
  oneWso2: OneWso2Theme,
  acrylicPurple: AcrylicPurpleTheme,
  choreo: ChoreoTheme,
  classic: ClassicTheme,
  highContrast: HighContrastTheme,
} satisfies Record<string, OxygenTheme>;

export type ThemeKey = keyof typeof THEMES;

export const DEFAULT_THEME_KEY: ThemeKey = "acrylicOrange";

/**
 * What the picker offers, in display order. The brand theme leads because it is
 * the default; the rest are the shipped presets. Note this is deliberately a
 * subset of THEMES — `acrylicOrange` resolves but is not offered.
 */
export const THEME_OPTIONS: { key: ThemeKey; label: string }[] = [
  { key: "acrylicOrange", label: "Acrylic Orange" },
  { key: "acrylicPurple", label: "Acrylic Purple" },
  { key: "choreo", label: "Choreo" },
  { key: "classic", label: "Classic" },
  { key: "highContrast", label: "High Contrast" },
];

export function isThemeKey(value: unknown): value is ThemeKey {
  // `hasOwn` rather than `in`: `in` also matches inherited names such as
  // "toString", which would pass as a theme key and hand a function to
  // withA11yOverrides.
  return typeof value === "string" && Object.hasOwn(THEMES, value);
}

/**
 * Fold an alias onto the key the picker lists.
 *
 * Without this, a preference saved under the alias resolves to the right theme
 * but matches no menu row, so the picker opens with nothing ticked.
 */
export function canonicalThemeKey(key: ThemeKey): ThemeKey {
  return key === "oneWso2" ? "acrylicOrange" : key;
}

/** The theme key configured for this deployment, falling back to the default. */
export function configThemeKey(): ThemeKey {
  const configured = window.config?.ONE_WSO2_THEME;
  return isThemeKey(configured) ? canonicalThemeKey(configured) : DEFAULT_THEME_KEY;
}

/** Resolve a key to a ready-to-use theme, accessibility overlay included. */
export function resolveTheme(key: string | undefined): OxygenTheme {
  return withA11yOverrides(isThemeKey(key) ? THEMES[key] : THEMES[DEFAULT_THEME_KEY]);
}

// No module-level resolved theme any more: the theme is chosen at runtime and can
// change, so it belongs in React state. ThemePreferenceProvider owns it and calls
// resolveTheme() per key; configThemeKey() is the fallback when nothing is saved.
