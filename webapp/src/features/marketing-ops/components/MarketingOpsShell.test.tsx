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

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import MarketingOpsShell from "@features/marketing-ops/components/MarketingOpsShell";
import type { MarketingOpsGate } from "@features/marketing-ops/api/useMarketingOpsGate";

// The shell's whole job is a four-rung state ladder, and the locked rung now
// changes the HEADER as well as the body — the subtitle is suppressed there. That
// makes the shell hold the same condition twice: once as `isLocked` for the
// header, once as the last `if` in the body. These tests exist because those two
// can drift apart silently, and the failure mode is ugly: an authorized caller
// seeing a denial for one render while /api/me is still in flight.

const configured = vi.hoisted(() => ({ value: true }));
vi.mock("@config/apiConfig", () => ({
  isMarketingOpsBackendConfigured: () => configured.value,
}));

const gate = vi.hoisted(() => ({ value: {} as MarketingOpsGate }));
vi.mock("@features/marketing-ops/api/useMarketingOpsGate", () => ({
  useMarketingOpsGate: () => gate.value,
}));

const AUTHORIZED: MarketingOpsGate = {
  canSee: () => true,
  isAuthorized: true,
  isAdmin: false,
  isResolving: false,
  isError: false,
  retry: () => {},
};

const SUBTITLE = "Campaign operations, event lists and CRM ingestion.";

function renderShell(g: Partial<MarketingOpsGate> = {}) {
  gate.value = { ...AUTHORIZED, ...g };
  return render(
    <MemoryRouter>
      <MarketingOpsShell title="Marketing Ops" subtitle={SUBTITLE}>
        <div>the real page</div>
      </MarketingOpsShell>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  configured.value = true;
});

describe("MarketingOpsShell", () => {
  it("renders the page for an authorized caller", () => {
    renderShell();
    expect(screen.getByText("the real page")).toBeInTheDocument();
    expect(screen.getByText(SUBTITLE)).toBeInTheDocument();
    expect(screen.queryByText("You don't have access yet")).not.toBeInTheDocument();
  });

  it("locks the page when the caller is in no Marketing Ops group", () => {
    renderShell({ isAuthorized: false, canSee: () => false });
    expect(screen.getByText("You don't have access yet")).toBeInTheDocument();
    expect(screen.queryByText("the real page")).not.toBeInTheDocument();
  });

  it("drops the subtitle on the locked state only", () => {
    renderShell({ isAuthorized: false, canSee: () => false });
    // The title still says where you are; the subtitle would be selling a screen
    // that is about to refuse you.
    expect(screen.getByRole("heading", { name: "Marketing Ops" })).toBeInTheDocument();
    expect(screen.queryByText(SUBTITLE)).not.toBeInTheDocument();
  });

  it("names the operations so the reader can ask for the right group", () => {
    renderShell({ isAuthorized: false, canSee: () => false });
    for (const name of [
      "Email Workbench",
      "Ad Campaigns",
      "Events",
      "CRM Upload",
      "Utilities",
      "Marketing Admin",
    ]) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
  });

  it("offers a way out", () => {
    renderShell({ isAuthorized: false, canSee: () => false });
    expect(screen.getByRole("link", { name: /back to home/i })).toHaveAttribute("href", "/me");
  });

  // ---- the rungs that must NOT read as locked -----------------------------
  //
  // Each of these leaves the gate without capabilities, exactly like a denial
  // does, which is what makes them easy to collapse into one branch by accident.

  it("shows the spinner, not the lock, while the check is in flight", () => {
    renderShell({ isAuthorized: false, isResolving: true, canSee: () => false });
    expect(screen.getByText(/checking your marketing ops access/i)).toBeInTheDocument();
    expect(screen.queryByText("You don't have access yet")).not.toBeInTheDocument();
    // The header is untouched here — only the locked rung suppresses the subtitle.
    expect(screen.getByText(SUBTITLE)).toBeInTheDocument();
  });

  it("shows the retryable error, not the lock, when the check fails", () => {
    renderShell({
      isAuthorized: false,
      isError: true,
      errorMessage: "Gateway timed out.",
      canSee: () => false,
    });
    expect(screen.getByText(/couldn't check your marketing ops access/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    expect(screen.queryByText("You don't have access yet")).not.toBeInTheDocument();
    expect(screen.getByText(SUBTITLE)).toBeInTheDocument();
  });

  it("shows the config hint, not the lock, when the backend URL is unset", () => {
    configured.value = false;
    renderShell({ isAuthorized: false, canSee: () => false });
    expect(screen.getByText(/isn't connected yet/i)).toBeInTheDocument();
    expect(screen.queryByText("You don't have access yet")).not.toBeInTheDocument();
    expect(screen.getByText(SUBTITLE)).toBeInTheDocument();
  });

  // requireAuthorized={false} exists so a page can render for someone without
  // access. It must not be locked out.
  it("renders the page unlocked when the screen opts out of the check", () => {
    gate.value = { ...AUTHORIZED, isAuthorized: false, canSee: () => false };
    render(
      <MemoryRouter>
        <MarketingOpsShell title="Marketing Ops" subtitle={SUBTITLE} requireAuthorized={false}>
          <div>the real page</div>
        </MarketingOpsShell>
      </MemoryRouter>,
    );
    expect(screen.getByText("the real page")).toBeInTheDocument();
    expect(screen.queryByText("You don't have access yet")).not.toBeInTheDocument();
  });
});
