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

import { Box, DataGrid, Tooltip } from "@wso2/oxygen-ui";

/**
 * Everything v8's `showToolbar` gives, except the export buttons.
 *
 * For the three transaction grids. The source gives those a quick filter and
 * nothing else — each builds its own toolbar containing only
 * `GridToolbarQuickFilter` (NewTransactions / PendingTransactions /
 * ApproveTransactions DataGrid.tsx). Export appears on exactly two of its
 * five grids: submission-history, and the statement screen through the
 * all-in-one `GridToolbar`.
 *
 * So export is withheld here deliberately — these three show either other
 * people's card spend or transactions nobody has submitted yet, and v8's
 * default toolbar would hand out a CSV of all of it purely because the button
 * ships with the component. The column and filter panels are kept, which is
 * more than the source offers and costs nothing.
 */
export function ToolbarNoExport() {
  return (
    <DataGrid.Toolbar>
      <Tooltip title="Columns">
        <DataGrid.ColumnsPanelTrigger render={<DataGrid.ToolbarButton aria-label="Columns" />}>
          <DataGrid.GridColumnIcon fontSize="small" />
        </DataGrid.ColumnsPanelTrigger>
      </Tooltip>
      <Tooltip title="Filters">
        <DataGrid.FilterPanelTrigger render={<DataGrid.ToolbarButton aria-label="Filters" />}>
          <DataGrid.GridFilterListIcon fontSize="small" />
        </DataGrid.FilterPanelTrigger>
      </Tooltip>
      <Box sx={{ flex: 1 }} />
      <DataGrid.GridToolbarQuickFilter />
    </DataGrid.Toolbar>
  );
}

