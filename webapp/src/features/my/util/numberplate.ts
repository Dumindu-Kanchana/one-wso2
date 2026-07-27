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

// Sri Lankan license-plate helpers. Mirrors
// people-ops-suite/apps/people-app/microapp/src/utils/helpers/numberplate.ts —
// same logic so both frontends normalize identically before hitting the
// backend's @constraint:String pattern (which requires a SPACE separator,
// not a dash).

export type Validity = "VALID" | "UNCERTAIN" | "INVALID";

const FULL_THREE_LETTER = /^[A-Z]{3}[- ]?\d{4}$/;
const FULL_TWO_LETTER = /^[A-Z]{2}[- ]?\d{4}$/;
const FULL_SRI = /^\d{1,3}([- ]?)SRI\1\d{4}$/i;
const FULL_NUMERIC = /^\d{2}[- ]\d{4}$/;
const FULL_E_FORMAT = /^E[- ]?\d{4}$/;
const FULL_THREE_DIGIT_FORMAT = /^\d{3}[- ]?\d{4}$/;

const PARTIAL_THREE_LETTER = /^[A-Z]{1,3}([- ]?\d{0,4})?$/;
const PARTIAL_TWO_LETTER = /^[A-Z]{0,2}[- ]?\d{0,4}$/;
const PARTIAL_SRI = /^.*S.*$/i;
const PARTIAL_NUMERIC = /^(\d{0,2}[- ]\d{0,4}|\d{0,2})$/;
const PARTIAL_E_FORMAT = /^E([- ]?\d{0,3})?$/;
const PARTIAL_THREE_DIGIT_FORMAT = /^\d{1,3}([- ]?\d{0,4})?$/;

// Reports whether the input matches any accepted Sri Lankan plate
// format (VALID), could still become one (UNCERTAIN — for use as the
// user is typing), or clearly does not (INVALID).
export function validatePlate(input: string): Validity {
  const normalized = input.trim().toUpperCase();

  if (/^\d+$/.test(normalized) && normalized.length > 7) return "INVALID";
  if (/\d{5,}$/.test(normalized)) return "INVALID";
  if (/^\d{4,}/.test(normalized) && !/^\d{2}[- ]/.test(normalized)) return "INVALID";

  if (FULL_SRI.test(normalized)) return "VALID";
  if (FULL_THREE_DIGIT_FORMAT.test(normalized)) return "VALID";
  if (FULL_E_FORMAT.test(normalized)) return "VALID";
  if (FULL_THREE_LETTER.test(normalized)) return "VALID";
  if (FULL_TWO_LETTER.test(normalized)) return "VALID";
  if (FULL_NUMERIC.test(normalized)) return "VALID";

  if (PARTIAL_SRI.test(normalized)) return "UNCERTAIN";
  if (PARTIAL_THREE_DIGIT_FORMAT.test(normalized)) return "UNCERTAIN";
  if (PARTIAL_E_FORMAT.test(normalized)) return "UNCERTAIN";
  if (PARTIAL_THREE_LETTER.test(normalized)) return "UNCERTAIN";
  if (PARTIAL_TWO_LETTER.test(normalized)) return "UNCERTAIN";
  if (PARTIAL_NUMERIC.test(normalized)) return "UNCERTAIN";

  return "INVALID";
}

// Normalizes user input to the canonical backend format (single space
// separator, uppercase). "CAA-1111" → "CAA 1111"; "aaa1234" → "AAA 1234";
// "123SRI4567" → "123 SRI 4567" (SRI-format plates preserve the SRI token
// — earlier versions of this helper stripped it silently, which saved a
// semantically different plate). If no pattern matches, returns the
// uppercased/collapsed input as-is so the backend rejects it (rather than
// us mangling it further).
export function formatPlate(input: string): string {
  const normalized = input.trim().toUpperCase().replace(/[- ]+/g, " ");
  const parts = normalized.split(" ");

  const sriMatch =
    normalized.match(/^(\d{1,3})\s*SRI\s*(\d{4})$/) ||
    normalized.match(/^(\d{1,3})SRI(\d{4})$/) ||
    normalized.match(/^(\d{1,3})[- ]?SRI[- ]?(\d{4})$/i);
  if (sriMatch) return `${sriMatch[1]} SRI ${sriMatch[2]}`;

  if (/^[A-Z]{2,3}\d{4}$/.test(normalized))
    return `${normalized.slice(0, -4)} ${normalized.slice(-4)}`;

  if (/^\d{2} \d{4}$/.test(normalized)) return normalized;

  const alphaNumMatch = normalized.match(/^([A-Z]{2,3})(\d{4})$/);
  if (alphaNumMatch) return `${alphaNumMatch[1]} ${alphaNumMatch[2]}`;

  if (
    parts.length === 2 &&
    /^[A-Z]{1,3}$/.test(parts[0]) &&
    /^\d{4}$/.test(parts[1])
  )
    return `${parts[0]} ${parts[1]}`;

  return normalized;
}
