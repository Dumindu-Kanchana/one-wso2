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
import { matchSectionId } from "@components/side-rail/activeItem";
import { PERSPECTIVES } from "@constants/perspectives";
import type { PerspectiveSection } from "@constants/perspectives";

/** The real Me sections, so these test the registry rather than a fixture. */
const ME = PERSPECTIVES.find((p) => p.key === "me")?.sections ?? [];

function idFor(pathname: string): string {
  const exact = matchSectionId(ME, pathname);
  return exact || matchSectionId(ME, pathname, { allowDescendants: true });
}

describe("exact routes", () => {
  it("lights the item whose path is the URL", () => {
    expect(idFor("/me/par")).toBe("par-my");
    expect(idFor("/me/par/history")).toBe("par-history");
    expect(idFor("/me/par/team")).toBe("par-team");
    expect(idFor("/me/my-team")).toBe("me-my-team");
  });

  it("matches nothing for a route outside the registry", () => {
    expect(matchSectionId(ME, "/me/nowhere")).toBe("");
  });
});

// The bug: the descendant pass returned the FIRST prefix match in registry
// order, and `/me/par` is registered before `/me/par/team` — so a detail route
// under the team screen lit up "My PAR".
describe("detail routes below an item", () => {
  it("keeps the most specific item lit, not the shortest prefix", () => {
    expect(idFor("/me/par/team/abcd%40wso2.com")).toBe("par-team");
    expect(idFor("/me/par/team/abcd@wso2.com")).toBe("par-team");
  });

  it("does the same for other apps' detail routes", () => {
    expect(idFor("/me/my-team/E123")).toBe("me-my-team");
    expect(idFor("/me/opd/history/CLM-9")).toBe("opd-history");
  });

  it("still falls back to a parent when nothing deeper matches", () => {
    // A route below the PAR home with no item of its own belongs to it.
    expect(idFor("/me/par/anything-else")).toBe("par-my");
  });
});

describe("the longest-match rule itself", () => {
  const sections: PerspectiveSection[] = [
    {
      id: "group",
      label: "Group",
      children: [
        { id: "root", label: "Root", path: "/x" },
        { id: "deep", label: "Deep", path: "/x/y/z" },
        { id: "mid", label: "Mid", path: "/x/y" },
      ],
    },
  ];

  it("ignores registry order entirely", () => {
    // "root" is declared first and prefixes both others; "mid" is declared last
    // and is the right answer for /x/y/anything.
    expect(matchSectionId(sections, "/x/y/anything", { allowDescendants: true })).toBe("mid");
    expect(matchSectionId(sections, "/x/y/z/anything", { allowDescendants: true })).toBe("deep");
    expect(matchSectionId(sections, "/x/other", { allowDescendants: true })).toBe("root");
  });

  it("prefers an exact match over any descendant, whatever the lengths", () => {
    expect(matchSectionId(sections, "/x/y")).toBe("mid");
  });

  it("considers a group's own path as well as its children's", () => {
    const withGroupPath: PerspectiveSection[] = [
      { id: "leaf", label: "Leaf", path: "/a" },
      {
        id: "grp",
        label: "Grp",
        path: "/a/b",
        children: [{ id: "kid", label: "Kid", path: "/a/b/c" }],
      },
    ];
    expect(matchSectionId(withGroupPath, "/a/b/other", { allowDescendants: true })).toBe("grp");
    expect(matchSectionId(withGroupPath, "/a/b/c/other", { allowDescendants: true })).toBe("kid");
  });

  it("does not treat a shared prefix that is not a path boundary as a match", () => {
    // "/x-ray" starts with "/x" as a string but is not below it as a route.
    expect(matchSectionId(sections, "/x-ray", { allowDescendants: true })).toBe("");
  });
});
