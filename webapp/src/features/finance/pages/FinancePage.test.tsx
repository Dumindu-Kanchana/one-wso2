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

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

const gate = { canApprove: false, isResolving: false };

vi.mock("../api/useFinanceGate", () => ({
  useFinanceGate: () => ({
    canSee: (id: string) => id === "claim-approval" && gate.canApprove,
    isResolving: gate.isResolving,
  }),
}));

const { default: FinancePage } = await import("./FinancePage");

beforeEach(() => {
  gate.canApprove = false;
  gate.isResolving = false;
});

const show = () =>
  render(
    <MemoryRouter>
      <FinancePage />
    </MemoryRouter>,
  );

// The perspective was empty and said so. It holds Claim approval now, and a
// banner promising something later is wrong twice over: the thing arrived, and
// it tells someone who cannot use it nothing about why.
describe("the Finance overview", () => {
  it("does not promise something coming later", () => {
    gate.canApprove = true;
    show();
    expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/being rebuilt/i)).not.toBeInTheDocument();
  });

  it("offers the approval queue to an approver", () => {
    gate.canApprove = true;
    show();
    const link = screen.getByRole("link", { name: /Claim approval/ });
    expect(link).toHaveAttribute("href", "/finance/claim-approval");
  });

  // A link to a screen that would turn them away is worse than no link.
  it("offers no link to someone who approves nothing", () => {
    show();
    expect(screen.queryByRole("link", { name: /Claim approval/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Nothing here for you yet/)).toBeInTheDocument();
  });

  it("says where their own claims are, since that is the likely reason they came", () => {
    show();
    expect(screen.getByText(/Your own claims are under\s+Me/)).toBeInTheDocument();
  });

  // A home for finance operations, with more coming. A subtitle naming today's
  // one screen would need rewriting the moment the second one lands, and the
  // sibling perspectives name their domain rather than their contents.
  it("describes the perspective, not the one thing in it today", () => {
    gate.canApprove = true;
    show();
    const subtitle = screen.getByText(/Operations and tools for company finances/);
    expect(subtitle).toBeInTheDocument();
    expect(subtitle.textContent).not.toMatch(/claim/i);
    expect(subtitle.textContent).not.toMatch(/approv/i);
  });

  it("waits for the backends rather than flashing the wrong answer", () => {
    gate.isResolving = true;
    show();
    expect(screen.queryByRole("link", { name: /Claim approval/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Nothing here for you yet/)).not.toBeInTheDocument();
  });
});
