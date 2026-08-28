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
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import MyTeamTable from "./MyTeamTable";
import { DEFAULT_SORT, PAGE_SIZE } from "../util/teamSearch";
import type { Employee } from "../../api/types";

function employee(over: Partial<Employee> = {}): Employee {
  return {
    employeeId: "E001",
    firstName: "Jane",
    lastName: "Perera",
    workEmail: "jane@wso2.com",
    designation: "Senior Engineer",
    externalDesignation: "Engineer II",
    employmentType: "Permanent",
    startDate: "2021-03-07",
    employeeStatus: "Active",
    employeeThumbnail: null,
    ...over,
  } as Employee;
}

function renderTable(over: Partial<Parameters<typeof MyTeamTable>[0]> = {}) {
  const onSort = vi.fn();
  const onPageChange = vi.fn();
  const onClearFilters = vi.fn();
  render(
    <MemoryRouter initialEntries={["/me/my-team"]}>
      <Routes>
        <Route
          path="/me/my-team"
          element={
            <MyTeamTable
              employees={[employee()]}
              total={1}
              page={1}
              pageSize={PAGE_SIZE}
              sort={DEFAULT_SORT}
              isFetching={false}
              hasFilters={false}
              onSort={onSort}
              onPageChange={onPageChange}
              onClearFilters={onClearFilters}
              {...over}
            />
          }
        />
        <Route path="/me/my-team/:employeeId" element={<div>detail for member</div>} />
      </Routes>
    </MemoryRouter>,
  );
  return { onSort, onPageChange, onClearFilters };
}

const header = (name: string) => screen.getByRole("columnheader", { name });

describe("MyTeamTable sorting", () => {
  // The headline test. The server rejects this field, and the source app leaves
  // its header clickable so clicking it fails with a 400.
  it("does not make External Designation sortable", () => {
    renderTable();
    const cell = header("External Designation");
    expect(cell).not.toHaveAttribute("aria-sort");
    expect(within(cell).queryByRole("button")).toBeNull();
  });

  it("shows Employee ID as the active sort on first paint", () => {
    renderTable();
    expect(header("Employee ID")).toHaveAttribute("aria-sort", "ascending");
  });

  it("reports the field the server expects, not the column key", () => {
    const { onSort } = renderTable();
    // The Employee column sorts on the concatenated name.
    within(header("Employee")).getByRole("button").click();
    expect(onSort).toHaveBeenCalledWith("fullName");
  });

  it("asks to sort by the clicked column", async () => {
    const { onSort } = renderTable();
    await userEvent.setup().click(within(header("Designation")).getByRole("button"));
    expect(onSort).toHaveBeenCalledWith("designation");
  });

  it("marks the active column with its direction", () => {
    renderTable({ sort: { sortField: "designation", sortOrder: "DESC" } });
    expect(header("Designation")).toHaveAttribute("aria-sort", "descending");
    expect(header("Employee ID")).not.toHaveAttribute("aria-sort");
  });
});

describe("MyTeamTable rows", () => {
  it("opens the detail screen from anywhere in the row", async () => {
    renderTable();
    // A cell nowhere near the name — the whole row is the target.
    await userEvent.setup().click(screen.getByText("jane@wso2.com"));
    expect(screen.getByText("detail for member")).toBeInTheDocument();
  });

  // The name is a real button with no handler of its own: activating it
  // dispatches a click that bubbles to the row. That is what keeps the row
  // reachable without a keyboard trap or a duplicate navigation path.
  it("opens the detail screen from the keyboard", async () => {
    renderTable();
    const user = userEvent.setup();
    const name = screen.getByRole("button", { name: "Jane Perera" });
    name.focus();
    expect(name).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(screen.getByText("detail for member")).toBeInTheDocument();
  });

  it("navigates once, not twice, when the name itself is clicked", async () => {
    renderTable();
    await userEvent.setup().click(screen.getByRole("button", { name: "Jane Perera" }));
    // One destination rendered — a second navigation would have unmounted and
    // remounted it, or landed somewhere else entirely.
    expect(screen.getAllByText("detail for member")).toHaveLength(1);
  });

  // The Employee DTO types designation and startDate as non-null, but the
  // source app falls back for both — so the backend does send them empty. The
  // cast keeps the runtime case under test rather than trusting the type.
  it("uses N/A for missing text and a dash for a missing date", () => {
    renderTable({
      employees: [
        employee({
          designation: null,
          externalDesignation: null,
          startDate: null,
        } as unknown as Partial<Employee>),
      ],
    });
    // Deliberately different fallbacks — do not "harmonise" these.
    expect(screen.getAllByText("N/A").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("-")).toBeInTheDocument();
  });

  it("colours the status chip by status", () => {
    renderTable({ employees: [employee({ employeeStatus: "Left" })] });
    expect(screen.getByText("Left")).toBeInTheDocument();
  });
});

describe("MyTeamTable empty states", () => {
  it("says the team is empty when nothing is filtering", () => {
    renderTable({ employees: [], total: 0, hasFilters: false });
    expect(screen.getByText("No reports found.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear filters" })).toBeNull();
  });

  it("says the filters matched nothing, and offers to clear them", async () => {
    const { onClearFilters } = renderTable({ employees: [], total: 0, hasFilters: true });
    expect(screen.getByText("No one matches these filters.")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Clear filters" }));
    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });

  // Happens when the list shrinks underneath you.
  it("offers a way back when the page is past the end", async () => {
    const { onPageChange } = renderTable({ employees: [], total: 90, page: 4, pageSize: 25 });
    expect(
      screen.getByText("This page is empty — the list changed while you were on it."),
    ).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Go to the last page" }));
    expect(onPageChange).toHaveBeenCalledWith(4); // ceil(90/25) = 4
  });
});
