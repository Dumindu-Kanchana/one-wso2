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

/**
 * Shared look for the finance data grids.
 *
 * The focus outline is the point of this. MUI rings the cell you last clicked,
 * which on a read-only grid reads as "this cell is selected" and means nothing
 * — there is no cell-level action anywhere in these screens. The source app
 * suppresses it globally in its own theme (theme.ts:281-297, for cells, column
 * headers and rows alike); our grids took the library default instead.
 *
 * Keyboard focus is deliberately left visible: `:focus-visible` still rings,
 * so arrow-key navigation through the grid can still be followed. Only the
 * pointer-driven ring goes, which is the one that carries no information.
 */
export const FINANCE_GRID_SX = {
  "& .MuiDataGrid-cell": { fontSize: 12.5 },
  "& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within": { outline: "none" },
  "& .MuiDataGrid-columnHeader:focus, & .MuiDataGrid-columnHeader:focus-within": {
    outline: "none",
  },
  // Both, not just cells: a column header is reachable by keyboard for sorting
  // and its menu, so removing every header ring left that navigation invisible.
  "& .MuiDataGrid-cell:focus-visible": { outline: "auto 1px" },
  "& .MuiDataGrid-columnHeader:focus-visible": { outline: "auto 1px" },
} as const;
