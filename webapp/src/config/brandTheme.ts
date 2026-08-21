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

// The One WSO2 brand layer over Oxygen's AcrylicOrangeTheme: palette, type
// discipline, selected-state tint, and surface treatment. Split out of
// themeConfig.ts (which is now just a preset picker, mirroring csm-portal) so
// there is exactly one place to look for "what do we change about the shipped
// theme, and why".
//
// PALETTE — kept deliberately, not inherited. Measured against white:
//   primary.main       #F14E23  3.59:1   (AcrylicOrange's #fa7b3f is 2.63:1)
//   primary.dark       #B93816  5.77:1   (AcrylicOrange derives ~#af562c, 5.01:1)
//   text.secondary     #5B5B61  6.74:1   a genuinely distinct tone; csm-portal
//                                        sets text.secondary === text.primary in
//                                        light mode, so it reads as no hierarchy
//   divider            #E7E7EA           visible card outlines vs AcrylicOrange's
//                                        #00000012 (~7%), which is near-invisible
// Neither orange clears 4.5:1, so primary is never a fill behind small text —
// see a11yThemeOverrides.ts, which shifts text/border primary to primary.dark.

import { AcrylicOrangeTheme } from "@wso2/oxygen-ui";
import { extendTheme } from "@mui/material/styles";

/**
 * Surface treatment — two independent axes, because the interesting combination
 * is one of each rather than an all-or-nothing "acrylic" switch.
 *
 * - `solidCards`: opaque `Paper`/`Card`/inputs (One WSO2), or Oxygen's
 *   translucent acrylic paper with a backdrop blur (csm-portal).
 * - `canvas`: what the `<body>` behind them looks like.
 *     `"flat"`   a single colour, the original One WSO2 look
 *     `"brand"`  two soft One WSO2 orange pools
 *     `"oxygen"` AcrylicOrange's own wash — orange + violet + a white vignette
 *
 * Current pick: solid cards on a brand wash. Solid cards keep text on a crisp
 * opaque surface (the reason the flat look was chosen originally), while the
 * wash gives the canvas some depth. `"oxygen"` is left reachable because it is
 * exactly what csm-portal renders, which makes A/B-ing the two apps easy.
 *
 * NOTE: a canvas wash is only visible if nothing paints over the body. The
 * content scroller in AppLayout.tsx deliberately sets no background for this
 * reason — see the comment there before adding one back.
 */
export const SURFACES = {
  solidCards: true,
  canvas: "brand" as "flat" | "brand" | "oxygen",
};

const ORANGE_MAIN = "#F14E23";
const ORANGE_LIGHT_LIGHT_MODE = "#FDEDE8";
const ORANGE_LIGHT_DARK_MODE = "rgba(241,78,35,0.18)";
const ORANGE_DARK = "#B93816";

// AcrylicBase gives every Paper a translucent acrylic fill and a backdrop blur.
// On a flat neutral canvas that reads washed out, so we force opaque paper.
//
// NOTE — the palette values here MUST be CSS variables, not
// theme.palette.background.paper. Under CssVarsProvider / extendTheme the plain
// palette accessor returns the LIGHT scheme's literal hex (frozen at
// theme-construction time), so cards would render white even under
// `data-color-scheme='dark'`. Referencing the CSS var directly keeps the
// styleOverride reactive to the color-scheme switch on <html>.
const flatSurface = {
  backgroundColor: "var(--oxygen-palette-background-paper)",
  backdropFilter: "none",
  WebkitBackdropFilter: "none",
} as const;

const solidCardOverrides = {
  MuiPaper: { styleOverrides: { root: flatSurface } },
  MuiCard: { styleOverrides: { root: flatSurface } },
  // Text fields shouldn't pick up the acrylic tint on top of a solid card.
  MuiOutlinedInput: {
    styleOverrides: {
      root: { backgroundColor: "var(--oxygen-palette-background-paper)" },
    },
  },
};

// ---- canvas treatments -----------------------------------------------------
// Each is a full `body` rule, since it has to override AcrylicOrange's own
// background-image rather than merge with it.

const flatCanvas = {
  backgroundAttachment: "initial",
  backgroundImage: "none",
  backgroundColor: "var(--oxygen-palette-background-default)",
} as const;

