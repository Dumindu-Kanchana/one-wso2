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


import { Box, Typography } from "@wso2/oxygen-ui";
import type { JSX } from "react";
import { isParHtmlEmpty, sanitizeParHtml } from "../util/parHtml";

// Renders the rich text stored in a PAR field — an answer, a lead's review, a
// 360 comment.
//
// The one place `dangerouslySetInnerHTML` is used in this feature, and it is
// fed only by sanitizeParHtml. Sanitising here rather than trusting the
// backend: this content was authored by another employee and stored years of
// clients ago.
export default function ParHtml({
  html,
  emptyText = "Nothing written.",
}: {
  html: string | null | undefined;
  /** Shown instead of an empty box, so a blank field never reads as a bug. */
  emptyText?: string;
}): JSX.Element {
  if (isParHtmlEmpty(html)) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
        {emptyText}
      </Typography>
    );
  }

  return (
    <Box
      // Typography for content we do not control: the tags come from the
      // author, so the styling has to cover all of them rather than assume a
      // shape. Margins are collapsed at the edges so the block sits flush in a
      // panel.
      sx={{
        fontSize: 14,
        lineHeight: 1.65,
        color: "text.primary",
        "& p": { my: 1 },
        "& p:first-of-type": { mt: 0 },
        "& p:last-of-type": { mb: 0 },
        "& ul, & ol": { my: 1, pl: 3 },
        "& li": { mb: 0.25 },
        // The source's editor writes bullets as <ol><li data-list="bullet">, so
        // without this they render as numbers on content it authored.
        '& li[data-list="bullet"]': { listStyleType: "disc" },
        "& a": { color: "primary.main", textDecoration: "underline" },
        // Long unbroken strings — a pasted URL — must not widen the panel.
        overflowWrap: "anywhere",
      }}
      dangerouslySetInnerHTML={{ __html: sanitizeParHtml(html) }}
    />
  );
}
