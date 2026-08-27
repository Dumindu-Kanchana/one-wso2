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
import { decodeParComment, encodeParComment } from "@features/par/util/parCommentCodec";

// The contract with the PAR backend. A port that got this wrong would write
// records the real app cannot read, and render base64 for every record the real
// app wrote.
describe("the wire format", () => {
  it("is base64 of URI-encoded HTML, exactly as the standalone app writes it", () => {
    const html = "<p>Shipped the gateway.</p>";
    const wire = encodeParComment(html);
    expect(wire).toBe(btoa(encodeURIComponent(html)));
    // And it is NOT the raw HTML, which is what this port used to send.
    expect(wire).not.toBe(html);
  });

  it("round-trips", () => {
    for (const html of [
      "<p>Plain</p>",
      "<ul><li>One</li><li>Two</li></ul>",
      "<p><strong>Bold</strong> and <em>italic</em></p>",
    ]) {
      expect(decodeParComment(encodeParComment(html))).toBe(html);
    }
  });

  it("survives text btoa alone would refuse", () => {
    // btoa throws on anything outside Latin1, so an accent or an emoji would
    // fail to save without the encodeURIComponent wrapper.
    for (const html of ["<p>Perera — done</p>", "<p>Café</p>", "<p>Shipped 🚀</p>", "<p>日本語</p>"]) {
      expect(decodeParComment(encodeParComment(html))).toBe(html);
    }
  });
});

describe("reading what the real app wrote", () => {
  it("decodes it", () => {
    const wire = btoa(encodeURIComponent("<p>From the real app.</p>"));
    expect(decodeParComment(wire)).toBe("<p>From the real app.</p>");
  });
});

describe("reading something that is not the wire format", () => {
  it("discards it, as the standalone app does", () => {
    // Raw HTML in the field is already invisible in the real app. Passing it
    // through here would show content the real app hides.
    expect(decodeParComment("<p>raw html</p>")).toBe("");
    expect(decodeParComment("not base64 at all!")).toBe("");
  });

  it("discards base64 whose decoded form is not valid percent-encoding", () => {
    // btoa("%") — decodeURIComponent then throws URIError on the lone percent.
    expect(decodeParComment("JQ==")).toBe("");
  });

  it("returns base64 that decodes to nonsense, as the standalone app does", () => {
    // "////" decodes to "ÿÿÿ" and decodeURIComponent does NOT throw on it, so
    // both apps show it. Pinned because it is the behaviour, not the intent —
    // if this ever needs to change it has to change in both.
    expect(decodeParComment("////")).toBe("ÿÿÿ");
  });

  it("is empty for nothing", () => {
    for (const raw of [undefined, null, ""]) {
      expect(decodeParComment(raw), JSON.stringify(raw)).toBe("");
      expect(encodeParComment(raw), JSON.stringify(raw)).toBe("");
    }
  });
});
