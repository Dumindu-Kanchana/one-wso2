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

import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import AppsGridIcon from "./AppsGridIcon";

describe("apps grid icon", () => {
  /** Nine, not four. The whole point of replacing LayoutGrid. */
  it("draws a three-by-three grid", () => {
    const { container } = render(<AppsGridIcon />);
    const cells = container.querySelectorAll("rect");
    expect(cells).toHaveLength(9);
    expect(new Set([...cells].map((c) => c.getAttribute("x"))).size).toBe(3);
    expect(new Set([...cells].map((c) => c.getAttribute("y"))).size).toBe(3);
  });

  /** Filled, so it reads with the filled app marks it opens rather than the rail. */
  it("is filled rather than stroked", () => {
    const { container } = render(<AppsGridIcon />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("fill")).toBe("currentColor");
    expect(svg.getAttribute("stroke")).toBeNull();
  });

  /** Takes `size` the way lucide-react does, so it drops into an icon slot. */
  it("honours the size prop like the icons beside it", () => {
    const { container } = render(<AppsGridIcon size={20} />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("20");
    expect(svg.getAttribute("height")).toBe("20");
    expect(svg.getAttribute("viewBox")).toBe("0 0 24 24");
  });
});
