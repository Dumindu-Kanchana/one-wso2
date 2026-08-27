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


import { Box, LinearProgress, Stack, Typography } from "@wso2/oxygen-ui";
import type { JSX } from "react";
import { completionPercent } from "../util/parTeamSummary";

// One stage's progress across a team.
//
// The percentage comes from `completionPercent`, which returns 0 for an empty
// team rather than NaN — the source divided by zero and handed the result
// straight to the bar.
export default function ParCompletionBar({
  label,
  completed,
  total,
}: {
  label: string;
  completed: number;
  total: number;
}): JSX.Element {
  const percent = completionPercent(completed, total);
  const nothingToDo = total <= 0;

  return (
    <Box sx={{ minWidth: 180, flex: 1 }}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "baseline" }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
          {label}
        </Typography>
        {/* "N Pending", which is how the standalone app labels these. An
            earlier version here showed "3 / 4" — arguably clearer, but a visible
            difference from the app people use, and not worth introducing
            silently. If the ratio is wanted it should be proposed on its own. */}
        <Typography variant="caption" sx={{ fontVariantNumeric: "tabular-nums" }}>
          {nothingToDo ? "—" : `${Math.max(0, total - completed)} pending`}
        </Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={percent}
        // Announced so the figure is available without seeing the bar.
        // The ratio stays in the accessible name: it is not visual clutter there,
      // and "3 pending" alone does not say pending out of how many.
      aria-label={`${label}: ${nothingToDo ? "nothing to do" : `${completed} of ${total} done`}`}
        sx={{ height: 8, borderRadius: 1, mt: 0.5 }}
      />
    </Box>
  );
}
