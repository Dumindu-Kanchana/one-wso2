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

import { describe, expect, it } from "vitest";
import { isMealOption, type MenuUserInfo, type MenuWire } from "../api/menuTypes";
import { buildDinnerPayload, normalizeDinnerResponse, normalizeMenu } from "./menuWire";

const slot = (title: string, description = "") => ({ title, description });

const fullMenu: MenuWire = {
  date: "2026/08/24",
  breakfast: slot("Hoppers", " String hoppers with sambol "),
  juice: slot(""),
  lunch: slot("  Rice and curry  ", "Chicken or veg"),
  dessert: slot("   "),
  snack: slot("Patties"),
};

describe("normalizeMenu", () => {
  it("turns blank titles into absent meals and trims the rest", () => {
    const menu = normalizeMenu(fullMenu);
    expect(menu.meals.breakfast).toEqual({ title: "Hoppers", description: "String hoppers with sambol" });
    expect(menu.meals.juice.title).toBeNull();
    expect(menu.meals.dessert.title).toBeNull();
    expect(menu.meals.lunch.title).toBe("Rice and curry");
  });

  it("normalises the date", () => {
    expect(normalizeMenu(fullMenu).date).toBe("2026-08-24");
    expect(normalizeMenu({ ...fullMenu, date: "whenever" }).date).toBeNull();
  });

  it("tolerates a truncated response instead of throwing", () => {
    const partial = { date: "2026-08-24", breakfast: slot("Hoppers") } as unknown as MenuWire;
    const menu = normalizeMenu(partial);
    expect(menu.meals.breakfast.title).toBe("Hoppers");
    expect(menu.meals.juice).toEqual({ title: null, description: null });
  });

  it("survives a missing response entirely", () => {
    expect(normalizeMenu(undefined).meals.lunch.title).toBeNull();
  });
});

describe("normalizeDinnerResponse", () => {
  it("reads an order", () => {
    expect(
      normalizeDinnerResponse({ id: 7, mealOption: "Fish", date: "2026/08/24", userEmail: "a@wso2.com" }),
    ).toEqual({ id: 7, mealOption: "Fish", date: "2026-08-24" });
  });

  // The service answers 200 with a message when there is no order, not 404.
  it("reads the no-order response as no order", () => {
    expect(normalizeDinnerResponse({ message: "No dinner request has been made." })).toBeNull();
  });

  // Discriminating on the message text would break on a copy edit, and would
  // mishandle any other message the service grows.
  it("is decided by shape, not by the message text", () => {
    expect(normalizeDinnerResponse({ message: "anything at all" })).toBeNull();
  });

  it("degrades to no order on anything unusable", () => {
    for (const bad of [null, undefined, [], "text", {}, { id: "7", mealOption: "Fish" }]) {
      expect(normalizeDinnerResponse(bad)).toBeNull();
    }
  });

  // The column is unconstrained, so an unexpected value must still render as an
  // order the user can cancel — not vanish.
  it("keeps an order whose meal is not one of the three", () => {
    const order = normalizeDinnerResponse({ id: 9, mealOption: "Mutton", date: "2026-08-24" });
    expect(order?.mealOption).toBe("Mutton");
    expect(isMealOption("Mutton")).toBe(false);
  });

  it("blanks a date it cannot read rather than failing", () => {
    expect(normalizeDinnerResponse({ id: 3, mealOption: "Fish", date: 42 })?.date).toBe("");
  });
});

describe("buildDinnerPayload", () => {
  const user: MenuUserInfo = {
    employeeId: "E1",
    firstName: "A",
    lastName: "B",
    workEmail: "a@wso2.com",
    jobRole: "Engineer",
    department: "Engineering",
    team: "Platform",
    managerEmail: "m@wso2.com",
    privileges: [987],
  };
  const now = new Date("2026-08-24T10:00:00Z"); // 15:30 IST on the 24th

  it("omits the id when placing a new order", () => {
    const p = buildDinnerPayload({ now, mealOption: "Fish", user, existing: null });
    expect(p.id).toBeUndefined();
    expect(p).toMatchObject({ mealOption: "Fish", department: "Engineering", team: "Platform" });
  });

  it("carries the id when changing one", () => {
    const p = buildDinnerPayload({
      now,
      mealOption: "Chicken",
      user,
      existing: { id: 12, mealOption: "Fish", date: "2026-08-24" },
    });
    expect(p.id).toBe(12);
  });

  // The date is half the key the server de-duplicates on, so it must be the
  // cafeteria's date and not the browser's.
  it("dates the order on the cafeteria's calendar", () => {
    const lateElsewhere = new Date("2026-08-24T19:30:00Z"); // already the 25th in IST
    expect(buildDinnerPayload({ now: lateElsewhere, mealOption: "Fish", user, existing: null }).date).toBe(
      "2026-08-25",
    );
  });

  // Both keys are required on the wire; omitting them is a 400.
  it("sends empty strings rather than omitting required keys", () => {
    const p = buildDinnerPayload({ now, mealOption: "Fish", user: undefined, existing: null });
    expect(p.department).toBe("");
    expect(p.managerEmail).toBe("");
    expect(p.team).toBeNull();
  });
});
