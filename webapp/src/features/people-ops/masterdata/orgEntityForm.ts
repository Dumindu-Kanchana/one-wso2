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

// Validation and change-diffing for the org entity dialog.
//
// People App does this with formik + Yup; neither is a dependency here, and
// for three fields they would not earn their weight. Keeping the rules as
// plain functions also makes them testable without mounting the dialog —
// which matters, because the PATCH-diffing below is the part that would
// silently send a wrong payload.

import type {
  CreateOrgChartEntityPayload,
  OrgChartEntity,
  UpdateOrgChartEntityPayload,
} from "../api/peopleOpsTypes";

/** Backend column limits — a longer value is rejected server-side. */
export const NAME_MAX_LENGTH = 45;
export const HEAD_EMAIL_MAX_LENGTH = 254;

export interface OrgEntityFormState {
  name: string;
  headEmail: string;
  isActive: boolean;
}

export interface OrgEntityFormErrors {
  name?: string;
  headEmail?: string;
}

// Deliberately permissive: it rejects what is obviously not an address while
// leaving the real verdict to the backend, which validates against its own
// EMAIL_PATTERN. A stricter client-side regex would reject valid addresses
// the backend accepts, which is the worse failure of the two.
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateOrgEntityForm(form: OrgEntityFormState): OrgEntityFormErrors {
  const errors: OrgEntityFormErrors = {};

  const name = form.name.trim();
  if (!name) {
    errors.name = "Name is required.";
  } else if (name.length > NAME_MAX_LENGTH) {
    errors.name = `Name must be ${NAME_MAX_LENGTH} characters or fewer.`;
  }

  // Optional: an entity may have no head yet.
  const headEmail = form.headEmail.trim();
  if (headEmail) {
    if (headEmail.length > HEAD_EMAIL_MAX_LENGTH) {
      errors.headEmail = `Email must be ${HEAD_EMAIL_MAX_LENGTH} characters or fewer.`;
    } else if (!EMAIL_SHAPE.test(headEmail)) {
      errors.headEmail = "Enter a valid email address.";
    }
  }

  return errors;
}

export function hasErrors(errors: OrgEntityFormErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** The form state an entity starts from — or a blank one when creating. */
export function initialFormState(entity?: OrgChartEntity | null): OrgEntityFormState {
  return {
    name: entity?.name ?? "",
    headEmail: entity?.headEmail ?? "",
    // A new entity is active; there is no reason to create a dormant one.
    isActive: entity?.isActive ?? true,
  };
}

export function toCreatePayload(form: OrgEntityFormState): CreateOrgChartEntityPayload {
  const headEmail = form.headEmail.trim();
  return {
    name: form.name.trim(),
    // Omit rather than send "" — the field is optional on create, and an
    // empty string is a value the backend would have to interpret.
    ...(headEmail ? { headEmail } : {}),
  };
}

/**
 * A PATCH body containing ONLY what changed.
 *
 * Sending every field on every save would work, but it makes each edit look
 * like a change to all three in the audit trail, and it means a rename also
 * re-asserts isActive — which can fail with a 400 if the entity gained
 * employees since the dialog opened, for an edit that never touched it.
 *
 * Clearing the head email is the one case where an empty string IS the
 * payload: the backend reads "" as "remove the head", where omitting the
 * key means "leave it alone".
 */
export function toUpdatePayload(
  form: OrgEntityFormState,
  entity: OrgChartEntity,
): UpdateOrgChartEntityPayload {
  const payload: UpdateOrgChartEntityPayload = {};

  const name = form.name.trim();
  if (name !== entity.name) payload.name = name;

  const headEmail = form.headEmail.trim();
  if (headEmail !== (entity.headEmail ?? "")) payload.headEmail = headEmail;

  if (form.isActive !== entity.isActive) payload.isActive = form.isActive;

  return payload;
}

/** Whether anything actually changed — drives the Save button's enabled state. */
export function isDirty(form: OrgEntityFormState, entity?: OrgChartEntity | null): boolean {
  if (!entity) {
    // Creating: dirty once a name has been typed, since that is the only
    // required field.
    return form.name.trim().length > 0;
  }
  return Object.keys(toUpdatePayload(form, entity)).length > 0;
}

/**
 * Why deactivation is unavailable, or null when it is allowed.
 *
 * The backend enforces this with a 400; surfacing it here means someone sees
 * the reason on a disabled control rather than after a failed save.
 */
export function deactivationBlockedReason(entity?: OrgChartEntity | null): string | null {
  const count = entity?.activeEmployeeCount ?? 0;
  if (count === 0) return null;
  return `This has ${count} active ${count === 1 ? "employee" : "employees"} assigned and can't be deactivated. Move them first.`;
}
