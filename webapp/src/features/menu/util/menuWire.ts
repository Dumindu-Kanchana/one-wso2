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

// Wire -> domain conversion for the menu backend.
//
// Kept apart from the hooks so the awkward parts of this contract — an empty
// string meaning "no meal", and a 200 that means "no order" — are pure functions
// with tests, rather than conditions buried in a queryFn.

import { cafeteriaMoment, normalizeSheetDate } from "./menuTime";
import {
  MEAL_SLOTS,
  type DailyMenu,
  type DinnerOrder,
  type DinnerPayload,
  type Meal,
  type MealKey,
  type MealOption,
  type MenuUserInfo,
  type MenuWire,
} from "../api/menuTypes";

/** "" and whitespace both mean "not served today". */
function toMeal(raw: { title?: unknown; description?: unknown } | undefined): Meal {
  const title = typeof raw?.title === "string" ? raw.title.trim() : "";
  const description = typeof raw?.description === "string" ? raw.description.trim() : "";
  return { title: title || null, description: description || null };
}

/**
 * Normalise the menu response.
 *
 * Tolerant of a missing slot as well as a blank one: a truncated response should
 * render the meals it does contain rather than throwing.
 */
export function normalizeMenu(raw: MenuWire | undefined | null): DailyMenu {
  const source = (raw ?? {}) as Partial<Record<MealKey, unknown>> & { date?: unknown };
  const meals = {} as Record<MealKey, Meal>;
  for (const slot of MEAL_SLOTS) {
    meals[slot.key] = toMeal(source[slot.key] as { title?: unknown; description?: unknown });
  }
  return {
    date: normalizeSheetDate(typeof source.date === "string" ? source.date : null),
    meals,
  };
}

/**
 * Normalise the current-order response.
 *
 * `GET /dinner` answers either an order or `200 {message: "..."}` when there is
 * none — not a 404. Discriminated on SHAPE, never on the message text: that text
 * is a backend constant, and matching its prose would break on a copy edit and
 * mishandle any other message the service grows.
 *
 * Returns null rather than undefined because React Query rejects undefined as
 * query data.
 */
export function normalizeDinnerResponse(raw: unknown): DinnerOrder | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "number" || typeof r.mealOption !== "string") return null;
  return {
    id: r.id,
    mealOption: r.mealOption,
    date: normalizeSheetDate(typeof r.date === "string" ? r.date : null) ?? "",
  };
}

/**
 * Build the body for placing or changing an order.
 *
 * The date is the cafeteria's date, not the browser's — it is half of the key
 * the server de-duplicates on, so a browser several hours behind IST must not
 * claim yesterday.
 *
 * `department` and `managerEmail` are required keys on the wire, so they fall
 * back to "" rather than being omitted; omitting them is a 400.
 */
export function buildDinnerPayload(args: {
  now: Date;
  mealOption: MealOption;
  user: MenuUserInfo | undefined;
  existing: DinnerOrder | null;
}): DinnerPayload {
  const { now, mealOption, user, existing } = args;
  return {
    ...(existing ? { id: existing.id } : {}),
    mealOption,
    date: cafeteriaMoment(now).dateIso,
    department: user?.department ?? "",
    team: user?.team ?? null,
    managerEmail: user?.managerEmail ?? "",
  };
}
