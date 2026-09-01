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
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import ClaimsPage, { ClaimsIndex } from "./ClaimsPage";

// Four menu entries became one screen with a tab each. What is new here is the
// Add claim button: there is no single form that could take both types, so the
// type is chosen before the form opens.

function Where({ what }: { what: string }) {
  const { pathname } = useLocation();
  return <div data-testid={what}>{pathname}</div>;
}

function UrlProbe() {
  const { pathname } = useLocation();
  return <div data-testid="url">{pathname}</div>;
}

function show(initial = "/me/claims") {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <UrlProbe />
      <Routes>
        <Route path="/me/claims" element={<ClaimsPage />}>
          <Route index element={<ClaimsIndex />} />
          <Route path="expense" element={<Where what="tab" />} />
          <Route path="opd" element={<Where what="tab" />} />
        </Route>
        <Route path="/me/claims/expense/new" element={<Where what="form" />} />
        <Route path="/me/claims/opd/new" element={<Where what="form" />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("landing on Claims", () => {
  // Deliberately not "the last tab you used": two people describing this screen
  // to each other should be looking at the same thing.
  it("opens on OPD claims", async () => {
    show();
    expect(await screen.findByTestId("url")).toHaveTextContent("/me/claims/opd");
  });

  // The default and the tab order have to agree, or the opening tab looks like
  // a bug rather than a choice.
  it("puts the tab it opens on first", async () => {
    show();
    const tabs = (await screen.findAllByRole("tab")).map((t) => t.textContent);
    expect(tabs[0]).toBe("OPD claims");
  });

  it("offers a tab for each type", async () => {
    show();
    expect(await screen.findByRole("tab", { name: "Expense claims" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "OPD claims" })).toBeInTheDocument();
  });

  it("marks the tab the URL names", async () => {
    show("/me/claims/opd");
    expect(await screen.findByRole("tab", { name: "OPD claims" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("changes the URL when a tab is clicked, so a tab can be linked", async () => {
    show();
    await screen.findByRole("tab", { name: "OPD claims" });
    await userEvent.click(screen.getByRole("tab", { name: "OPD claims" }));
    await waitFor(() => expect(screen.getByTestId("url")).toHaveTextContent("/me/claims/opd"));
  });
});

// One button, not a split one whose primary action follows the open tab: that
// would save a click and cost a button whose label and meaning shift underneath
// you as you move between tabs.
describe("adding a claim", () => {
  const open = async () => {
    await screen.findByRole("button", { name: "Add claim" });
    await userEvent.click(screen.getByRole("button", { name: "Add claim" }));
  };

  it("reads the same on both tabs", async () => {
    show("/me/claims/opd");
    expect(await screen.findByRole("button", { name: "Add claim" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Add OPD claim/ })).not.toBeInTheDocument();
  });

  it("asks which type, rather than guessing from the open tab", async () => {
    show("/me/claims/opd");
    await open();
    expect(await screen.findByRole("menuitem", { name: /Expense claim/ })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /OPD claim/ })).toBeInTheDocument();
  });

  // The two are easy to confuse and go to different people under different
  // rules, so the choice is explained where it is made.
  it("says what each type is for", async () => {
    show();
    await open();
    expect(await screen.findByText(/Money you spent out of pocket/)).toBeInTheDocument();
    expect(screen.getByText(/against this year's allowance/)).toBeInTheDocument();
  });

  it("opens the expense form", async () => {
    show();
    await open();
    await userEvent.click(screen.getByRole("menuitem", { name: /Expense claim/ }));
    expect(await screen.findByTestId("form")).toHaveTextContent("/me/claims/expense/new");
  });

  it("opens the OPD form", async () => {
    show();
    await open();
    await userEvent.click(screen.getByRole("menuitem", { name: /OPD claim/ }));
    expect(await screen.findByTestId("form")).toHaveTextContent("/me/claims/opd/new");
  });

  // The form is a page of its own: both are long, both hold a draft, and both
  // are worth linking to directly.
  it("leaves the tabs behind rather than opening a form in a box", async () => {
    show();
    await open();
    await userEvent.click(screen.getByRole("menuitem", { name: /OPD claim/ }));
    await screen.findByTestId("form");
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });
});
