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

import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  ThemePreferenceProvider,
  useThemePreference,
} from "@context/theme/ThemePreferenceContext";

const STORAGE_KEY = "one-wso2.theme";

beforeEach(() => {
  localStorage.clear();
  delete (window as { config?: unknown }).config;
});

/** Minimal consumer: shows the applied key and can switch it. */
function Probe() {
  const { themeKey, setThemeKey, options } = useThemePreference();
  return (
    <div>
      <span data-testid="applied">{themeKey}</span>
      <span data-testid="count">{options.length}</span>
      <button type="button" onClick={() => setThemeKey("choreo")}>
        pick choreo
      </button>
    </div>
  );
}

const renderProbe = () =>
  render(
    <ThemePreferenceProvider>
      <Probe />
    </ThemePreferenceProvider>,
  );

describe("ThemePreferenceProvider", () => {
  it("exposes all five options to the picker", () => {
    renderProbe();
    expect(screen.getByTestId("count")).toHaveTextContent("5");
  });

  it("starts on the deployment default when nothing is saved", () => {
    (window as { config?: Record<string, unknown> }).config = {
      ONE_WSO2_THEME: "classic",
    };
    renderProbe();
    expect(screen.getByTestId("applied")).toHaveTextContent("classic");
  });

  it("prefers a saved choice over the deployment default", () => {
    localStorage.setItem(STORAGE_KEY, "highContrast");
    (window as { config?: Record<string, unknown> }).config = {
      ONE_WSO2_THEME: "classic",
    };
    renderProbe();
    expect(screen.getByTestId("applied")).toHaveTextContent("highContrast");
  });

  it("applies and persists a new choice", async () => {
    renderProbe();
    await userEvent.setup().click(screen.getByRole("button", { name: "pick choreo" }));
    expect(screen.getByTestId("applied")).toHaveTextContent("choreo");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("choreo");
  });

  it("ignores a saved value that is no longer a theme", () => {
    // localStorage is user-editable, and a theme key can be removed between
    // releases. Either way this must fall back, not hand garbage to the theme
    // resolver.
    localStorage.setItem(STORAGE_KEY, "retired-theme");
    renderProbe();
    expect(screen.getByTestId("applied")).toHaveTextContent("acrylicOrange");
  });

  it("folds a preference saved under the superseded key onto the listed one", () => {
    // Otherwise it resolves to the right theme but ticks no row in the menu.
    localStorage.setItem(STORAGE_KEY, "oneWso2");
    renderProbe();
    expect(screen.getByTestId("applied")).toHaveTextContent("acrylicOrange");
  });
});
