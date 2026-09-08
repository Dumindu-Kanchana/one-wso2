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
 * Of the source's five grids only submission-history offers export
 * (GridToolbarExport, submission-history/index.tsx:53). The other four show
 * either other people's card spend or transactions not yet submitted, and the
 * default toolbar would hand out a one-click CSV of all of it purely because
 * the button ships with the component.
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

