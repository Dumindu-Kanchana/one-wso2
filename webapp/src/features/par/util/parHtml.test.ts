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
  isParHtmlEmpty,
  parHtmlToPlainText,
  sanitizeParHtml,
} from "@features/par/util/parHtml";

describe("sanitizeParHtml", () => {
  it("keeps the formatting a PAR answer is allowed to use", () => {
    const html = "<p><strong>Shipped</strong> the <em>gateway</em> work.</p><ul><li>One</li></ul>";
    expect(sanitizeParHtml(html)).toBe(html);
  });

  it("strips script and event handlers", () => {
    expect(sanitizeParHtml('<p>hi</p><script>alert(1)</script>')).toBe("<p>hi</p>");
    expect(sanitizeParHtml('<p onclick="steal()">hi</p>')).toBe("<p>hi</p>");
    expect(sanitizeParHtml('<img src=x onerror="steal()">')).toBe("");
  });

  it("strips inline styles, which the source only appeared to allow", () => {
    // `style` was in both the allowed and forbidden lists there; forbidding won.
    expect(sanitizeParHtml('<p style="position:fixed;top:0">hi</p>')).toBe("<p>hi</p>");
  });

  it("refuses javascript: and data: URLs on links", () => {
    expect(sanitizeParHtml('<a href="javascript:alert(1)">x</a>')).not.toContain("javascript");
    expect(sanitizeParHtml('<a href="data:text/html,<script>1</script>">x</a>')).not.toContain(
      "data:",
    );
  });

  it("forces noopener on links, which are written by other employees", () => {
    const out = sanitizeParHtml('<a href="https://wso2.com">x</a>');
    expect(out).toContain('rel="noopener noreferrer"');
    expect(out).toContain('target="_blank"');
  });

  it("cannot be talked out of noopener by supplying its own rel", () => {
    const out = sanitizeParHtml('<a href="https://wso2.com" rel="opener" target="_self">x</a>');
    expect(out).toContain('rel="noopener noreferrer"');
    expect(out).not.toContain('rel="opener"');
  });

  it("keeps the list markers existing answers depend on", () => {
    // The source's editor writes bullets as <ol><li data-list="bullet">.
    // Dropping data-list silently renumbers every existing bulleted answer.
    const html = '<ol><li data-list="bullet">One</li></ol>';
    expect(sanitizeParHtml(html)).toContain('data-list="bullet"');
  });

  it("returns nothing for nothing", () => {
    for (const raw of [undefined, null, ""]) expect(sanitizeParHtml(raw)).toBe("");
  });
});

describe("parHtmlToPlainText", () => {
  it("reads the words, not the markup", () => {
    expect(parHtmlToPlainText("<p><strong>Shipped</strong> the work.</p>")).toBe("Shipped the work.");
  });

  it("treats a line break as a boundary rather than joining words", () => {
    // Without this "one<br>two" measures as one eight-letter word.
    expect(parHtmlToPlainText("<p>one<br>two</p>")).toBe("one\ntwo");
  });

  it("does not count a non-breaking space as content", () => {
    expect(parHtmlToPlainText("<p>&nbsp;</p>")).toBe("");
  });
});

// The check that stops someone sharing a PAR — which is one-way — with nothing
// in it. A cleared contenteditable field is never an empty string.
describe("isParHtmlEmpty", () => {
  it("recognises the shapes an emptied editor actually leaves behind", () => {
    for (const raw of ["", "<p></p>", "<p><br></p>", "<p><br/></p>", "<div><p>&nbsp;</p></div>"]) {
      expect(isParHtmlEmpty(raw), JSON.stringify(raw)).toBe(true);
    }
  });

  it("treats markup with no words as empty", () => {
    expect(isParHtmlEmpty("<ul><li></li></ul>")).toBe(true);
    expect(isParHtmlEmpty("<p><strong><em></em></strong></p>")).toBe(true);
  });

  it("does not call real content empty", () => {
    expect(isParHtmlEmpty("<p>Done.</p>")).toBe(false);
    expect(isParHtmlEmpty("<ul><li>One</li></ul>")).toBe(false);
  });

  it("is empty when the only content was stripped as unsafe", () => {
    // A field holding nothing but a script has nothing a person wrote in it.
    expect(isParHtmlEmpty("<script>alert(1)</script>")).toBe(true);
  });
});
