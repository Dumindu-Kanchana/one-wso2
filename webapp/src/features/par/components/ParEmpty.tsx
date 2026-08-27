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


import { Typography } from "@wso2/oxygen-ui";
import type { JSX, ReactNode } from "react";

// "There is nothing here."
//
// It exists because a section's subtitle and its empty state were both
// `body2` / `text.secondary`, left-aligned, one directly under the other:
//
//   Set by a PAR administrator. A rating is refused once its group is used up.
//   No Top 5% / 20% quota has been allocated for your teams in this cycle.
//
// Two grey sentences of identical weight read as one paragraph, and with sparse
// data that pattern repeated on every tab. They are different KINDS of
// statement — one is a standing rule about the section, the other is a report on
// its current contents — so they should not look alike.
//
// Dimmer, centred, and with air around it, matching the treatment the CRM
// upload screens already use for the same job. Written here rather than
// imported from there for the reason given on ParSection: the shared component
// lives inside another feature's screen.
export default function ParEmpty({ children }: { children: ReactNode }): JSX.Element {
  return (
    <Typography
      sx={{
        fontSize: 13,
        // text.disabled, not text.secondary: this is the absence of content,
        // and it should recede rather than compete with the section's own prose.
        color: "text.disabled",
        textAlign: "center",
        py: 4,
      }}
    >
      {children}
    </Typography>
  );
}
