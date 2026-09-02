/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

/**
 * Filled, two-tone marks for the five perspectives, used ONLY by the app
 * launcher.
 *
 * Why these exist at all: Lucide ships no filled icons, so the launcher tile got
 * its visual mass from a coloured wash behind a line glyph. That made an app tile
 * and a rail row look like the same kind of thing. These marks give the launcher
 * its own vocabulary — filled and coloured for "this is an app", line icons
 * everywhere else for "this is somewhere to go". The rail is deliberately
 * untouched; the contrast between the two is the point.
 *
 * Drawn on a 48x48 grid because that is the tile's own size, so the marks are
 * authored at the size they are rendered rather than scaled up from 24.
 *
 * OPTICAL SIZING: the megaphone and the group are scaled about their centres.
 * Equal bounding boxes do not read as equal weight — measured at 64px, the
 * megaphone covered 20% of its box against 33-44% for the others and sat visibly
 * light in the row. The scale factors bring the set to 29-44%.
 *
 * A perspective with no mark here falls back to its line glyph on the hue wash
 * (see WaffleOverlay), so adding a perspective cannot break the launcher.
 */
import { appMarkTones } from "./appMarkTones";

export interface MarkProps {
  /** Rendered size in px. The tile uses 48; tests and stories may differ. */
  size?: number;
}

function Svg({ size = 48, children }: MarkProps & { children: React.ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/** Me — a house, keeping the metaphor the line icon already used. */
export function MeMark({ size }: MarkProps) {
  const t = appMarkTones("me")!;
  return (
    <Svg size={size}>
      <path d="M10 23h28v13.5a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4z" fill={t.field} />
      <path
        d="M21.9 6.6a3.2 3.2 0 0 1 4.2 0l17 14.6c1.6 1.4.6 4-1.5 4H6.4c-2.1 0-3.1-2.6-1.5-4z"
        fill={t.lead}
      />
      <path d="M20.5 40.5v-8a3.5 3.5 0 0 1 7 0v8z" fill={t.detail} />
    </Svg>
  );
}

/** People Ops — two figures, the nearer one carrying the hue. */
export function PeopleMark({ size }: MarkProps) {
  const t = appMarkTones("people")!;
  return (
    <Svg size={size}>
      <g transform="translate(24 24) scale(1.05) translate(-24 -24)">
        <circle cx="32.5" cy="16.5" r="5.5" fill={t.field} />
        <path
          d="M32.5 24c5.2 0 9.6 3.2 11 7.8.5 1.6-.7 3.2-2.4 3.2H24.5c-1.7 0-2.9-1.6-2.4-3.2 1.4-4.6 5.8-7.8 10.4-7.8z"
          fill={t.field}
        />
        <circle cx="18.5" cy="18.5" r="7.5" fill={t.lead} />
        <path
          d="M18.5 28c6.4 0 11.9 4 13.6 9.7.6 1.9-.9 3.8-2.9 3.8H7.8c-2 0-3.5-1.9-2.9-3.8C6.6 32 12.1 28 18.5 28z"
          fill={t.lead}
        />
      </g>
    </Svg>
  );
}

/** Finance — a wallet: body, flap, clasp. */
export function FinanceMark({ size }: MarkProps) {
  const t = appMarkTones("finance")!;
  return (
    <Svg size={size}>
      <rect x="5" y="12" width="38" height="27" rx="6" fill={t.field} />
      <path d="M28 20h15v11H28a5.5 5.5 0 0 1 0-11z" fill={t.lead} />
      <circle cx="32.6" cy="25.5" r="2.9" fill={t.detail} />
    </Svg>
  );
}

/** Marketing Ops — a megaphone with its sound arc. */
export function MarketingMark({ size }: MarkProps) {
  const t = appMarkTones("marketing")!;
  return (
    <Svg size={size}>
      <g transform="translate(24 24) scale(1.2) translate(-24 -24)">
        <path
          d="M12 19.5 30.5 11v26l-18.5-8.5a1 1 0 0 1-.6-.9v-6.2a1 1 0 0 1 .6-.9z"
          fill={t.lead}
        />
        <path d="M15 29.6l5.5 2.5V38a3 3 0 0 1-6 0z" fill={t.detail} />
        <path
          d="M35.5 17.2a1.9 1.9 0 0 1 2.7.4 12 12 0 0 1 0 12.8 1.9 1.9 0 1 1-3.1-2.2 8.2 8.2 0 0 0 0-8.4 1.9 1.9 0 0 1 .4-2.6z"
          fill={t.field}
        />
      </g>
    </Svg>
  );
}

/** CSM — a life buoy: ring plus four spokes. */
export function CsmMark({ size }: MarkProps) {
  const t = appMarkTones("csm")!;
  return (
    <Svg size={size}>
      <path
        fillRule="evenodd"
        d="M24 5.5A18.5 18.5 0 1 0 24 42.5 18.5 18.5 0 0 0 24 5.5zm0 10.5a8 8 0 1 1 0 16 8 8 0 0 1 0-16z"
        fill={t.field}
      />
      <g fill={t.lead}>
        <rect x="21.6" y="2.5" width="4.8" height="12" rx="2.4" />
        <rect x="21.6" y="33.5" width="4.8" height="12" rx="2.4" />
        <rect x="2.5" y="21.6" width="12" height="4.8" rx="2.4" />
        <rect x="33.5" y="21.6" width="12" height="4.8" rx="2.4" />
      </g>
    </Svg>
  );
}
