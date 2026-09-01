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

// Claims: one entry holding both kinds of thing you file for yourself, where
// there used to be four — New Claim and Claim History, twice over.
//
// No role gate. Filing a claim and reading your own history are open to
// everyone; only deciding other people's is restricted, and that lives in
// Finance → Claim approval.

export const CLAIMS_PATH = "/me/claims";

export interface ClaimTypeDef {
  /** URL segment under CLAIMS_PATH, and the tab's identity. */
  segment: "expense" | "opd";
  /** The tab. */
  label: string;
  /** The Add-claim menu entry. */
  menuLabel: string;
  /**
   * One line saying what this type is for, shown in the menu.
   *
   * The two are easy to confuse and go to different people under different
   * rules, so the choice is explained where it is made rather than in a
   * separate step someone has to dismiss.
   */
  menuDescription: string;
  /** Where the form lives. Its own route: both forms are long and hold a draft. */
  newClaimPath: string;
}

export const CLAIM_TYPES: readonly ClaimTypeDef[] = [
  {
    segment: "opd",
    label: "OPD claims",
    menuLabel: "OPD claim",
    menuDescription: "Medical bills, against this year's allowance.",
    newClaimPath: `${CLAIMS_PATH}/opd/new`,
  },
  {
    segment: "expense",
    label: "Expense claims",
    menuLabel: "Expense claim",
    menuDescription: "Money you spent out of pocket. Any currency, converted to yours.",
    newClaimPath: `${CLAIMS_PATH}/expense/new`,
  },
] as const;

/** Where a type's list lives — the tab a finished claim lands back on. */
export function claimTabPath(segment: ClaimTypeDef["segment"]): string {
  return `${CLAIMS_PATH}/${segment}`;
}

/**
 * The tab to open on — the first one, so the default and the tab order cannot
 * disagree. A default sitting second reads as a bug rather than a choice.
 *
 * Deliberately not "the tab you used last": two people describing this screen
 * to each other should be looking at the same thing.
 */
export const DEFAULT_CLAIM_TAB = CLAIM_TYPES[0];
