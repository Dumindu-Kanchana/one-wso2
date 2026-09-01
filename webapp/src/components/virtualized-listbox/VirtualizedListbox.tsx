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

// Drop-in `ListboxComponent` for MUI's `<Autocomplete>` that windows the
// option list with react-window instead of mounting every filtered option
// as a real DOM node. Ported from digiops-hr's leave microapp
// (apps/leave/microapp/src/components/NotifyPeople.js), which is why typing
// into that app's "notify people" search stays responsive against the full
// employee directory while this webapp's plain (non-virtualized)
// Autocomplete visibly falls behind the same data on every keystroke —
// MUI still re-filters the whole array per keystroke either way, but
// without this, it also re-renders every matching <li> into the DOM each
// time, and that's the part that was blocking the main thread.
//
// MUI passes the already-rendered <li> elements (one per filtered option,
// from the default or a custom `renderOption`) as `children`. We don't
// need to know anything about their content — just clone each one with an
// absolute-position `style` so react-window can render only the ~8 rows
// actually visible in the dropdown.

import {
  Children,
  cloneElement,
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useRef,
  type CSSProperties,
  type HTMLAttributes,
  type ReactElement,
} from "react";
import { VariableSizeList, type ListChildComponentProps } from "react-window";

const LISTBOX_PADDING = 8; // px — matches MUI's default Listbox padding.

// One row, measured rather than assumed. An option here is a photo beside a
// name with the address under it, and MUI's line-heights are unitless
// multipliers, so the height is the same whatever face the theme loads:
//
//   body2   14px x 1.43 = 20.02   (the name)
//   caption 12px x 1.66 = 19.92   (the address, and any status chip, which is
//                                  16px and sits inside that line box)
//   padding 6px + 6px   = 12      (.MuiAutocomplete-option, Autocomplete.js:352-357)
//                         -----
//                         51.94   -> 52
//
// The 32px avatar is shorter than the two lines, so it never sets the height.
// This was 36, which is one line's worth: every row overflowed its slot by 16px,
// and with eight of them the list collapsed into an unreadable band.
const ITEM_SIZE = 52;
const MAX_VISIBLE_ROWS = 8;

// MUI caps the listbox at 40vh (Autocomplete.js:341). Asking react-window for
// more than that leaves it scrolling a viewport taller than the box it is
// painted in, so the two are kept in agreement.
const MUI_LISTBOX_MAX_VH = 0.4;

// Each child is one MUI-rendered <li>; only `style` is set on the clone
// (for absolute positioning), so that's all the element type needs to admit.
type OptionElement = ReactElement<{ style?: CSSProperties }>;

const OuterElementContext = createContext<HTMLAttributes<HTMLDivElement>>({});

const OuterElementType = forwardRef<HTMLDivElement>(function OuterElementType(props, ref) {
  const outerProps = useContext(OuterElementContext);
  return <div ref={ref} {...props} {...outerProps} />;
});

// react-window caches row measurements; when the option count changes
// (every keystroke, effectively) the cache must be dropped or stale rows
// get reused at the wrong position.
function useResetCache(itemCount: number) {
  const listRef = useRef<VariableSizeList>(null);
  useEffect(() => {
    listRef.current?.resetAfterIndex(0, true);
  }, [itemCount]);
  return listRef;
}

function renderRow({ data, index, style }: ListChildComponentProps<OptionElement[]>) {
  const option = data[index];
  return cloneElement(option, {
    style: { ...style, top: (style.top as number) + LISTBOX_PADDING },
  });
}

// Cast to the loose `HTMLAttributes<HTMLElement>` shape Autocomplete's
// `ListboxComponent` prop expects — the real children are cloned React
// elements, not a general `ReactNode`, but that's an implementation detail
// callers of `ListboxComponent` don't type-check against.
const VirtualizedListbox = forwardRef<HTMLDivElement, HTMLAttributes<HTMLElement>>(
  function VirtualizedListbox(props, ref) {
    const { children, ...other } = props;
    const itemData = Children.toArray(children) as OptionElement[];
    const itemCount = itemData.length;
    const listRef = useResetCache(itemCount);

    const rowsHeight = Math.min(itemCount, MAX_VISIBLE_ROWS) * ITEM_SIZE + 2 * LISTBOX_PADDING;
    const height = Math.min(
      rowsHeight,
      Math.round((globalThis.window?.innerHeight ?? 0) * MUI_LISTBOX_MAX_VH) || rowsHeight,
    );

    return (
      <div ref={ref}>
        <OuterElementContext.Provider value={other}>
          <VariableSizeList
            itemData={itemData}
            height={height}
            width="100%"
            ref={listRef}
            outerElementType={OuterElementType}
            innerElementType="ul"
            itemSize={() => ITEM_SIZE}
            overscanCount={5}
            itemCount={itemCount}
          >
            {renderRow}
          </VariableSizeList>
        </OuterElementContext.Provider>
      </div>
    );
  },
);

export default VirtualizedListbox;
