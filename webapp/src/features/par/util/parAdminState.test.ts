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


import { describe, expect, it } from "vitest";
import {
  parAdminCycle,
  parAdminView,
  shouldPollPending,
} from "@features/par/util/parAdminState";
import type { ParCycle } from "@features/par/api/parTypes";

const cycle = (id: number, name = `C${id}`) =>
  ({ parCycleId: id, parCycleName: name }) as ParCycle;
const NONE = { open: [], quotaPending: [], pending: [] };

describe("which view the admin screen shows", () => {
  it("offers to create one when nothing is in flight", () => {
    expect(parAdminView(NONE)).toBe("create");
    expect(parAdminView({ open: undefined, quotaPending: undefined, pending: undefined })).toBe(
      "create",
    );
  });

  it("shows the org summary for an open cycle", () => {
    expect(parAdminView({ ...NONE, open: [cycle(1)] })).toBe("summary");
  });

  it("asks for quota when a cycle is waiting on it", () => {
    expect(parAdminView({ ...NONE, quotaPending: [cycle(2)] })).toBe("assignQuota");
  });

  it("reports the creation job while it runs", () => {
    expect(parAdminView({ ...NONE, pending: [cycle(3)] })).toBe("creating");
  });
});

// The branches are not mutually exclusive in the data — more than one list can
// be non-empty — so the order they are checked in IS the behaviour.
describe("when more than one list is non-empty", () => {
  it("prefers the open cycle above everything", () => {
    expect(
      parAdminView({ open: [cycle(1)], quotaPending: [cycle(2)], pending: [cycle(3)] }),
    ).toBe("summary");
  });

  it("prefers quota over a still-running creation", () => {
    expect(parAdminView({ open: [], quotaPending: [cycle(2)], pending: [cycle(3)] })).toBe(
      "assignQuota",
    );
  });
});

describe("which cycle the view is about", () => {
  it("is the open one, then the quota-pending one, then the pending one", () => {
    expect(parAdminCycle({ ...NONE, open: [cycle(1)] })?.parCycleId).toBe(1);
    expect(parAdminCycle({ ...NONE, quotaPending: [cycle(2)] })?.parCycleId).toBe(2);
    expect(parAdminCycle({ ...NONE, pending: [cycle(3)] })?.parCycleId).toBe(3);
  });

  it("is nothing when there is no cycle", () => {
    expect(parAdminCycle(NONE)).toBeUndefined();
  });
});

describe("polling the creation job", () => {
  it("polls only while something is pending", () => {
    expect(shouldPollPending({ ...NONE, pending: [cycle(3)] })).toBe(true);
    expect(shouldPollPending(NONE)).toBe(false);
  });

  // §9.3: a failed job moves the cycle to a status nothing queries, so the list
  // empties and polling stops. Reproduced, not corrected.
  it("stops when the list empties, whatever the reason", () => {
    expect(shouldPollPending({ ...NONE, pending: [] })).toBe(false);
  });
});
