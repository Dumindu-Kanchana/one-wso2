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


// Sanitising the rich text a PAR carries.
//
// Every free-text field in PAR — the employee's answer, the lead's review, a
// 360 comment — is stored as HTML and has to be rendered as HTML, so each one
// is an injection site. One function owns that, and both the editor and the
// read-only renderer go through it: sanitising only on the way out would trust
// whatever an older client stored, and only on the way in would trust the
// backend to have sanitised.
//
// The allow-list is carried over from the source, minus two mistakes:
//
//   - `style` was in BOTH the allowed and forbidden attribute lists. DOMPurify
//     resolves that in favour of forbidding, so inline styles were already
//     being stripped; listing it as allowed only misled the reader.
//   - `alert` was in the forbidden TAG list. There is no such element — it
//     reads as a defence against something that was never a tag.
//
// `class` and `data-list` stay, and are not decoration: the source's editor
// writes bullet lists as `<ol><li data-list="bullet">`, so dropping them turns
// every existing bulleted answer into a numbered one.

import DOMPurify from "dompurify";

const ALLOWED_TAGS = [
  "b",
  "i",
  "em",
  "strong",
  "u",
  "a",
  "p",
  "br",
  "div",
  "span",
  "ol",
  "ul",
  "li",
];

const ALLOWED_ATTR = ["href", "target", "rel", "class", "data-list"];

// Anchors reach the page from another employee's text, so they get
// `rel="noopener noreferrer"` whether or not the author wrote one. Without
// `noopener` a link opening in a new tab hands that tab a handle on ours.
let hookInstalled = false;
function installAnchorHook(): void {
  if (hookInstalled) return;
  hookInstalled = true;
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node.nodeName !== "A") return;
    const el = node as unknown as Element;
    if (!el.getAttribute("href")) return;
    el.setAttribute("target", "_blank");
    el.setAttribute("rel", "noopener noreferrer");
  });
}

/** The only way HTML from a PAR field should ever reach the DOM. */
export function sanitizeParHtml(raw: string | null | undefined): string {
  if (typeof raw !== "string" || raw === "") return "";
  installAnchorHook();
  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // Belt and braces alongside the allow-list, which already excludes these.
    FORBID_TAGS: ["style", "script", "iframe", "frame", "object", "embed", "form"],
    FORBID_ATTR: ["style"],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  });
}

/**
 * The readable text inside a PAR field, for length limits and emptiness.
 *
 * Never for display — it discards the markup deliberately.
 */
export function parHtmlToPlainText(raw: string | null | undefined): string {
  const clean = sanitizeParHtml(raw);
  if (!clean) return "";
  const host = document.createElement("div");
  host.innerHTML = clean;
  // `<br>` and block ends are word boundaries; without this "one<br>two" reads
  // as "onetwo" and a length check under-counts.
  for (const br of Array.from(host.querySelectorAll("br"))) {
    br.replaceWith(document.createTextNode("\n"));
  }
  // \u00a0 as an escape, not the character: a literal non-breaking space is
  // invisible in source and reads as a typo.
  return (host.textContent ?? "").replace(/\u00a0/g, " ").trim();
}

/**
 * Admin-configured prose — a cycle's question — turned into safe HTML.
 *
 * These fields are authored in a plain multiline text box, not a rich-text
 * editor, and in practice they arrive containing BOTH conventions: real
 * newlines from somebody pressing Enter, and hand-typed `<br/>` from somebody
 * who expected HTML. The standalone app rendered them as plain text, so the
 * tags showed literally and the newlines collapsed — neither author got what
 * they meant.
 *
 * Newlines are converted before sanitising, so the resulting `<br>` survives the
 * allow-list. Everything else goes through the same allow-list as employee
 * prose, so a question is not a way to inject markup the rest of the feature
 * refuses.
 */
export function parConfiguredTextToHtml(raw: string | null | undefined): string {
  if (typeof raw !== "string" || raw.trim() === "") return "";
  return sanitizeParHtml(raw.replace(/\r\n|\r|\n/g, "<br>"));
}

/**
 * Whether a field is empty in the way a person means it.
 *
 * A contenteditable field that has been focused and cleared still holds
 * `<p><br></p>`, and a pasted-then-deleted one can hold nested empty tags. All
 * of that is non-empty as a string, which is what lets somebody share a PAR
 * with nothing in it.
 */
export function isParHtmlEmpty(raw: string | null | undefined): boolean {
  return parHtmlToPlainText(raw) === "";
}
