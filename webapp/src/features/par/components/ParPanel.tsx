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


import { Box } from "@wso2/oxygen-ui";
import type { JSX, ReactNode } from "react";

// One frame per screen, holding its sections.
//
// PAR's screens used to be a stack of independently bordered cards — six of them
// on the lead's review screen. Six borders and six gutters where the standalone
// app has one frame, which is most of why the port read as loose beside it, and
// worse with sparse data: six mostly-empty cards look like a page of unrelated
// notices, where one empty table still looks like a table.
//
// The frame is the border; sections inside it are separated by a hairline. The
// divider is applied from HERE rather than by each section, because only the
// parent knows which child is first — a section cannot see its own position, and
// `:first-of-type` breaks the moment a section is wrapped in anything.
//
// Deliberately NOT the standalone app's fixed `height: calc(100vh - 150px)` with
// `minWidth: 1200px`. That is what makes it feel like an application window, but
// it also makes a laptop scroll sideways and gives long content nowhere to go.
// The frame supplies the density; pinning the height would only add the problems.
export default function ParPanel({ children }: { children: ReactNode }): JSX.Element {
  return (
    <Box
      sx={{
        border: 1,
        borderColor: "divider",
        borderRadius: 1.5,
        bgcolor: "background.paper",
        // Clips the children's corners to the frame's radius.
        overflow: "hidden",
        mb: 2.25,
        "& > * + *": {
          borderTop: 1,
          borderColor: "divider",
        },
      }}
    >
      {children}
    </Box>
  );
}
