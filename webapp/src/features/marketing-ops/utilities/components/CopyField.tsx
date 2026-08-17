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

import { useEffect, useRef, useState } from "react";
import { Box, IconButton, Tooltip, Typography } from "@wso2/oxygen-ui";
import { Check, Copy } from "@wso2/oxygen-ui-icons-react";

// The shared "result" affordance for the utility tools: a read-only monospace
// output box with a copy button. Both generators end in one of these, so the
// thing you came for is always in the same place with the same interaction.
export default function CopyField({
  label,
  value,
  placeholder = "Fill in the fields above…",
}: {
  label: string;
  value: string;
  placeholder?: string;
}) {
  const [copied, setCopied] = useState(false);
  const empty = value.trim().length === 0;

  // Clear the "copied" tick on unmount as well as on the timer, so navigating
  // away mid-flash can't fire setState on an unmounted component.
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function copy() {
    if (empty) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // navigator.clipboard is unavailable on insecure origins and can be
      // blocked by permissions policy. Fall back to the legacy selection copy
      // rather than failing silently — the whole point of the component is
      // getting this string out.
      const ta = document.createElement("textarea");
      ta.value = value;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.75 }}>
        <Typography
          sx={{
            fontSize: 11,
            fontWeight: 700,
            color: "text.secondary",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {label}
        </Typography>
        <Tooltip
          title={empty ? "Nothing to copy yet" : copied ? "Copied" : "Copy"}
          arrow
          placement="left"
        >
          {/* Span wrapper: a disabled IconButton fires no events, so Tooltip
              would never show the "nothing to copy yet" hint without it. */}
          <span>
            <IconButton
              size="small"
              aria-label={`Copy ${label}`}
              disabled={empty}
              onClick={copy}
              sx={{ color: copied ? "success.main" : "primary.main", p: 0.5 }}
            >
              {copied ? <Check size={16} /> : <Copy size={15} />}
            </IconButton>
          </span>
        </Tooltip>
      </Box>
      <Box
        sx={{
          fontFamily: "monospace",
          fontSize: 13,
          wordBreak: "break-all",
          bgcolor: "action.hover",
          border: 1,
          borderColor: "divider",
          borderRadius: 1,
          px: 1.75,
          py: 1.5,
          minHeight: "2.6rem",
          color: empty ? "text.disabled" : "text.primary",
          fontStyle: empty ? "italic" : "normal",
        }}
      >
        {empty ? placeholder : value}
      </Box>
    </Box>
  );
}
