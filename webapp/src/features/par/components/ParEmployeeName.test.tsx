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

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ParEmployeeName } from "./ParEmployeeName";
import { NotificationsProvider } from "@context/notifications/NotificationsContext";

function show(ui: React.ReactElement) {
  return render(<NotificationsProvider>{ui}</NotificationsProvider>);
}

const writeText = vi.fn(() => Promise.resolve());

beforeEach(() => {
  writeText.mockClear();
});

// userEvent.setup() installs its own navigator.clipboard stub, so the mock has
// to be planted after it or the component writes to theirs instead of ours.
function setupUser() {
  const user = userEvent.setup();
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  return user;
}

describe("ParEmployeeName", () => {
  it("shows the name, with the email present for the hover to reveal", () => {
    show(<ParEmployeeName name="Ann Perera" email="ann@wso2.com" />);
    expect(screen.getByText("Ann Perera")).toBeInTheDocument();
    expect(screen.getByText("ann@wso2.com")).toBeInTheDocument();
  });

  it("stands the email in for a record with no name", () => {
    // The source renders parEmployeeName directly, so a nameless record shows a
    // blank cell. Falling back is the one place this diverges.
    show(<ParEmployeeName email="ann@wso2.com" />);
    expect(screen.getAllByText("ann@wso2.com").length).toBe(2);
  });

  it("offers no copy button unless asked — OrgSummary's own columns have none", () => {
    show(<ParEmployeeName name="Ann Perera" email="ann@wso2.com" />);
    expect(screen.queryByRole("button", { name: "Copy Email" })).toBeNull();
  });

  it("copies the email and says so", async () => {
    show(<ParEmployeeName name="Ann Perera" email="ann@wso2.com" copyable />);
    await setupUser().click(screen.getByRole("button", { name: "Copy Email" }));
    expect(writeText).toHaveBeenCalledWith("ann@wso2.com");
    expect(await screen.findByText("Email copied")).toBeInTheDocument();
  });

  it("says so when the browser refuses the clipboard", async () => {
    writeText.mockImplementationOnce(() => Promise.reject(new Error("denied")));
    show(<ParEmployeeName name="Ann Perera" email="ann@wso2.com" copyable />);
    await setupUser().click(screen.getByRole("button", { name: "Copy Email" }));
    expect(await screen.findByText(/refused clipboard access/)).toBeInTheDocument();
  });

  it("keeps a row click from firing when the copy button is used", async () => {
    const onRow = vi.fn();
    const onOpen = vi.fn();
    show(
      <div onClick={onRow}>
        <ParEmployeeName name="Ann Perera" email="ann@wso2.com" copyable onOpen={onOpen} />
      </div>,
    );
    await setupUser().click(screen.getByRole("button", { name: "Copy Email" }));
    expect(writeText).toHaveBeenCalled();
    expect(onRow).not.toHaveBeenCalled();
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("opens the person from the name without also firing the row", async () => {
    const onRow = vi.fn();
    const onOpen = vi.fn();
    show(
      <div onClick={onRow}>
        <ParEmployeeName name="Ann Perera" email="ann@wso2.com" onOpen={onOpen} />
      </div>,
    );
    await userEvent.setup().click(screen.getByRole("button", { name: "Ann Perera" }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onRow).not.toHaveBeenCalled();
  });

  it("renders the name as plain text when there is nothing to open", () => {
    show(<ParEmployeeName name="Ann Perera" email="ann@wso2.com" />);
    expect(screen.queryByRole("button", { name: "Ann Perera" })).toBeNull();
  });

  // The email box sits at opacity 0, not display:none, so the copy button stays
  // in the tab order. Without a focus-within reveal it would be a control a
  // keyboard user can reach and cannot see.
  it("reveals on focus, not on hover alone", () => {
    show(<ParEmployeeName name="Ann Perera" email="ann@wso2.com" copyable />);
    const wrapper = screen.getByText("ann@wso2.com").closest("div")?.parentElement;
    const rules = JSON.stringify(
      Array.from(document.styleSheets).flatMap((sheet) => {
        try {
          return Array.from(sheet.cssRules).map((r) => r.cssText);
        } catch {
          return [];
        }
      }),
    );
    expect(wrapper).not.toBeNull();
    expect(rules).toContain("focus-within");
  });
});
