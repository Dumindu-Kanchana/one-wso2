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

// One column spec, because the standalone app has one — copied three times.
// TeamSummary.tsx:163-307, EmployeeReportView.tsx:109-230 and
// ReportChainView.tsx:147-258 declare the same seven columns in the same order,
// and the port had drifted to three different sets under three different sets
// of headers. These are the source's headerNames verbatim; the eighth column is
// the action, whose headerName is "".
export const PAR_RATING_HEADERS = [
  "Employee PAR",
  "360° Feedback",
  "Lead's PAR",
  "Rating",
  "Top 5%/20% Rating",
  "F2F",
] as const;
