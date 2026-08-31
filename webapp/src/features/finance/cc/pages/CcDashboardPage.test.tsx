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
import { render as rtlRender, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import userEvent from "@testing-library/user-event";

vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));
vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));

// Who is looking, and what each hook was asked for.
const role = { privileges: ["employee"] as string[] };
const asked = {
  summary: [] as { dateFrom: string | undefined; ownedCardsOnly: boolean }[],
  compliance: [] as { ownedCardsOnly: boolean; enabled: boolean }[],
};

vi.mock("../useCc", () => ({
  useCcUserInfo: () => ({
    data: { workEmail: "me@wso2.com", privileges: role.privileges },
    isLoading: false,
    isError: false,
  }),
  useCcTransactionSummary: (dateFrom: string | undefined, ownedCardsOnly: boolean) => {
    asked.summary.push({ dateFrom, ownedCardsOnly });
    return {
      data: {
        current: { amount: 1250.5, count: 4, avgDaysToSubmit: 12.25 },
        ageBuckets: {
          a: { label: "0-30 days", amount: 250.5, count: 1 },
          b: { label: "31-60 days", amount: 1000, count: 3 },
        },
      },
      isLoading: false,
      isError: false,
    };
  },
  useCcSubmittedByCategory: () => ({
    data: [
      { category: "Travel", txnMonth: new Date().toISOString().slice(0, 7), amount: 300 },
      { category: "Software", txnMonth: new Date().toISOString().slice(0, 7), amount: 900 },
    ],
    isLoading: false,
    isError: false,
  }),
  useCcCardHolderCompliance: (
    _dateFrom: string | undefined,
    ownedCardsOnly: boolean,
    enabled: boolean,
  ) => {
    asked.compliance.push({ ownedCardsOnly, enabled });
    return {
      data: [
        {
          employeeEmail: "late@wso2.com",
          cardHolderName: "Late Filer",
          outstandingAmount: 700,
          transactionCount: 2,
          avgDaysToSubmit: 41.5,
          bucket0To7: 0,
          bucket8To14: 0,
          bucket15To30: 1,
          bucket30Plus: 1,
        },
      ],
      isLoading: false,
      isError: false,
    };
  },
}));

vi.mock("../../components/FinanceShell", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const { default: CcDashboardPage } = await import("./CcDashboardPage");

const render = () =>
  rtlRender(
    <MemoryRouter>
      <CcDashboardPage />
    </MemoryRouter>,
  );

beforeEach(() => {
  role.privileges = ["employee"];
  asked.summary.length = 0;
  asked.compliance.length = 0;
});

// index.tsx:63-65 — only a lead or finance gets the company-wide view and the
// compliance table; an ordinary card holder sees their own spend, full stop.
describe("who sees what", () => {
  it("gives a card holder no view switch and no compliance table", () => {
    render();
    expect(screen.queryByRole("combobox", { name: "View" })).not.toBeInTheDocument();
    expect(screen.queryByText("Cardholders Details")).not.toBeInTheDocument();
    // index.tsx:64 scopes on `isAdminEligible && ...`, so the flag stays off
    // for a card holder — the backend already scopes them to their own cards.
    expect(asked.summary.at(-1)?.ownedCardsOnly).toBe(false);
  });

  it("never fires the compliance request for a card holder", () => {
    render();
    expect(asked.compliance.at(-1)?.enabled).toBe(false);
  });

  it("opens an approver on the company-wide view", () => {
    role.privileges = ["employee", "lead"];
    render();
    expect(screen.getByText("Cardholders Details")).toBeInTheDocument();
    expect(asked.summary.at(-1)?.ownedCardsOnly).toBe(false);
  });

  it("narrows an approver to their own cards, and drops compliance with it", async () => {
    role.privileges = ["employee", "finance"];
    render();
    await userEvent.click(screen.getByRole("combobox", { name: "View" }));
    await userEvent.click(screen.getByRole("option", { name: "Employee view" }));
    await waitFor(() => expect(asked.summary.at(-1)?.ownedCardsOnly).toBe(true));
    expect(screen.queryByText("Cardholders Details")).not.toBeInTheDocument();
  });
});

describe("the pending figures", () => {
  it("shows amount, count and average days", () => {
    render();
    // :194 — `formatCurrency(x).split(".")[0]`, so no cents, and the currency
    // is named rather than symbolised.
    expect(screen.getByText("USD 1,250")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("12.3")).toBeInTheDocument(); // one decimal
    expect(screen.getByText("days")).toBeInTheDocument();
  });

  it("lays the age buckets out as the backend named them", () => {
    render();
    expect(screen.getByText("0-30 days")).toBeInTheDocument();
    expect(screen.getByText("31-60 days")).toBeInTheDocument();
    // PendingByAgeCard.tsx:52-62 — one row per bucket, AGE / COUNT / VALUE.
    const ageRow = screen.getByText("31-60 days").closest("tr") as HTMLElement;
    const ageTable = ageRow.closest("table") as HTMLElement;
    expect(
      [...ageTable.querySelectorAll("th")].map((h) => h.textContent),
    ).toEqual(["AGE", "COUNT", "VALUE"]);
    expect(ageRow).toHaveTextContent("3");
    expect(ageRow).toHaveTextContent("USD 1,000");
  });

  // :34-38 — "All time" is the opening period and sends no lower bound.
  it("opens on all time, and asks for a bound once a period is picked", async () => {
    render();
    expect(asked.summary.at(-1)?.dateFrom).toBeUndefined();

    await userEvent.click(screen.getByRole("combobox", { name: "Period" }));
    await userEvent.click(screen.getByRole("option", { name: "Last 6 months" }));
    await waitFor(() => expect(asked.summary.at(-1)?.dateFrom).toBeDefined());
  });
});

describe("the category breakdown", () => {
  it("ranks categories by spend and totals the grid", () => {
    render();
    const rows = screen.getAllByRole("row");
    const categories = rows.map((r) => r.querySelector("td")?.textContent);
    expect(categories).toContain("Software");
    expect(categories.indexOf("Software")).toBeLessThan(categories.indexOf("Travel"));
    expect(screen.getAllByText("1,200").length).toBeGreaterThan(0); // 900 + 300
  });

  it("collapses the columns when the granularity widens", async () => {
    render();
    const monthlyCols = screen.getAllByRole("columnheader").length;

    await userEvent.click(screen.getByRole("combobox", { name: "Granularity" }));
    await userEvent.click(screen.getByRole("option", { name: "Annually" }));

    await waitFor(() =>
      expect(screen.getAllByRole("columnheader").length).toBeLessThan(monthlyCols),
    );
  });
});

// CardHolderComplianceTable.tsx:96-118 — eight columns, and the two oldest
// bands are called out in red when they are not empty. The port had reduced
// this to four columns, dropping the ageing split entirely.
describe("the cardholder table", () => {
  it("breaks each card holder's backlog into the four ageing bands", () => {
    role.privileges = ["employee", "finance"];
    render();
    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers).toEqual(
      expect.arrayContaining([
        "CARD HOLDER",
        "TOTAL OUTSTANDING (USD)",
        "# TRANSACTIONS",
        "AVG. DAYS TO SUBMIT",
        "0-7D",
        "8-14D",
        "15-30D",
        "30+D",
      ]),
    );
  });

  it("shows the row's figures without cents", () => {
    role.privileges = ["employee", "finance"];
    render();
    const row = screen.getByText("Late Filer").closest("tr") as HTMLElement;
    expect(row).toHaveTextContent("700");
    expect(row).not.toHaveTextContent("700.00");
    expect(row).toHaveTextContent("41.5");
  });
});
