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
// Employment status → chip label and colour.
//
// Same idiom as the finance and leave chips: a lookup with an explicit fallback,
// so a status the backend adds later renders as itself in a neutral chip rather
// than crashing or vanishing.

export type StatusChipColor = "success" | "warning" | "error" | "default";

const STATUS_META: Record<string, { label: string; color: StatusChipColor }> = {
  active: { label: "Active", color: "success" },
  "marked leaver": { label: "Marked leaver", color: "warning" },
  left: { label: "Left", color: "error" },
};

export function employeeStatusMeta(status: string | null | undefined): {
  label: string;
  color: StatusChipColor;
} {
  if (typeof status !== "string" || status.trim() === "") {
    return { label: "—", color: "default" };
  }
  const key = status.trim().toLowerCase();
  // `hasOwn`, not `in`: `in` also matches inherited names like "toString" and
  // "constructor", which would resolve to a function off the prototype instead
  // of falling through to the neutral chip below.
  return Object.hasOwn(STATUS_META, key)
    ? STATUS_META[key]
    : { label: status, color: "default" };
}
