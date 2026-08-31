/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { useEffect, useState } from "react";

/**
 * The value, settled — updated only once it has stopped changing for `delay`.
 *
 * For a text filter that feeds a server query: React Query keys on the whole
 * payload, so a raw input value there mints a new key per keystroke and fires a
 * request for every prefix, most of which match nothing. Debouncing the value
 * before it reaches the payload collapses that to one request.
 *
 * setState inside the timeout is fine — it is the synchronous-in-an-effect-body
 * form that cascades renders.
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return settled;
}
