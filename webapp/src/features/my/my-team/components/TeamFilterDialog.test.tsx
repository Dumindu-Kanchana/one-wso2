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
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TeamFilterDialog from "./TeamFilterDialog";
import { DEFAULT_FILTERS } from "../util/teamSearch";
import type { OrgReference } from "../../api/orgTypes";

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

function renderDialog() {
  const onApply = vi.fn();
  const onClose = vi.fn();
  const onSelectionChange = vi.fn();
  render(
    <TeamFilterDialog
      initial={DEFAULT_FILTERS}
      reference={reference}
      onSelectionChange={onSelectionChange}
      onApply={onApply}
      onClose={onClose}
    />,
  );
  return { onApply, onClose, onSelectionChange };
}

/** Pick an option from one of the Autocompletes by its label. */
async function choose(user: ReturnType<typeof userEvent.setup>, field: string, option: string) {
  await user.click(screen.getByRole("combobox", { name: field }));
  await user.click(await screen.findByRole("option", { name: option }));
}

describe("TeamFilterDialog", () => {
  // The draft/applied boundary. In the source app the whole filter chip row
  // stayed hidden until Apply had been pressed once, and its draft could be
  // re-seeded mid-edit — so this is the behaviour worth pinning down.
  it("keeps edits to itself until Apply", async () => {
    const { onApply, onClose } = renderDialog();
    const user = userEvent.setup();

    await choose(user, "Business Unit", "Engineering");

    // Nothing has been applied yet.
    expect(onApply).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onApply).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("applies exactly what was drafted", async () => {
    const { onApply } = renderDialog();
    const user = userEvent.setup();

    await choose(user, "Business Unit", "Sales");
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply.mock.calls[0][0]).toMatchObject({ businessUnitId: 2 });
  });

  it("clears a drafted child when its parent changes", async () => {
    const { onApply } = renderDialog();
    const user = userEvent.setup();

    await choose(user, "Business Unit", "Engineering");
    await choose(user, "Team", "Platform");
    // Switching the parent invalidates the team beneath it.
    await choose(user, "Business Unit", "Sales");
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(onApply.mock.calls[0][0]).toMatchObject({ businessUnitId: 2, teamId: null });
  });

  it("tells the parent what changed, so dependent lists can narrow", async () => {
    const { onSelectionChange } = renderDialog();
    await choose(userEvent.setup(), "Business Unit", "Engineering");
    expect(onSelectionChange).toHaveBeenCalledWith(
      expect.objectContaining({ businessUnitId: 1 }),
    );
  });

  it("Clear all returns the draft to the defaults without applying", async () => {
    const { onApply, onSelectionChange } = renderDialog();
    const user = userEvent.setup();

    await choose(user, "Business Unit", "Engineering");
    await user.click(screen.getByRole("button", { name: "Clear all" }));

    expect(onApply).not.toHaveBeenCalled();
    expect(onSelectionChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ businessUnitId: null }),
    );
  });
});
