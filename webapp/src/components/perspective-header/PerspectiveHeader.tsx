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

import { Chip, Typography } from "@wso2/oxygen-ui";
import type { ReactNode } from "react";

export interface PerspectiveHeaderProps {
  // Shown in the "✦ " eyebrow chip above the title, e.g. "Finance perspective".
  eyebrow: string;
  title: ReactNode;
  subtitle?: ReactNode;
}

// The eyebrow chip + title + subtitle every perspective/placeholder page
// opens with (People Ops, Finance, Workspace, My Team, ...). Consolidates
// what was a hand-copied block with the same hardcoded sizes on each page.
export default function PerspectiveHeader({ eyebrow, title, subtitle }: PerspectiveHeaderProps) {
  return (
    <>
      <Chip
        label={`✦ ${eyebrow}`}
        color="primary"
        size="small"
        sx={{ mb: 0.5, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}
      />
      <Typography sx={{ fontSize: 23, fontWeight: 700, letterSpacing: "-0.02em", mb: 0.5 }}>
        {title}
      </Typography>
      {subtitle && (
        <Typography sx={{ fontSize: 13, color: "text.secondary", mb: 2.25, maxWidth: "68ch" }}>
          {subtitle}
        </Typography>
      )}
    </>
  );
}
