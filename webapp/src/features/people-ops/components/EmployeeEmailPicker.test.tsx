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

// This picker takes an `enabled` prop, so its query is often switched off —
// which is exactly the case React Query leaves `pending` for good. Reading that
// flag showed a spinner forever in the one situation where nothing was ever
// going to arrive.
const roster = { fetching: false, enabledSeen: [] as boolean[] };

vi.mock("../api/useOrgChartEntities", () => ({
  useEmployeesBasicInfo: (enabled = true) => {
    roster.enabledSeen.push(enabled);
    return {
      data: roster.fetching ? undefined : [
        { workEmail: "ada@wso2.com", firstName: "Ada", lastName: "Lovelace", employeeThumbnail: null },
      ],
      // A disabled query: pending, because it never resolves; not loading,
      // because it never fetches.
      isPending: roster.fetching || !enabled,
      isLoading: roster.fetching && enabled,
      isError: false,
    };
  },
}));

const { default: EmployeeEmailPicker } = await import("./EmployeeEmailPicker");

beforeEach(() => {
  roster.fetching = false;
  roster.enabledSeen.length = 0;
});

const show = (props: Record<string, unknown> = {}) =>
  render(<EmployeeEmailPicker label="Employee" value="" onChange={() => {}} {...props} />);

describe("while the roster is loading", () => {
  it("greys the field out rather than letting someone type into nothing", () => {
    roster.fetching = true;
    show();
    expect(screen.getByRole("combobox", { name: /Employee/ })).toBeDisabled();
  });

  it("shows a spinner", () => {
    roster.fetching = true;
    show();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("hands the field over once the roster arrives", () => {
    show();
    expect(screen.getByRole("combobox", { name: /Employee/ })).toBeEnabled();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
});

// `enabled` defers the fetch until the field can be used. No caller passes it
// today, so this is a latent case rather than a live one — but a query that was
// never started is not loading, and reading `isPending` would have parked a
// spinner on screen with nothing behind it, forever.
describe("when the caller has not enabled the fetch", () => {
  it("does not pretend to be loading something it never asked for", () => {
    show({ enabled: false });
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("passes the caller's choice through to the query", () => {
    show({ enabled: false });
    expect(roster.enabledSeen).toContain(false);
  });
});

describe("when the caller disables it outright", () => {
  it("stays disabled even with the roster in hand", () => {
    show({ disabled: true });
    expect(screen.getByRole("combobox", { name: /Employee/ })).toBeDisabled();
  });
});
