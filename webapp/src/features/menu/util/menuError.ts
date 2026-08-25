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

// Shared error helpers for the menu feature, re-exported so call sites keep a
// short import — the same arrangement leave and finance use.
//
// `describeError` prefers the server's own `{message}` and never returns a raw
// response body. That matters here: the service explains exactly why a feedback
// submission or a cancellation was refused, and the standalone app threw those
// sentences away in favour of "Try again...".
import { describeError, httpRetry } from "@api/errors";

export { describeError };

/** No retries on 4xx — a closed feedback window is not a transient failure. */
export const menuRetry = httpRetry;