// Two soft pools of the brand orange. Deliberately not a copy of Oxygen's wash:
// that one includes a violet at 15%/50% (`rgba(74,41,165,0.1)`) which belongs to
// AcrylicPurple's palette and reads as a different product's accent on an
// orange-branded app. Alphas stay at or below ~0.10 in light / ~0.17 in dark —
// past roughly 12% the radials start to band visibly on wide displays.
const brandCanvasLight = {
  backgroundAttachment: "fixed",
  backgroundColor: "var(--oxygen-palette-background-default)",
  backgroundImage: [
    "radial-gradient(circle at 68% 22%, rgba(241,78,35,0.10) 0%, rgba(241,78,35,0) 46%)",
    "radial-gradient(circle at 12% 64%, rgba(241,78,35,0.05) 0%, rgba(241,78,35,0) 42%)",
  ].join(","),
} as const;

const brandCanvasDark = {
  backgroundAttachment: "fixed",
  backgroundColor: "var(--oxygen-palette-background-default)",
  backgroundImage: [
    "radial-gradient(circle at 68% 22%, rgba(241,78,35,0.17) 0%, rgba(241,78,35,0) 52%)",
    "radial-gradient(circle at 12% 64%, rgba(241,78,35,0.09) 0%, rgba(241,78,35,0) 46%)",
  ].join(","),
} as const;

function canvasOverrides() {
  // "oxygen" = inherit AcrylicOrange's own MuiCssBaseline rule untouched.
  if (SURFACES.canvas === "oxygen") return {};
  const light = SURFACES.canvas === "flat" ? flatCanvas : brandCanvasLight;
  const dark = SURFACES.canvas === "flat" ? flatCanvas : brandCanvasDark;
  return {
    MuiCssBaseline: {
      styleOverrides: {
        "html[data-color-scheme='light'] body": light,
        "html[data-color-scheme='dark'] body": dark,
      },
    },
  };
}

// Selected/hover wash, tinted to the brand orange.
//
// Oxygen's Sidebar paints its selected row with `action.selected`, and
// AcrylicOrange doesn't override it — so it inherits MUI's neutral grey
// (`rgba(0,0,0,0.08)`). Tinting this token is a first-class customisation, not a
// workaround: four of the nine shipped Oxygen themes do exactly the same thing
// toward their own primary (AcrylicPurple, Choreo, PaleGray, PaleIndigo).
//
// It's a background wash under text that stays `text.primary`, so it costs no
// contrast — unlike colouring the label itself, which is why the old rail's
// `color: primary.main` on active rows failed AA at 13.5px.
const selectionLight = {
  selected: "rgba(241,78,35,0.10)",
  selectedOpacity: 0.1,
  hover: "rgba(241,78,35,0.05)",
  hoverOpacity: 0.05,
} as const;

const selectionDark = {
  selected: "rgba(241,78,35,0.22)",
  selectedOpacity: 0.22,
  hover: "rgba(241,78,35,0.10)",
  hoverOpacity: 0.1,
} as const;

export const OneWso2Theme = extendTheme(AcrylicOrangeTheme, {
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
        action: selectionLight,
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
        action: selectionDark,
      },
    },
  },

  // TYPE DISCIPLINE — this app previously had no `typography` block at all, so
  // every size and weight lived as a per-component `sx` literal (159 hardcoded
  // fontWeights on a 500/600/700 ladder, with no 400 anywhere). Oxygen already
  // supplies fontFamily, fontWeightRegular: 400, and the h1-h6 / body / caption
  // scale — including h5 at 16px/400 for page titles and body2 at 13px/400 — so
  // only the genuinely missing tokens are set here. Components should use these
  // variants instead of re-declaring type in `sx`.
  typography: {
    // MUI defaults `fontWeightBold` to 700. Capping it at 600 means `fontWeight:
    // "bold"` and Typography's bold variants land on the same emphasis step the
    // Oxygen sidebar uses for its selected item, instead of a heavier one.
    fontWeightMedium: 500,
    fontWeightBold: 600,
    // Oxygen leaves `overline` at the MUI default (12px/400). Make it the single
    // home for the uppercase eyebrow label, so pages stop hand-rolling
    // `fontSize: 11, fontWeight: 700, textTransform: "uppercase"` in `sx`.
    overline: {
      fontSize: "0.6875rem", // 11px
      fontWeight: 600,
      lineHeight: 1.6,
      letterSpacing: "0.06em",
      textTransform: "uppercase" as const,
    },
  },

  components: {
    ...canvasOverrides(),
    ...(SURFACES.solidCards ? solidCardOverrides : {}),
  },
});
