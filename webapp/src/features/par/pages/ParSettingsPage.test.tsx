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
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import ParSettingsPage from "./ParSettingsPage";

vi.mock("@asgardeo/react", () => ({
  useAsgardeo: () => ({ isSignedIn: true, signIn: vi.fn(), signOut: vi.fn() }),
}));
vi.mock("@hooks/useAsgardeoUser", () => ({
  useAsgardeoUser: () => ({ ready: true, email: "admin@wso2.com", initials: "AD" }),
}));
vi.mock("@hooks/useSecureSignOut", () => ({ useSecureSignOut: () => vi.fn() }));
vi.mock("../api/useParMe", () => ({
  isParBackendConfigured: () => true,
  useParMe: () => ({ data: { workEmail: "admin@wso2.com" } }),
}));
vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showSuccess: vi.fn(), showError: vi.fn(), showWarning: vi.fn() }),
}));

const state = vi.hoisted(() => ({
  isAdmin: true,
  config: undefined as unknown,
  saved: [] as unknown[],
}));

vi.mock("../api/useParGate", () => ({
  useParGate: () => ({
    canSee: () => state.isAdmin,
    isAdmin: state.isAdmin,
    isTeamLead: false,
    isResolving: false,
    isError: false,
    retry: vi.fn(),
  }),
}));
vi.mock("../api/useParAdmin", () => ({
  useGlobalConfigurations: () => ({
    isPending: false,
    isError: false,
    error: null,
    data: state.config,
  }),
  useSaveGlobalConfigurations: () => ({
    mutate: (payload: unknown) => state.saved.push(payload),
    isPending: false,
    isError: false,
    error: null,
  }),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <ParSettingsPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  state.isAdmin = true;
  state.saved = [];
  state.config = {
    employeeParQuestion: "<p>What did you deliver?</p>",
    threeSixtyReviewQuestion: "<p>How did they contribute?</p>",
    parRatings: ["Successful"],
    threeSixtyReviewRatings: ["Strong"],
  };
});

describe("the admin gate", () => {
  it("refuses a non-admin", () => {
    state.isAdmin = false;
    renderPage();
    expect(screen.getByText(/isn't yours to open/i)).toBeInTheDocument();
  });
});

describe("the defaults", () => {
  it("says plainly that they do not touch a running cycle", () => {
    // The single most important thing about this screen.
    renderPage();
    expect(screen.getByText(/never affects a cycle already running/i)).toBeInTheDocument();
  });

  it("seeds from what is stored", () => {
    renderPage();
    expect(screen.getByText("What did you deliver?")).toBeInTheDocument();
    expect(screen.getByText("Successful")).toBeInTheDocument();
  });

  it("saves what is on screen", async () => {
    renderPage();
    await userEvent.setup().click(screen.getByRole("button", { name: /save defaults/i }));
    expect(state.saved).toHaveLength(1);
  });
});

// The same four rules as the creation form's.
describe("what it will not save", () => {
  it("refuses an empty rating list", async () => {
    renderPage();
    const user = userEvent.setup();
    // Remove the only PAR rating, via the named delete affordance.
    await user.click(screen.getByLabelText("Remove Successful"));

    expect(screen.getByText(/at least one PAR rating is required/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save defaults/i })).toBeDisabled();
    expect(state.saved).toHaveLength(0);
  });

  it("refuses a blank question", () => {
    state.config = {
      employeeParQuestion: "",
      threeSixtyReviewQuestion: "<p>q</p>",
      parRatings: ["Successful"],
      threeSixtyReviewRatings: ["Strong"],
    };
    renderPage();
    expect(screen.getByText(/employee's question is required/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save defaults/i })).toBeDisabled();
  });
});

describe("adding a rating", () => {
  it("refuses a duplicate, whatever the case", async () => {
    renderPage();
    const user = userEvent.setup();
    const boxes = screen.getAllByRole("textbox", { name: /add a rating/i });
    await user.type(boxes[0], "successful");
    expect(screen.getByText(/already listed/i)).toBeInTheDocument();
  });
});
