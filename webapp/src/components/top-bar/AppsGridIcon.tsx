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
 * The launcher trigger: nine filled rounded squares.
 *
 * Hand-authored rather than imported. Lucide's nearest options are LayoutGrid
 * (four cells, which reads as a dashboard or a layout switcher) and Grip, whose
 * nine dots are radius-1 circles under a 2px stroke and sit light in a 20px slot.
 * Neither is the three-by-three block people recognise as "all apps".
 *
 * Drawn on Lucide's own 24x24 grid and taking `size` the same way, so it drops
 * into an icon slot beside real Lucide icons without special-casing. Filled
 * rather than stroked, which also matches the filled app marks it opens.
 */
interface AppsGridIconProps {
  /** Matches the lucide-react prop of the same name. */
  size?: number;
}

const CELLS = [3.4, 9.7, 16.0];

/** Nine cells on a 24-unit grid, filled with the current text colour. */
export default function AppsGridIcon({ size = 24 }: AppsGridIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      {CELLS.map((y) =>
        CELLS.map((x) => (
          <rect key={`${x}-${y}`} x={x} y={y} width="4.6" height="4.6" rx="1.1" />
        )),
      )}
    </svg>
  );
}
