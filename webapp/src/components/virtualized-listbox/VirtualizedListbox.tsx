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
const ITEM_SIZE = 36; // px — one row at Autocomplete size="small".
const MAX_VISIBLE_ROWS = 8;

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

    return (
      <div ref={ref}>
        <OuterElementContext.Provider value={other}>
          <VariableSizeList
            itemData={itemData}
            height={Math.min(itemCount, MAX_VISIBLE_ROWS) * ITEM_SIZE + 2 * LISTBOX_PADDING}
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
