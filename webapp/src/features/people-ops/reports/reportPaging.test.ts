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
import { pageView } from "@features/people-ops/reports/reportPaging";
import { employeeDetailPath } from "@features/people-ops/reports/reportRoutes";

describe("pageView", () => {
  it("numbers rows from 1, not from the offset", () => {
    const view = pageView({ page: 1, pageSize: 10, rowCount: 10, totalCount: 57 });
    expect(view.firstRowNumber).toBe(11);
    expect(view.lastRowNumber).toBe(20);
    expect(view.rangeLabel).toBe("11–20 of 57");
  });

  it("reports a short final page by its real row count", () => {
    // 57 rows, 10 per page → last page holds 7.
    const view = pageView({ page: 5, pageSize: 10, rowCount: 7, totalCount: 57 });
    expect(view.rangeLabel).toBe("51–57 of 57");
    expect(view.canNext).toBe(false);
    expect(view.canPrev).toBe(true);
  });

  it("stops at the last page even when the count says otherwise", () => {
    // A stale totalCount claims more pages, but a short page means there is
    // nothing further to fetch — offering Next here lands on an empty page.
    const view = pageView({ page: 0, pageSize: 10, rowCount: 4, totalCount: 999 });
    expect(view.canNext).toBe(false);
  });

  it("allows Next while pages are full and the count agrees", () => {
    const view = pageView({ page: 0, pageSize: 10, rowCount: 10, totalCount: 57 });
    expect(view.canNext).toBe(true);
    expect(view.canPrev).toBe(false);
  });

  it("reports no range at all when nothing matched", () => {
    const view = pageView({ page: 0, pageSize: 10, rowCount: 0, totalCount: 0 });
    expect(view.rangeLabel).toBeNull();
    // Never "1 of 0".
    expect(view.pageCount).toBe(1);
    expect(view.canNext).toBe(false);
    expect(view.canPrev).toBe(false);
  });

  it("divides pages by ceiling, not by truncation", () => {
    // 21 rows at 10 per page is 3 pages, not 2.
    expect(pageView({ page: 0, pageSize: 10, rowCount: 10, totalCount: 21 }).pageCount).toBe(3);
    expect(pageView({ page: 0, pageSize: 10, rowCount: 10, totalCount: 20 }).pageCount).toBe(2);
  });

  it("allows Next on a full page when the total is unknown", () => {
    // pageCount floors at 1 when totalCount is null, so requiring the count
    // to agree stranded callers on page 1 for that whole response shape. A
    // full page is enough evidence on its own.
    expect(pageView({ page: 0, pageSize: 10, rowCount: 10, totalCount: null }).canNext).toBe(
      true,
    );
    // A short page still ends paging, count or no count.
    expect(pageView({ page: 0, pageSize: 10, rowCount: 4, totalCount: null }).canNext).toBe(
      false,
    );
  });

  it("handles an unknown total without rendering 'undefined'", () => {
    const view = pageView({ page: 0, pageSize: 10, rowCount: 10, totalCount: null });
    expect(view.rangeLabel).toBe("1–10 of ?");
  });

  it("scales offsets with the page size", () => {
    const view = pageView({ page: 2, pageSize: 50, rowCount: 50, totalCount: 500 });
    expect(view.firstRowNumber).toBe(101);
    expect(view.lastRowNumber).toBe(150);
  });
});

describe("employeeDetailPath", () => {
  it("builds the detail route for an employee", () => {
    expect(employeeDetailPath("WSO2-123")).toBe("/people-ops/employees/WSO2-123");
  });

  it("escapes ids so a reserved character can't break the route", () => {
    expect(employeeDetailPath("a/b?c")).toBe("/people-ops/employees/a%2Fb%3Fc");
  });
});
