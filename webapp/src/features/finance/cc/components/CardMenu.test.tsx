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
import { fireEvent, render, screen } from "@testing-library/react";
import { CardMenu } from "./CardMenu";
import type { CcCreditCard } from "../ccTypes";

const cards = [
  { id: 1, ccNumber: "111122223333", label: "Travel", bankCode: "hsbc", status: "Active" },
  { id: 2, ccNumber: "444455556666", label: "Ops", bankCode: "hsbc", status: "Active" },
] as unknown as CcCreditCard[];

const onSelect = vi.fn();
const onRename = vi.fn();

beforeEach(() => {
  onSelect.mockClear();
  onRename.mockClear();
});

const show = (rename = true) =>
  render(
    <CardMenu
      cards={cards}
      active="111122223333"
      onSelect={onSelect}
      onRename={rename ? onRename : undefined}
    />,
  );

describe("picking a card", () => {
  it("selects on click", () => {
    show();
    fireEvent.click(screen.getByText("•••• 6666"));
    expect(onSelect).toHaveBeenCalledWith("444455556666");
  });

  it("selects on Enter, since the tile is a keyboard target", () => {
    show();
    fireEvent.keyDown(screen.getByText("•••• 6666").closest('[role="button"]')!, {
      key: "Enter",
    });
    expect(onSelect).toHaveBeenCalledWith("444455556666");
  });
});

// The tile is a role="button" that selects on Enter/Space, and the rename
// button sits inside it. Without stopping propagation, reaching rename by
// keyboard opens the dialog *and* switches card underneath it.
describe("renaming without disturbing the selection", () => {
  it("does not select the card when rename is opened by keyboard", () => {
    show();
    const rename = screen.getByRole("button", { name: "Rename card ending 6666" });
    fireEvent.keyDown(rename, { key: "Enter" });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("does not select the card when rename is opened by Space", () => {
    show();
    const rename = screen.getByRole("button", { name: "Rename card ending 6666" });
    fireEvent.keyDown(rename, { key: " " });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("does not select the card when rename is clicked", () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: "Rename card ending 6666" }));
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("offers no rename affordance when the caller cannot rename", () => {
    show(false);
    expect(
      screen.queryByRole("button", { name: /^Rename card/ }),
    ).not.toBeInTheDocument();
  });

  it("passes the new label back for the card it was opened on", () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: "Rename card ending 6666" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Ops EU" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onRename).toHaveBeenCalledWith(cards[1], "Ops EU");
  });
});
