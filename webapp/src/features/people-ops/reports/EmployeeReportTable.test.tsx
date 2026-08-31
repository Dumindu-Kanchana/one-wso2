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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { EmployeeStatus } from "../api/peopleOpsTypes";
import { localIsoDate } from "@utils/localDate";

const saveCsv = vi.fn();
const downloadMutate = vi.fn((_vars: unknown, opts: { onSuccess: (csv: string) => void }) =>
  opts.onSuccess("a,b\n1,2"),
);

vi.mock("../api/useEmployeeReport", () => ({
  isPeopleBackendConfigured: () => true,
  saveCsv: (...args: unknown[]) => saveCsv(...args),
  useEmployeeSearch: () => ({
    data: { employees: [], totalCount: 0 },
    isLoading: false,
    isError: false,
    error: null,
  }),
  useManagers: () => ({ data: [], isLoading: false, isError: false }),
  useEmployeeReportDownload: () => ({ mutate: downloadMutate, isPending: false }),
}));

vi.mock("../api/useOrgMasterData", () => ({
  useOrgMasterData: () => ({ data: undefined, isLoading: false, isError: false }),
}));

const { default: EmployeeReportTable } = await import("./EmployeeReportTable");

beforeEach(() => {
  saveCsv.mockClear();
  downloadMutate.mockClear();
  vi.useFakeTimers({ toFake: ["Date"] });
  // Just past midnight UTC, which is the previous evening in the suite's zone.
  vi.setSystemTime(new Date("2026-08-31T02:00:00.000Z"));
});
afterEach(() => {
  vi.useRealTimers();
});

const show = () =>
  render(
    <MemoryRouter>
      <EmployeeReportTable
        employeeStatus={EmployeeStatus.Active}
        previewAlertText="Preview"
        countChipLabel="employees"
        downloadFilenamePrefix="active_employees"
      />
    </MemoryRouter>,
  );

// The filename dates the export for whoever downloads it, so it has to carry
// their calendar day. Read from `toISOString()` it would stamp tomorrow on any
// evening export west of Greenwich — a file named for a day that has not
// started yet, which is confusing in a folder of dated reports.
describe("the exported filename", () => {
  it("is stamped with the local calendar day, not the UTC one", async () => {
    show();
    fireEvent.click(await screen.findByRole("button", { name: /export|download/i }));
    await waitFor(() => expect(saveCsv).toHaveBeenCalled());

    // Computed, not hardcoded: which day 02:00 UTC falls on depends on the
    // zone, and the suite is only pinned to one by default. In the pinned zone
    // this is 30 Aug while `toISOString()` would say 31 Aug.
    const [, filename] = saveCsv.mock.calls[0];
    expect(filename).toBe(`active_employees_${localIsoDate()}.csv`);
  });
});
