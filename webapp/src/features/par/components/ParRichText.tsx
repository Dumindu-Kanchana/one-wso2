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


import { useEffect, useRef, useState, type JSX } from "react";
import { Box, Divider, Stack, ToggleButton, Tooltip, Typography } from "@wso2/oxygen-ui";
import {
  BoldIcon,
  ItalicIcon,
  ListIcon,
  ListOrderedIcon,
  UnderlineIcon,
} from "@wso2/oxygen-ui-icons-react";
import { parHtmlToPlainText, sanitizeParHtml } from "../util/parHtml";

// The rich-text field a PAR answer is written in.
//
// ---- why this is hand-rolled -------------------------------------------
//
// The source used react-quill, which cannot come with it: react-quill 2 calls
// `ReactDOM.findDOMNode`, and React 19 removed it. The alternatives were a
// maintained fork, a much larger editor, or the five formatting commands the
// stored HTML actually contains. The allow-list in util/parHtml.ts is bold,
// italic, underline, links and the two list kinds — so this is that, and no
// dependency.
//
// ---- why the value is not a controlled prop ----------------------------
//
// Writing `innerHTML` on every render puts the caret back at the start of the
// field on every keystroke. So the DOM owns the text while you type and this
// seeds it once, on mount. A caller showing a DIFFERENT PAR must therefore
// remount it — `key={parRatingId}` — and that key has to be stable while
// editing: keying on anything derived from the draft resets the field mid-word.
//
// `execCommand` is deprecated and has no replacement for this. Every browser
// still implements it, and the alternative is hand-managing Selection ranges.

const COMMANDS = [
  { command: "bold", label: "Bold", icon: BoldIcon },
  { command: "italic", label: "Italic", icon: ItalicIcon },
  { command: "underline", label: "Underline", icon: UnderlineIcon },
] as const;

const LISTS = [
  { command: "insertUnorderedList", label: "Bulleted list", icon: ListIcon },
  { command: "insertOrderedList", label: "Numbered list", icon: ListOrderedIcon },
] as const;

export default function ParRichText({
  initialHtml,
  onChange,
  disabled = false,
  label,
  maxChars,
}: {
  /** Seeded once, on mount. See the note above about remounting. */
  initialHtml: string | null | undefined;
  /** Called with sanitised HTML on every edit. */
  onChange: (html: string) => void;
  disabled?: boolean;
  label: string;
  /** Counted on the readable text, not the markup. */
  maxChars?: number;
}): JSX.Element {
  const ref = useRef<HTMLDivElement | null>(null);
  const [charCount, setCharCount] = useState(() => parHtmlToPlainText(initialHtml).length);
  // Which of bold/italic/underline apply where the caret is, so the buttons
  // reflect the text rather than being write-only.
  const [active, setActive] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Seeding, not syncing — this runs once per mount.
    el.innerHTML = sanitizeParHtml(initialHtml);
    // `initialHtml` is deliberately not a dependency: see the header.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const readState = () => {
    if (disabled) return;
    const next: Record<string, boolean> = {};
    for (const { command } of [...COMMANDS, ...LISTS]) {
      try {
        next[command] = document.queryCommandState(command);
      } catch {
        // Not every environment implements queryCommandState; an unknown state
        // is better than a crash while typing.
        next[command] = false;
      }
    }
    setActive(next);
  };

  const emit = () => {
    const el = ref.current;
    if (!el) return;
    const clean = sanitizeParHtml(el.innerHTML);
    setCharCount(parHtmlToPlainText(clean).length);
    onChange(clean);
  };

  const run = (command: string) => {
    if (disabled) return;
    // The field must hold focus or the command applies to nothing.
    ref.current?.focus();
    try {
      document.execCommand(command);
    } catch {
      // Deprecated API: if it ever stops working the field still takes plain
      // typing, which is the part that matters.
    }
    readState();
    emit();
  };

  const overLimit = maxChars !== undefined && charCount > maxChars;

  return (
    <Box>
      <Stack
        direction="row"
        spacing={0.5}
        sx={{ mb: 0.75, alignItems: "center", flexWrap: "wrap", rowGap: 0.5 }}
      >
        {[...COMMANDS, null, ...LISTS].map((item, i) =>
          item === null ? (
            <Divider key={`sep-${i}`} orientation="vertical" flexItem sx={{ mx: 0.5 }} />
          ) : (
            <Tooltip key={item.command} title={item.label}>
              <ToggleButton
                value={item.command}
                selected={Boolean(active[item.command])}
                disabled={disabled}
                size="small"
                // Buttons in a toolbar, not form controls: mousedown rather
                // than click, so the field never loses its selection before the
                // command runs.
                onMouseDown={(e) => {
                  e.preventDefault();
                  run(item.command);
                }}
                aria-label={item.label}
                sx={{ border: 0, p: 0.6 }}
              >
                <item.icon size={16} />
              </ToggleButton>
            </Tooltip>
          ),
        )}
      </Stack>

      <Box
        ref={ref}
        contentEditable={!disabled}
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={label}
        aria-disabled={disabled || undefined}
        onInput={emit}
        onKeyUp={readState}
        onMouseUp={readState}
        onFocus={readState}
        onPaste={(e) => {
          // Pasting from a document or a web page carries markup and styles
          // that the allow-list would strip on save anyway. Cleaning it here
          // means what you see in the field is what gets stored.
          e.preventDefault();
          const html = e.clipboardData.getData("text/html");
          const text = e.clipboardData.getData("text/plain");
          const clean = html ? sanitizeParHtml(html) : escapeAsHtml(text);
          try {
            document.execCommand("insertHTML", false, clean);
          } catch {
            document.execCommand("insertText", false, text);
          }
          emit();
        }}
        sx={{
          minHeight: 160,
          maxHeight: 420,
          overflowY: "auto",
          p: 1.5,
          border: 1,
          borderColor: overLimit ? "error.main" : "divider",
          borderRadius: 1.5,
          bgcolor: disabled ? "action.disabledBackground" : "background.paper",
          color: disabled ? "text.disabled" : "text.primary",
          fontSize: 14,
          lineHeight: 1.65,
          overflowWrap: "anywhere",
          "& p": { my: 1 },
          "& p:first-of-type": { mt: 0 },
          "& ul, & ol": { my: 1, pl: 3 },
          '& li[data-list="bullet"]': { listStyleType: "disc" },
          "&:focus-visible": {
            outline: 2,
            outlineStyle: "solid",
            outlineColor: "primary.main",
            outlineOffset: 1,
          },
        }}
      />

      {maxChars !== undefined && (
        <Typography
          variant="caption"
          color={overLimit ? "error" : "text.secondary"}
          sx={{ display: "block", mt: 0.5, textAlign: "right" }}
          // Announced on change so someone who cannot see the counter still
          // learns they have gone over.
          aria-live="polite"
        >
          {charCount.toLocaleString()} / {maxChars.toLocaleString()}
        </Typography>
      )}
    </Box>
  );
}

/** Plain text pasted into an HTML field, with its own markup neutralised. */
function escapeAsHtml(text: string): string {
  const host = document.createElement("div");
  host.textContent = text;
  return host.innerHTML.replace(/\n/g, "<br>");
}
