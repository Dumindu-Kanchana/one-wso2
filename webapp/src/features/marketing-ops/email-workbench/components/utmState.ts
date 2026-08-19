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

// The UTM form state shared by both editor dialogs, in its own module so
// UtmControls.tsx exports only components (React Fast Refresh requirement).

export interface UtmState {
  campaign: string;
  startDate: string;
  source: string;
  medium: string;
  region: string;
  bu: string;
}

// Local date, not toISOString's UTC — otherwise the default shows yesterday or
// tomorrow for anyone far enough from UTC.
export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
