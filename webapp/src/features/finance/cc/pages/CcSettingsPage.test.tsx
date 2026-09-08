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

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";

vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));
vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));

import type { CcNewTransaction } from "../ccTypes";

const row: CcNewTransaction = {
  uploadFileId: 1,
  bankCode: "svb",
  ccNumber: "4444",
  txnReferenceNo: "REF-1",
  txnDescription: "Hotel",
  txnDate: "2026-08-20",
  postDate: "2026-08-21",
  txnCurrency: "USD",
  txnAmount: 500,
  ccCurrency: "USD",
  ccAmount: 500,
  status: "new",
  employeeEmail: "me@wso2.com",
  leadEmail: "lead@wso2.com",
};

const state = { access: ["finance"] as string[], group: null as unknown };

vi.mock("../useCc", () => ({
  useCcUserInfo: () => ({
    data: { workEmail: "me@wso2.com", accessLevels: state.access },
    isLoading: false,
    isError: false,
  }),
}));

vi.mock("../ccTypes", async () => {
  const actual = await vi.importActual<typeof import("../ccTypes")>("../ccTypes");
  return { ...actual, ccHasAccess: (_u: unknown, lvl: string) => state.access.includes(lvl) };
});

const processed: unknown[] = [];
vi.mock("../useCcMutations", () => ({
  useCcProcessStatement: () => ({
    mutate: (vars: unknown, opts: { onSuccess: (g: unknown) => void }) => {
      processed.push(vars);
      opts.onSuccess(state.group);
    },
    isPending: false,
    isError: false,
    error: null,
  }),
  useCcUploadTransactions: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("../../components/FinanceShell", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const { default: CcSettingsPage } = await import("./CcSettingsPage");
const { NotificationsProvider } = await import("@context/notifications/NotificationsContext");

beforeEach(() => {
  state.access = ["finance"];
  state.group = { newItems: [row], duplicateItems: [], invalidItems: [] };
  processed.length = 0;
});

function show() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <NotificationsProvider>
        <CcSettingsPage />
      </NotificationsProvider>
    </QueryClientProvider>,
  );
}

// fireEvent, not userEvent.upload: the latter respects the input's `accept`
// attribute and would drop a non-CSV before the component ever saw it, which
// is exactly the guard being tested. A real browser's "All files" option does
// the same as this.
const pick = (name: string, type = "text/csv") => {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [new File(["a,b"], name, { type })] } });
};

// index.tsx:232-236 — before anything is uploaded the screen says what to do.
describe("before a statement is uploaded", () => {
  it("says what to do rather than showing an empty frame", async () => {
    show();
    expect(await screen.findByText("Upload a bank statement")).toBeInTheDocument();
    expect(screen.getByText("Upload a statement to view transactions")).toBeInTheDocument();
  });
});

// FileUpload.tsx:89-94 checks the extension. `accept` on the input only filters
// the picker's default view, so without this a non-CSV reached the backend and
// failed with whatever it happened to say.
describe("choosing a file that is not a CSV", () => {
  it("is refused by name, with the source's message", async () => {
    show();
    pick("statement.xlsx", "application/vnd.ms-excel");
    expect(
      await screen.findByText("Invalid file type. Please upload a CSV file."),
    ).toBeInTheDocument();
    expect(processed).toHaveLength(0);
  });

  it("lets a CSV through", async () => {
    show();
    pick("statement.csv");
    await waitFor(() => expect(processed).toHaveLength(1));
  });
});

// StatementDataGrid.tsx:38-67 — the source's columns, in its wording. Lead
// Email is the one that says who a row will go to for approval.
describe("the parsed statement table", () => {
  it("names its columns the way the source does", async () => {
    show();
    pick("statement.csv");
    for (const header of [
      "Reference No",
      "Card Owner",
      "Card Number",
      "Lead Email",
      "Transaction Date",
      "Description",
      "Amount",
    ]) {
      expect(await screen.findByText(header)).toBeInTheDocument();
    }
  });

  it("shows who will approve each row", async () => {
    show();
    pick("statement.csv");
    expect(await screen.findByText("lead@wso2.com")).toBeInTheDocument();
  });
});

describe("a statement with nothing new in it", () => {
  it("says why Save is disabled", async () => {
    state.group = { newItems: [], duplicateItems: [row], invalidItems: [] };
    show();
    pick("statement.csv");
    const save = await screen.findByRole("button", { name: /Save/ });
    expect(save).toBeDisabled();
    // index.tsx:151-160 — the reason lives in a tooltip, which MUI only
    // renders once hovered; the span wrapper is what receives the pointer,
    // since a disabled button does not.
    await userEvent.setup().hover(save.parentElement as HTMLElement);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("No new items to save");
  });
});

// StatementDataGrid.tsx:81 uses the all-in-one GridToolbar, so this screen
// does get export — unlike the three transaction grids, whose toolbars hold
// only a quick filter. Finance is reconciling a statement it uploaded itself.
describe("the statement grid's toolbar", () => {
  it("offers export, which the transaction grids withhold", async () => {
    show();
    pick("statement.csv");
    expect(await screen.findByRole("button", { name: "Export" })).toBeInTheDocument();
  });

  it("offers search and column control too", async () => {
    show();
    pick("statement.csv");
    await screen.findByText("Reference No");
    for (const name of ["Columns", "Search"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });
});

// FileUpload.tsx — the source drops a file on a target, or clicks it. The port
// had only a button, so a drop did nothing and a chosen file could not be
// taken back.
describe("the drop zone", () => {
  const zone = () => screen.getByRole("button", { name: /Drag & drop/ });

  const drop = (name: string) =>
    fireEvent.drop(zone(), {
      dataTransfer: { files: [new File(["a,b"], name, { type: "text/csv" })] },
    });

  it("invites a drop or a click", async () => {
    show();
    expect(await screen.findByText("Drag & drop your CSV file here or click")).toBeInTheDocument();
  });

  it("says so while a file is over it", async () => {
    show();
    fireEvent.dragEnter(zone());
    expect(await screen.findByText("Drop your file here")).toBeInTheDocument();
  });

  it("takes a dropped CSV", async () => {
    show();
    drop("statement.csv");
    await waitFor(() => expect(processed).toHaveLength(1));
  });

  it("refuses a dropped non-CSV — accept cannot filter a drop", async () => {
    show();
    fireEvent.drop(zone(), {
      dataTransfer: { files: [new File(["x"], "statement.xlsx", { type: "text/csv" })] },
    });
    expect(
      await screen.findByText("Invalid file type. Please upload a CSV file."),
    ).toBeInTheDocument();
    expect(processed).toHaveLength(0);
  });

  it("shows the chosen file's name and size, and lets it be cleared", async () => {
    show();
    drop("statement.csv");
    expect(await screen.findByText("statement.csv")).toBeInTheDocument();
    expect(screen.getByText("3 Bytes")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear file" }));
    expect(await screen.findByText("Drag & drop your CSV file here or click")).toBeInTheDocument();
  });
});
