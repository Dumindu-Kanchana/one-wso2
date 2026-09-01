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
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import type { ReactNode } from "react";

// Which tab is open lives in the URL. These cover the three things that buys —
// a linkable tab, a landing redirect, and gating that a typed URL cannot walk
// past — none of which the previous `useState` tabs could do.

const state = {
  isResolving: false,
  isLead: false,
  isPeopleOps: false,
  allow: new Set<string>(["leave-apply", "leave-history", "leave-reports"]),
};

vi.mock("../api/useLeaveGate", () => ({
  useLeaveGate: () => ({
    canSee: (id: string) => state.allow.has(id),
    isResolving: state.isResolving,
    isPeopleOps: state.isPeopleOps,
    isLead: state.isLead,
  }),
}));

vi.mock("../components/LeaveShell", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const { default: LeaveGroupPage, LeaveGroupIndex, LeaveTabRoute } = await import(
  "./LeaveGroupPage"
);

function Here() {
  const { pathname } = useLocation();
  return <div data-testid="path">{pathname}</div>;
}

/** Always mounted, so a redirect is visible even when the route renders nothing. */
function UrlProbe() {
  const { pathname } = useLocation();
  return <div data-testid="url">{pathname}</div>;
}

beforeEach(() => {
  state.isResolving = false;
  state.isLead = false;
  state.isPeopleOps = false;
  state.allow = new Set(["leave-apply", "leave-history", "leave-reports"]);
});

/** The General group, wired the way App.tsx wires it. */
function show(initial = "/me/leave/general") {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <UrlProbe />
      <Routes>
        <Route path="/me/leave/general" element={<LeaveGroupPage groupKey="general" />}>
          <Route index element={<LeaveGroupIndex groupKey="general" />} />
          <Route
            path="apply"
            element={
              <LeaveTabRoute groupKey="general" gateId="leave-apply">
                <Here />
              </LeaveTabRoute>
            }
          />
          <Route
            path="history"
            element={
              <LeaveTabRoute groupKey="general" gateId="leave-history">
                <Here />
              </LeaveTabRoute>
            }
          />
          <Route
            path="reports"
            element={
              <LeaveTabRoute groupKey="general" gateId="leave-reports">
                <Here />
              </LeaveTabRoute>
            }
          />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("landing on a group", () => {
  it("redirects to the first tab, so the group URL is never blank", async () => {
    show();
    expect(await screen.findByTestId("path")).toHaveTextContent("/me/leave/general/apply");
  });

  // A People-Ops-only account cannot apply for a sabbatical, and a hardcoded
  // redirect would drop them on a tab they are refused.
  it("lands on the first tab the visitor is actually allowed", async () => {
    state.allow = new Set(["leave-reports"]);
    show();
    expect(await screen.findByTestId("path")).toHaveTextContent("/me/leave/general/reports");
  });

});

// The sabbatical Approve tab is lead-only, and an unresolved gate reports no
// privileges.
// Deciding before /user-info lands would redirect a lead away from the URL they
// asked for — and a redirect is not undone when the answer arrives.
describe("while the gate is still resolving", () => {
  function showApprove(initial: string) {
    return render(
      <MemoryRouter initialEntries={[initial]}>
        <UrlProbe />
        <Routes>
          <Route path="/me/leave/sabbatical" element={<LeaveGroupPage groupKey="sabbatical" />}>
            <Route index element={<LeaveGroupIndex groupKey="sabbatical" />} />
            <Route
              path="approve"
              element={
                <LeaveTabRoute groupKey="sabbatical" gateId="leave-approve">
                  <Here />
                </LeaveTabRoute>
              }
            />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
  }

  it("leaves a deep-linked lead on the URL they asked for", async () => {
    state.isResolving = true;
    state.allow = new Set();
    showApprove("/me/leave/sabbatical/approve");

    // Still there: not redirected, and not told they are not allowed.
    expect(await screen.findByTestId("url")).toHaveTextContent(
      "/me/leave/sabbatical/approve",
    );
    expect(screen.queryByText(/isn't available for your role/)).not.toBeInTheDocument();
  });

  it("does not send anyone anywhere from the group URL either", async () => {
    state.isResolving = true;
    state.allow = new Set();
    showApprove("/me/leave/sabbatical");
    expect(await screen.findByTestId("url")).toHaveTextContent("/me/leave/sabbatical");
  });

  it("resolves into the tab once the privileges arrive", async () => {
    state.allow = new Set(["leave-approve"]);
    showApprove("/me/leave/sabbatical/approve");
    expect(await screen.findByTestId("path")).toHaveTextContent(
      "/me/leave/sabbatical/approve",
    );
  });
});

describe("the tab bar", () => {
  it("offers only the tabs the visitor may see", async () => {
    await waitFor(() => show());
    expect(await screen.findByRole("tab", { name: "Apply" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Reports" })).toBeInTheDocument();
  });

  it("leaves out a tab the gate refuses", async () => {
    state.allow = new Set(["leave-apply"]);
    show();
    await screen.findByRole("tab", { name: "Apply" });
    expect(screen.queryByRole("tab", { name: "Reports" })).not.toBeInTheDocument();
  });

  it("says so plainly when the visitor may see none of it", async () => {
    state.allow = new Set();
    show();
    expect(await screen.findByText(/isn't available for your role/)).toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });

  it("marks the tab the URL names, not the first one", async () => {
    show("/me/leave/general/reports");
    const tab = await screen.findByRole("tab", { name: "Reports" });
    expect(tab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Apply" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("changes the URL when a tab is clicked", async () => {
    show();
    await screen.findByRole("tab", { name: "Reports" });
    await userEvent.click(screen.getByRole("tab", { name: "Reports" }));
    await waitFor(() =>
      expect(screen.getByTestId("path")).toHaveTextContent("/me/leave/general/reports"),
    );
  });
});

// Hiding a tab is not access control. The URL can be typed, pasted from a chat,
// or bookmarked from a time when the person did hold the privilege.
describe("reaching a tab by its URL", () => {
  it("serves it to someone allowed", async () => {
    show("/me/leave/general/reports");
    expect(await screen.findByTestId("path")).toHaveTextContent("/me/leave/general/reports");
  });

  it("redirects away from one they are not", async () => {
    state.allow = new Set(["leave-apply"]);
    show("/me/leave/general/reports");
    expect(await screen.findByTestId("path")).toHaveTextContent("/me/leave/general/apply");
  });

  it("explains when there is nowhere to send them", async () => {
    state.allow = new Set();
    show("/me/leave/general/reports");
    expect(await screen.findByText(/isn't available for your role/)).toBeInTheDocument();
  });
});
