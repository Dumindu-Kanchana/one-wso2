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

// The subject line sent to Pardot, derived from the finished HTML.
//
// Order matters and is deliberate: the template's <title> is what a designer set
// as the email's subject, so it wins; a first heading is the next best guess at
// what the email is about; the template name is the last resort because it's an
// internal asset name, not something a recipient should see.
//
// Lifted out of ExportDialog (where Marketing Ops kept it) so it's importable
// without pulling in a dialog — it's a pure function and the only part of the
// export path worth verifying independently.

export function deriveSubject(html: string, fallback: string): string {
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const title = doc.querySelector("title")?.textContent?.trim();
    if (title) return title;
    const heading = doc.querySelector("h1, h2, h3")?.textContent?.trim();
    if (heading) return heading;
  } catch {
    // A template so malformed that DOMParser throws still deserves a subject —
    // fall through to the name rather than failing the export.
  }
  return fallback.trim();
}
