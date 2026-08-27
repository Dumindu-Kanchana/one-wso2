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
  addEvidenceUrl,
  extractDriveId,
  isEvidenceUrl,
  parseEvidenceUrls,
  serializeEvidenceUrls,
} from "@features/par/util/parEvidence";

const DOC = "https://docs.google.com/document/d/1AbC_de-FGh/edit";
const SHEET = "https://docs.google.com/spreadsheets/d/2XyZ/edit#gid=0";

describe("extractDriveId", () => {
  it("takes the id out of a /d/<id>/ URL", () => {
    expect(extractDriveId(DOC)).toBe("1AbC_de-FGh");
    expect(extractDriveId(SHEET)).toBe("2XyZ");
  });

  it("falls back to the URL when there is no id segment", () => {
    // Better a usable key than an empty one: the id is only used to identify
    // the row, and a URL is unique enough for that.
    expect(extractDriveId("https://drive.google.com/open?id=abc")).toBe(
      "https://drive.google.com/open?id=abc",
    );
  });
});

describe("isEvidenceUrl", () => {
  it("accepts Google document links", () => {
    expect(isEvidenceUrl(DOC)).toBe(true);
    expect(isEvidenceUrl("https://drive.google.com/file/d/1a/view")).toBe(true);
    expect(isEvidenceUrl("https://google.com/x")).toBe(true);
  });

  it("refuses anything that is not a link", () => {
    for (const bad of ["", "   ", undefined, null, "my document", "d/1AbC"]) {
      expect(isEvidenceUrl(bad), JSON.stringify(bad)).toBe(false);
    }
  });

  it("refuses http, and hosts that only look like Google", () => {
    // The field's purpose is documents in the company's own Drive.
    expect(isEvidenceUrl("http://docs.google.com/document/d/1a/edit")).toBe(false);
    expect(isEvidenceUrl("https://google.com.evil.example/x")).toBe(false);
    expect(isEvidenceUrl("https://notgoogle.com/x")).toBe(false);
  });
});

describe("parsing the stored list", () => {
  it("reads a newline-separated list", () => {
    const files = parseEvidenceUrls(`${DOC}\n${SHEET}`);
    expect(files.map((f) => f.url)).toEqual([DOC, SHEET]);
    expect(files[0].id).toBe("1AbC_de-FGh");
  });

  it("tolerates carriage returns, blank lines and padding", () => {
    expect(parseEvidenceUrls(`\r\n  ${DOC}  \r\n\r\n`).map((f) => f.url)).toEqual([DOC]);
  });

  it("treats the same document attached twice as one", () => {
    // The source kept both, so a duplicate paste showed as two identical chips.
    expect(parseEvidenceUrls(`${DOC}\n${DOC}`)).toHaveLength(1);
  });

  it("is empty for nothing", () => {
    for (const raw of [undefined, null, "", "\n\n"]) {
      expect(parseEvidenceUrls(raw)).toEqual([]);
    }
  });
});

describe("round-tripping", () => {
  it("returns what it was given", () => {
    const raw = `${DOC}\n${SHEET}`;
    expect(serializeEvidenceUrls(parseEvidenceUrls(raw))).toBe(raw);
  });

  it("drops blanks rather than writing empty lines back", () => {
    expect(serializeEvidenceUrls([{ id: "x", name: "x", url: "   " }])).toBe("");
  });
});

describe("adding a URL", () => {
  it("appends a new one", () => {
    expect(addEvidenceUrl([], DOC).map((f) => f.url)).toEqual([DOC]);
  });

  it("refuses a duplicate, leaving the list as it was", () => {
    const files = parseEvidenceUrls(DOC);
    expect(addEvidenceUrl(files, DOC)).toHaveLength(1);
    expect(addEvidenceUrl(files, `  ${DOC}  `)).toHaveLength(1);
  });

  it("ignores an empty addition", () => {
    expect(addEvidenceUrl([], "   ")).toEqual([]);
  });

  it("does not mutate the list it was given", () => {
    const files = parseEvidenceUrls(DOC);
    addEvidenceUrl(files, SHEET);
    expect(files).toHaveLength(1);
  });
});
