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

// The current selection in the Advanced editor — shared between the editor (which
// owns the state) and the inspector panel (which renders it). One variant per
// editable thing, so the inspector can't render controls for a shape that isn't
// selected. Ported from Marketing Ops' editorTypes.ts.

export type Sel =
  // rich = in-place editing of a whole text block (paragraph / heading) or list.
  // The user edits the live element via contentEditable, so inline formatting is
  // preserved and B/I/U apply to the current selection. `id` is the editable element.
  | {
      kind: "rich";
      id: string;
      isList: boolean;
      bold: boolean;
      italic: boolean;
      underline: boolean;
      hasMerge: boolean;
      linked?: boolean;
      linkHref?: string;
    }
  // A link is a plain text link UNLESS it carries a button variant class — then
  // `btnId` (its containing cell, which holds the bgcolor) and `variant` (the
  // current approved colour) are set and the inspector offers the colour picker.
  | {
      kind: "link";
      id: string;
      href: string;
      text: string;
      textOnly: boolean;
      btnId?: string;
      variant?: string;
    }
  | { kind: "image"; id: string; src: string; alt: string; linkId?: string; href?: string }
  // spacer = an empty vertical-gap block (font-size:0); only its height is editable.
  | { kind: "spacer"; id: string; size: string };
