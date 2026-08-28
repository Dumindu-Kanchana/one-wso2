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


import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DinnerSection from "./DinnerSection";
import type { MenuUserInfo } from "../api/menuTypes";

const mutate = vi.fn();
vi.mock("../api/useMenuMutations", () => ({
  useUpsertDinnerOrder: () => ({ mutate, isPending: false, isError: false, error: null }),
  useCancelDinnerOrder: () => ({ mutate: vi.fn(), isPending: false, isError: false, error: null }),
}));

vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showSuccess: vi.fn(), showError: vi.fn(), showWarning: vi.fn() }),
}));

const USER: MenuUserInfo = {
  department: "Engineering",
  team: "Internal Apps",
  managerEmail: "lead@wso2.com",
} as MenuUserInfo;

// Inside the dinner ordering window, which is 16:00-19:00 on the cafeteria's
// own clock (IST, UTC+5:30) — so the write controls are live.
const DURING_WINDOW = new Date("2026-08-24T11:30:00Z"); // 17:00 IST

function renderSection(props: Partial<React.ComponentProps<typeof DinnerSection>> = {}) {
  return render(
    <DinnerSection
      now={DURING_WINDOW}
      order={undefined}
      user={USER}
      isLoading={false}
      error={undefined}
      {...props}
    />,
  );
}

const orderButton = () => screen.getByRole("button", { name: /order dinner/i });

beforeEach(() => {
  mutate.mockClear();
});

describe("with the orderer's profile loaded", () => {
  it("orders once a meal is chosen", async () => {
    renderSection();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /vegetarian/i }));
    await user.click(orderButton());

    expect(mutate).toHaveBeenCalledTimes(1);
    const payload = mutate.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.department).toBe("Engineering");
    expect(payload.managerEmail).toBe("lead@wso2.com");
  });
});

// Dinner is distributed by department and reporting line. `buildDinnerPayload`
// substitutes empty strings when the profile is missing and the backend accepts
// them, so an order placed without it succeeds while being filed against
// nobody — nothing downstream refuses it, and nothing looks wrong.
describe("without the orderer's profile", () => {
  it("refuses to order at all", async () => {
    renderSection({ user: undefined });
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /vegetarian/i }));

    expect(orderButton()).toBeDisabled();
    expect(mutate).not.toHaveBeenCalled();
  });

  it("stays quiet while the profile is merely still loading", () => {
    // The wait is normally imperceptible, so a warning about it would be noise.
    renderSection({ user: undefined });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("says why once the profile is known to have failed", async () => {
    // The page only refuses outright on a 403, so every other failure arrives
    // here. Without a reason the button is dead with no explanation.
    renderSection({ user: undefined, userError: new Error("gateway timeout") });
    // A meal has to be chosen first, or the button is disabled for the ordinary
    // reason and this asserts nothing about the missing profile.
    await userEvent.setup().click(screen.getByRole("button", { name: /vegetarian/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(/department and reporting line/i);
    expect(orderButton()).toBeDisabled();
  });

  it("does not submit even if the button is driven directly", async () => {
    // Belt and braces: `submit` guards too, so a click that beats a re-render
    // cannot get through. Driven with .click() rather than userEvent, which
    // refuses a disabled control and so could never reach the guard.
    renderSection({ user: undefined, userError: new Error("gateway timeout") });
    await userEvent.setup().click(screen.getByRole("button", { name: /vegetarian/i }));

    orderButton().click();
    expect(mutate).not.toHaveBeenCalled();
  });
});
