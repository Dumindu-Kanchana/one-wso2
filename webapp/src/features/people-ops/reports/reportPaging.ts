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

// Pager arithmetic for the report table. Pulled out of the component so the
// off-by-one-prone parts — the 1-based range label, the last-page boundary —
// are testable without mounting a table and stubbing a backend.

export interface PageState {
  /** 0-based page index. */
  page: number;
  pageSize: number;
  /** Rows actually returned for this page. */
  rowCount: number;
  /** Total matching rows, or null while unknown. */
  totalCount: number | null;
}

export interface PageView {
  pageCount: number;
  /** 1-based row number of the first row on this page. */
  firstRowNumber: number;
  /** 1-based row number of the last row on this page. */
  lastRowNumber: number;
  canPrev: boolean;
  canNext: boolean;
  /** Range label, e.g. "11–20 of 57", or null when there is nothing to show. */
  rangeLabel: string | null;
}

export function pageView({ page, pageSize, rowCount, totalCount }: PageState): PageView {
  // Floor at 1 so an empty result set reads "1 of 1" internally rather than
  // "1 of 0"; the range label below is what actually reports emptiness.
  const pageCount = Math.max(1, Math.ceil((totalCount ?? 0) / pageSize));
  const firstRowNumber = page * pageSize + 1;
  const lastRowNumber = page * pageSize + rowCount;
  const isEmpty = rowCount === 0 || totalCount === 0;

  return {
    pageCount,
    firstRowNumber,
    lastRowNumber,
    canPrev: page > 0,
    // Requires BOTH a further page by the count and a full page of rows.
    // The row-count half is what stops a stale totalCount from offering a
    // next page that comes back empty.
    canNext: page + 1 < pageCount && rowCount === pageSize,
    rangeLabel: isEmpty
      ? null
      : `${firstRowNumber}–${lastRowNumber} of ${totalCount ?? "?"}`,
  };
}
