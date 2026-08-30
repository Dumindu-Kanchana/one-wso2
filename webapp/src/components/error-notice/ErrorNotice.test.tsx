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

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ErrorNotice from "./ErrorNotice";

describe("ErrorNotice", () => {
  it("states what failed", () => {
    render(<ErrorNotice>Couldn&apos;t load your team.</ErrorNotice>);
    expect(screen.getByText(/Couldn't load your team/)).toBeInTheDocument();
  });

  it("offers no retry unless one is given — some failures retrying cannot fix", () => {
    render(<ErrorNotice>Nope.</ErrorNotice>);
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });

  it("retries on click", async () => {
    const onRetry = vi.fn();
    render(<ErrorNotice onRetry={onRetry}>Nope.</ErrorNotice>);
    await userEvent.setup().click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("disables the button while a retry is in flight", () => {
    render(
      <ErrorNotice onRetry={() => {}} retrying>
        Nope.
      </ErrorNotice>,
    );
    expect(screen.getByRole("button", { name: "Retry" })).toBeDisabled();
  });

  // The reason this component exists. Asgardeo's exception type is a plain
  // class with no `extends Error` and no toString, so every call site that
  // interpolated the raw error printed "[object Object]".
  it("never prints a raw object, whatever it is handed", () => {
    const asgardeoLike = { code: "JS-CRYPTO_UTIL-DIT-IV02", name: "Decoding token failed." };
    render(<ErrorNotice error={asgardeoLike}>Couldn&apos;t verify.</ErrorNotice>);
    expect(screen.queryByText(/\[object Object\]/)).toBeNull();
    expect(screen.getByText(/Decoding token failed/)).toBeInTheDocument();
  });

  it("says nothing extra when handed no error", () => {
    const { container } = render(<ErrorNotice>Just this.</ErrorNotice>);
    expect(container.textContent).toBe("Just this.");
  });

  it("can be an info notice — a 403 is a refusal, not a fault", () => {
    render(<ErrorNotice severity="info">You don&apos;t have access.</ErrorNotice>);
    expect(screen.getByRole("alert")).toHaveClass(/MuiAlert-standardInfo|MuiAlert-colorInfo/);
  });
});
