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
  chainBack,
  chainCurrent,
  chainPush,
  chainTruncate,
  type ParChainStep,
} from "@features/par/util/parChain";

const step = (email: string): ParChainStep => ({ email, name: email.split("@")[0] });
const ROOT = [step("lead@wso2.com")];

describe("where you are", () => {
  it("is the last step", () => {
    expect(chainCurrent([...ROOT, step("a@wso2.com")])?.email).toBe("a@wso2.com");
  });

  it("is nothing for an empty trail", () => {
    expect(chainCurrent([])).toBeUndefined();
  });
});

describe("drilling in", () => {
  it("appends", () => {
    expect(chainPush(ROOT, step("a@wso2.com")).map((s) => s.email)).toEqual([
      "lead@wso2.com",
      "a@wso2.com",
    ]);
  });

  // A reporting line with a loop in it is a data problem, but the browser must
  // survive it rather than growing the trail without bound.
  it("truncates back rather than appending when re-entering someone already in the trail", () => {
    const trail = [...ROOT, step("a@wso2.com"), step("b@wso2.com")];
    expect(chainPush(trail, step("a@wso2.com")).map((s) => s.email)).toEqual([
      "lead@wso2.com",
      "a@wso2.com",
    ]);
  });

  it("collapses a self-reference to a no-op", () => {
    expect(chainPush(ROOT, step("lead@wso2.com"))).toEqual(ROOT);
  });

  it("does not mutate the trail it was given", () => {
    chainPush(ROOT, step("a@wso2.com"));
    expect(ROOT).toHaveLength(1);
  });
});

describe("jumping back to a breadcrumb", () => {
  const trail = [...ROOT, step("a@wso2.com"), step("b@wso2.com")];

  it("keeps everything up to and including the one clicked", () => {
    expect(chainTruncate(trail, 1).map((s) => s.email)).toEqual(["lead@wso2.com", "a@wso2.com"]);
    expect(chainTruncate(trail, 0).map((s) => s.email)).toEqual(["lead@wso2.com"]);
  });

  it("ignores an index outside the trail", () => {
    // A stale click after the trail already shortened should do nothing rather
    // than truncate to somewhere arbitrary.
    for (const i of [-1, 3, 99, 1.5, NaN]) {
      expect(chainTruncate(trail, i), String(i)).toEqual(trail);
    }
  });
});

describe("going back one", () => {
  it("drops the last step", () => {
    const trail = [...ROOT, step("a@wso2.com")];
    expect(chainBack(trail).map((s) => s.email)).toEqual(["lead@wso2.com"]);
  });

  it("stops at the root rather than emptying the trail", () => {
    expect(chainBack(ROOT)).toEqual(ROOT);
    expect(chainBack([])).toEqual([]);
  });
});
