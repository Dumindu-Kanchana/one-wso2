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

// One-WSO2 theme. Starts from AcrylicOrangeTheme (Oxygen-UI) so we inherit
// component defaults and dark-mode wiring, then overlays the palette we
// used in the original prototype/index.html so the app feels less peachy
// and more grounded.
//
// What we change vs. AcrylicOrangeTheme:
//   - primary  #fa7b3f (hot peach)  →  #F14E23 (deeper WSO2 orange)
//   - paper    #ffffffe1 (acrylic)  →  #ffffff (solid white cards)
//   - divider  #00000012 (~7%)      →  #E7E7EA (visible card outlines)
//   - dark bg  #000000 (pure black) →  #0C0C0E (warm off-black)
//   - body background: kill the orange+purple radial-gradient wash.
//
// Everything else — typography, MuiButton radius, MuiPaper backdrop-filter,
// etc. — is inherited from AcrylicBase, so component code that references
// primary.main / primary.light / divider / background.paper keeps working.

import { AcrylicOrangeTheme, ClassicTheme, HighContrastTheme } from "@wso2/oxygen-ui";
import { extendTheme } from "@mui/material/styles";

const ORANGE_MAIN = "#F14E23";
const ORANGE_LIGHT_LIGHT_MODE = "#FDEDE8";
const ORANGE_LIGHT_DARK_MODE = "rgba(241,78,35,0.18)";
const ORANGE_DARK = "#B93816";

const OneWso2Theme = extendTheme(AcrylicOrangeTheme, {
  colorSchemes: {
    light: {
      palette: {
        primary: {
          main: ORANGE_MAIN,
          light: ORANGE_LIGHT_LIGHT_MODE,
          dark: ORANGE_DARK,
          contrastText: "#FFFFFF",
        },
        background: {
          default: "#F7F7F8",
          paper: "#FFFFFF",
          acrylic: "#FFFFFF",
        },
        text: {
          primary: "#0A0A0B",
          secondary: "#5B5B61",
        },
        divider: "#E7E7EA",
      },
    },
    dark: {
      palette: {
        primary: {
          main: ORANGE_MAIN,
          light: ORANGE_LIGHT_DARK_MODE,
          dark: ORANGE_DARK,
          contrastText: "#FFFFFF",
        },
        background: {
          default: "#0C0C0E",
          paper: "#141417",
          acrylic: "#141417",
        },
        text: {
          primary: "#F4F4F5",
          secondary: "#9A9AA0",
        },
        divider: "#26262B",
      },
    },
  },
  components: {
    // AcrylicOrangeTheme paints two radial oranges + a radial purple across
    // the whole body — that's the "acrylic halo" we don't want. Replace it
    // with a flat canvas color that matches background.default.
    MuiCssBaseline: {
      styleOverrides: {
        "html[data-color-scheme='light'] body": {
          backgroundAttachment: "initial",
          backgroundImage: "none",
          backgroundColor: "var(--oxygen-palette-background-default)",
        },
        "html[data-color-scheme='dark'] body": {
          backgroundAttachment: "initial",
          backgroundImage: "none",
          backgroundColor: "var(--oxygen-palette-background-default)",
        },
      },
    },
    // AcrylicBase gives every Paper a translucent acrylic fill and a light
    // backdrop-filter blur. That's what makes cards look washed out on our
    // flat neutral canvas. Force solid paper + no blur here.
    //
    // NOTE — the palette value here MUST be a CSS variable, not
    // theme.palette.background.paper. Under CssVarsProvider / extendTheme
    // the plain palette accessor returns the LIGHT scheme's literal hex
    // (frozen at theme-construction time), so cards would render white
    // even under `data-color-scheme='dark'`. Referencing the CSS var
    // directly (or via theme.vars.palette.*) makes the styleOverride
    // reactive to the color-scheme switch on <html>.
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: "var(--oxygen-palette-background-paper)",
          backdropFilter: "none",
          WebkitBackdropFilter: "none",
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: "var(--oxygen-palette-background-paper)",
          backdropFilter: "none",
          WebkitBackdropFilter: "none",
        },
      },
    },
    // Same reason — text fields shouldn't pick up the acrylic tint on top
    // of a solid card.
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: "var(--oxygen-palette-background-paper)",
        },
      },
    },
  },
});

const THEMES = {
  acrylicOrange: OneWso2Theme,
  oneWso2: OneWso2Theme,
  classic: ClassicTheme,
  highContrast: HighContrastTheme,
} as const;

type ThemeName = keyof typeof THEMES;

function resolveThemeName(): ThemeName {
  const configured = window.config?.ONE_WSO2_THEME as ThemeName | undefined;
  return configured && configured in THEMES ? configured : "oneWso2";
}

export const themeConfig = THEMES[resolveThemeName()];
