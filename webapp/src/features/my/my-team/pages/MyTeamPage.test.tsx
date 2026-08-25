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


import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import MyTeamPage from "./MyTeamPage";
import type { OrgReference } from "../../api/orgTypes";
import type { OrgSelection } from "../../api/useOrgReference";

// Only the filter plumbing is under test, so the chrome and the table stand
// aside. What matters is which selection reaches useOrgReference, because that
// is what narrows the dependent option lists.
vi.mock("@components/perspective-header/PerspectiveHeader", () => ({ default: () => null }));
vi.mock("../components/MyTeamTable", () => ({ default: () => null }));

const LEAD_PRIVILEGE = 993;
vi.mock("@api/useUserInfo", () => ({
  useUserInfo: () => ({
    data: { privileges: [LEAD_PRIVILEGE] },
    isLoading: false,
    isError: false,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock("../api/useTeamSearch", () => ({
  useTeamSearch: () => ({
    data: { employees: [], totalCount: 0 },
    isLoading: false,
    isError: false,
    error: null,
  }),
}));

const reference: OrgReference = {
  businessUnits: [
    { id: 1, label: "Engineering" },
    { id: 2, label: "Sales" },
  ],
  teams: [
    { id: 10, label: "Platform" },
    { id: 11, label: "Integration" },
  ],
  subTeams: [],
  units: [],
  careerFunctions: [],
  designations: [],
  companies: [],
  offices: [],
  employmentTypes: [],
  managers: [{ email: "lead@wso2.com" }],
  isLoading: false,
  isError: false,
};

const useOrgReferenceSpy = vi.fn();
vi.mock("../../api/useOrgReference", () => ({
  useOrgReference: (selection: OrgSelection, enabled: boolean) => {
    useOrgReferenceSpy(selection, enabled);
    return reference;
  },
}));

/** The selection most recently handed to useOrgReference. */
function currentSelection(): OrgSelection {
  const calls = useOrgReferenceSpy.mock.calls;
  return calls[calls.length - 1][0] as OrgSelection;
}

async function choose(user: ReturnType<typeof userEvent.setup>, field: string, option: string) {
  await user.click(screen.getByRole("combobox", { name: field }));
  await user.click(await screen.findByRole("option", { name: option }));
}

function renderPage() {
  return render(
    <MemoryRouter>
      <MyTeamPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useOrgReferenceSpy.mockClear();
});

// The dialog reports every edit upward so the dependent lists narrow as you go.
// That handoff is what makes Cancel the parent's problem: the draft is thrown
// away inside the dialog, but the narrowing it caused lives out here.
describe("cancelling the filter dialog", () => {
  it("narrows the option lists while editing", async () => {
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Filters" }));
    await choose(user, "Business Unit", "Engineering");

    expect(currentSelection().businessUnitId).toBe(1);
  });

  it("undoes that narrowing when the dialog is cancelled", async () => {
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Filters" }));
    await choose(user, "Business Unit", "Engineering");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    // Previously this stayed at 1: reopening then showed an empty Business Unit
    // beside a Team list still restricted to it — "Nothing under the selected
    // Business Unit" with nothing selected, and no way to widen it again.
    expect(currentSelection().businessUnitId).toBeNull();
  });

  it("keeps the narrowing when the dialog is applied", async () => {
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Filters" }));
    await choose(user, "Business Unit", "Engineering");
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(currentSelection().businessUnitId).toBe(1);
  });

  it("undoes a Clear all that was then cancelled", async () => {
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Filters" }));
    await choose(user, "Business Unit", "Engineering");
    await user.click(screen.getByRole("button", { name: "Apply" }));
    expect(currentSelection().businessUnitId).toBe(1);

    // The mirror case: Clear all resets the draft and reports it up, so
    // cancelling has to restore what is still applied.
    await user.click(screen.getByRole("button", { name: "Filters" }));
    await user.click(screen.getByRole("button", { name: "Clear all" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(currentSelection().businessUnitId).toBe(1);
  });
});

// The search box commits 300ms after the last keystroke. A `key={filterKey}` on
// the dialog — with filterKey carrying that committed text — turned the commit
// into a remount, which reseeded the draft from `applied` and discarded whatever
// had been selected in the meantime.
describe("the search debounce firing while the dialog is open", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  // fireEvent rather than userEvent here: userEvent's async waiting deadlocks
  // against fake timers, and the whole point of this test is to control exactly
  // when the debounce commits relative to the edit.
  it("leaves an in-progress filter edit alone", async () => {
    renderPage();

    // Type, then open the dialog before the debounce has committed.
    fireEvent.change(screen.getByLabelText("Search your team"), { target: { value: "ann" } });
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));

    const field = screen.getByRole("combobox", { name: "Business Unit" });
    fireEvent.click(within(field.closest(".MuiAutocomplete-root") as HTMLElement).getByRole(
      "button",
      { name: "Open" },
    ));
    fireEvent.click(screen.getByRole("option", { name: "Engineering" }));
    expect(field).toHaveValue("Engineering");

    // The commit lands while the dialog is open. Previously this changed
    // `filterKey`, remounted the dialog, and reseeded the draft from `applied`.
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.getByRole("combobox", { name: "Business Unit" })).toHaveValue("Engineering");
    expect(currentSelection().businessUnitId).toBe(1);
  });
});

describe("the search field", () => {
  it("has a label that survives being filled in", () => {
    // A placeholder disappears once anything is typed, so it cannot be the only
    // accessible name. getByLabelText does not match placeholders, which is what
    // makes this assertion mean something.
    renderPage();
    const field = screen.getByLabelText("Search your team");
    // And it has to name the control, not its wrapper: a bare `aria-label` on
    // OutlinedInput lands on the surrounding div, which satisfies
    // getByLabelText while naming nothing a user can type into.
    expect(field.tagName).toBe("INPUT");
  });
});

