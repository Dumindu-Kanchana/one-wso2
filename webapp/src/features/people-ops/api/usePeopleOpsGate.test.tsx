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
import { renderHook } from "@testing-library/react";

// `useUserInfo` is held back until the Asgardeo sub resolves. React Query calls
// a query it has not started `pending` but not `loading`, and this gate had no
// test for that state — which is how it once came to read the wrong flag and
// show a denial to admins on every cold load.
const userInfo: {
  data?: unknown;
  isPending?: boolean;
  isLoading?: boolean;
  isError?: boolean;
  error?: unknown;
  refetch?: () => void;
} = {};

vi.mock("@api/useUserInfo", () => ({ useUserInfo: () => userInfo }));

const { usePeopleOpsGate } = await import("./usePeopleOpsGate");

/** people-app's ADMIN privilege — appMenu.ts:41, which does not export it. */
const ADMIN = 999;

const gate = () => renderHook(() => usePeopleOpsGate()).result.current;

beforeEach(() => {
  userInfo.data = undefined;
  userInfo.isPending = false;
  userInfo.isLoading = false;
  userInfo.isError = false;
  userInfo.error = undefined;
  userInfo.refetch = () => {};
});

describe("while identity is still resolving", () => {
  it("reports itself as still resolving, not as a finished denial", () => {
    // Disabled, so never started: pending, but not loading.
    userInfo.isPending = true;
    userInfo.isLoading = false;
    expect(gate().isResolving).toBe(true);
    expect(gate().isAdmin).toBe(false);
  });

  it("is still resolving once the request is actually in flight", () => {
    userInfo.isPending = true;
    userInfo.isLoading = true;
    expect(gate().isResolving).toBe(true);
  });
});

describe("once /user-info has answered", () => {
  it("is no longer resolving", () => {
    userInfo.data = { privileges: [] };
    expect(gate().isResolving).toBe(false);
  });

  it("grants admin on the people-app privilege", () => {
    userInfo.data = { privileges: [ADMIN] };
    expect(gate().isAdmin).toBe(true);
  });

  it("withholds it otherwise", () => {
    userInfo.data = { privileges: [] };
    expect(gate().isAdmin).toBe(false);
  });
});

// A failed check is not the same as a decided "you are not an admin", and the
// screens tell them apart.
describe("when the check itself fails", () => {
  it("reports the failure rather than a denial", () => {
    userInfo.isError = true;
    userInfo.error = new Error("boom");
    expect(gate().isError).toBe(true);
    expect(gate().errorMessage).toBeTruthy();
    expect(gate().isAdmin).toBe(false);
  });

  it("carries no message when nothing failed", () => {
    userInfo.data = { privileges: [] };
    expect(gate().errorMessage).toBeUndefined();
  });
});
