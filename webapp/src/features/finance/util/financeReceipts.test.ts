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

const reply = { status: 201, body: "" as string };

vi.mock("@api/http", async () => {
  const actual = await vi.importActual<typeof import("@api/http")>("@api/http");
  return {
    ...actual,
    fetchWithReauth: async () => ({
      ok: reply.status >= 200 && reply.status < 300,
      status: reply.status,
      text: async () => reply.body,
    }),
  };
});

const { fetchBase64Attachment, putBinaryFile } = await import("./financeReceipts");

beforeEach(() => {
  reply.status = 201;
  reply.body = "";
});

const upload = () =>
  putBinaryFile("https://x/attachments", "token", new File(["a"], "r.pdf", { type: "application/pdf" }));

/**
 * cc-expenses returns the stored name as the response body in plain text —
 * `record {| *http:Created; string body; |}` (backend types.bal:107-110), where
 * `body` IS the payload. Parsing it as JSON threw on every successful upload,
 * so a 201 was shown to the user as "something went wrong".
 */
describe("reading back the stored attachment name", () => {
  it("takes a plain-text body, which is what cc-expenses sends", async () => {
    reply.body = "receipt_123.pdf";
    await expect(upload()).resolves.toBe("receipt_123.pdf");
  });

  it("ignores surrounding whitespace", async () => {
    reply.body = "  receipt_123.pdf\n";
    await expect(upload()).resolves.toBe("receipt_123.pdf");
  });

  it("still takes a wrapped {body}, which the other finance backends send", async () => {
    reply.body = JSON.stringify({ body: "receipt_123.pdf" });
    await expect(upload()).resolves.toBe("receipt_123.pdf");
  });

  it("still takes a wrapped {fileName}", async () => {
    reply.body = JSON.stringify({ fileName: "receipt_123.pdf" });
    await expect(upload()).resolves.toBe("receipt_123.pdf");
  });

  it("takes a bare JSON string", async () => {
    reply.body = JSON.stringify("receipt_123.pdf");
    await expect(upload()).resolves.toBe("receipt_123.pdf");
  });

  it("refuses an empty body rather than storing a name that fetches nothing", async () => {
    reply.body = "";
    await expect(upload()).rejects.toThrow();
  });

  it("refuses a shape with no name in it", async () => {
    reply.body = JSON.stringify({ message: "created" });
    await expect(upload()).rejects.toThrow();
  });

  it("still fails on a real error status", async () => {
    reply.status = 500;
    reply.body = "boom";
    await expect(upload()).rejects.toThrow();
  });
});

/**
 * Fetching one back. The cc backend returns the base64 as the payload itself
 * — `record {| *http:Ok; string body; |}` with `{body: fileContent.toBase64()}`
 * (service.bal:592). Base64 is not JSON, so reading it as JSON threw on every
 * successful download.
 */
describe("fetching an attachment back", () => {
  // "%PDF" — sniffBase64Type keys off this prefix.
  const PDF_B64 = "JVBERi0xLjQKJeLjz9MK";

  const fetchOne = () => fetchBase64Attachment("https://x/attachments", "token");

  it("takes plain-text base64, which is what cc-expenses sends", async () => {
    reply.status = 200;
    reply.body = PDF_B64;
    await expect(fetchOne()).resolves.toEqual({
      url: `data:application/pdf;base64,${PDF_B64}`,
      type: "application/pdf",
    });
  });

  it("still takes a wrapped {body}", async () => {
    reply.status = 200;
    reply.body = JSON.stringify({ body: PDF_B64 });
    await expect(fetchOne()).resolves.toEqual({
      url: `data:application/pdf;base64,${PDF_B64}`,
      type: "application/pdf",
    });
  });

  it("takes an already-formed data URL", async () => {
    reply.status = 200;
    reply.body = `data:application/pdf;base64,${PDF_B64}`;
    await expect(fetchOne()).resolves.toEqual({
      url: `data:application/pdf;base64,${PDF_B64}`,
      type: "application/pdf",
    });
  });

  it("refuses an empty attachment rather than opening a blank viewer", async () => {
    reply.status = 200;
    reply.body = "";
    await expect(fetchOne()).rejects.toThrow();
  });

  it("still coerces a type it will not preview inline", async () => {
    reply.status = 200;
    // An SVG can carry script, so it must not be handed back as image/svg+xml.
    reply.body = "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=";
    const got = await fetchOne();
    expect(got.type).toBe("application/octet-stream");
  });
});
