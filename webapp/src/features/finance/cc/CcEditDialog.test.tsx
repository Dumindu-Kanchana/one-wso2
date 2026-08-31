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

vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));
vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));

// First tests for the cc-expenses port. The audit's largest finding was that
// GET /travels/{jobNumber} did not exist here at all — so a travel transaction
// had no way to obtain the product and business unit the backend files it
// against, and the funding-source checks the source makes were absent.

const jobDetails = {
  engagementCode: "ENG-1",
  engagementType: "T&M",
  customerName: "Acme",
  city: "Colombo",
  country: "Sri Lanka",
  globalPod: "APAC",
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  productUnit: "Integration",
  businessUnit: "Platform",
  fundingSources: [
    { region: "APAC", subRegion: "South Asia", businessUnit: "Platform", productUnit: "Integration", percentage: 60 },
    { region: "EMEA", subRegion: "UK&I", businessUnit: "Platform", productUnit: "Integration", percentage: 40 },
  ],
};

const state = { details: jobDetails as unknown, jobQueries: [] as (string | undefined)[] };

vi.mock("./useCc", () => ({
  useCcMenus: () => ({
    expenseTypes: {
      data: { categories: ["Travel", "Marketing - Digital", "Software"], types: { Travel: ["Flights"], "Marketing - Digital": ["Ads"], Software: ["Licence"] } },
      isLoading: false,
    },
    subRegions: { data: { subRegions: ["South Asia"] }, isLoading: false },
    units: { data: { productUnits: ["Integration", "Other"], businessUnits: ["Platform", "Corp"] }, isLoading: false },
    jobNumbers: { data: { jobNumbers: ["JOB-1", "JOB-2"] }, isLoading: false },
  }),
  useCcJobNumberDetails: (jobNumber: string | undefined) => {
    state.jobQueries.push(jobNumber);
    return { data: jobNumber ? state.details : undefined, isLoading: false, isError: false };
  },
}));

vi.mock("./useCcMutations", () => ({
  useCcAttachment: () => ({
    upload: { mutateAsync: vi.fn(), isPending: false },
    remove: { mutateAsync: vi.fn(), isPending: false },
  }),
}));

const { CcEditDialog } = await import("./CcEditDialog");
const { NotificationsProvider } = await import("@context/notifications/NotificationsContext");

const txn = {
  id: 1,
  ccNumber: "1234",
  txnDate: "2026-08-01",
  txnDescription: "Flight to Colombo",
  txnAmount: 1000,
  expenseTypeId: null,
  expenseCategoryLabel: null,
  expenseTypeLabel: null,
  txnComment: null,
  receiptFileName: null,
  contractFileName: null,
  subRegion: null,
  travelJobNumber: null,
  productUnit: null,
  businessUnit: null,
  status: "new",
  employeeEmail: "me@wso2.com",
  leadEmail: "lead@wso2.com",
  financeApproverEmail: null,
  empPostedDate: null,
  leadApprovedDate: null,
  financeApprovedDate: null,
  reportSequenceNumber: null,
} as never;

const onSave = vi.fn();

beforeEach(() => {
  onSave.mockClear();
  state.details = jobDetails;
  state.jobQueries.length = 0;
});

function show() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <NotificationsProvider>
        <CcEditDialog txn={txn} onClose={vi.fn()} onSave={onSave} />
      </NotificationsProvider>
    </QueryClientProvider>,
  );
}

// MUI renders the Select as a combobox div; mouseDown on the hidden input does
// not open it.
const pick = async (label: string, option: string) => {
  // findByRole, not getByRole: a field can appear only after an earlier choice
  // (the job number arrives once the category is Travel).
  fireEvent.mouseDown(await screen.findByRole("combobox", { name: label }));
  fireEvent.click(await screen.findByRole("option", { name: option }));
};

async function categoriseAsTravel(job = "JOB-1") {
  show();
  await pick("Expense category", "Travel");
  await pick("Expense type", "Flights");
  await pick("Travel job number", job);
  fireEvent.change(screen.getByLabelText("Comment"), { target: { value: "Client visit" } });
}

// EditPane.tsx:560-600 — the job number decides a travel transaction's units.
describe("a travel job number supplies the units", () => {
  it("asks for the job's details once one is chosen", async () => {
    await categoriseAsTravel();
    await waitFor(() => expect(state.jobQueries).toContain("JOB-1"));
  });

  it("shows the engagement the spend is charged to", async () => {
    await categoriseAsTravel();
    expect(await screen.findByText(/ENG-1/)).toBeInTheDocument();
    expect(screen.getByText(/Integration — Platform/)).toBeInTheDocument();
  });

  it("saves the job's units, which the user never picks", async () => {
    await categoriseAsTravel();
    await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalled();
    expect(onSave.mock.calls[0][0]).toMatchObject({
      travelJobNumber: "JOB-1",
      productUnit: "Integration",
      businessUnit: "Platform",
    });
  });

  it("breaks the funding down against the transaction amount", async () => {
    await categoriseAsTravel();
    // 60% and 40% of 1,000.
    // CC transactions are in USD, as the dialog header shows.
    expect(await screen.findByText("$600.00")).toBeInTheDocument();
    expect(screen.getByText("$400.00")).toBeInTheDocument();
  });
});

// :568-575 and :591-598 — two different outcomes, both said out loud. No
// funding sources means the job is never applied, so the row cannot complete.
// Missing units is only a warning: the row saves with them null.
describe("a job that cannot fund the spend", () => {
  it("refuses a job with no funding sources", async () => {
    state.details = { ...jobDetails, fundingSources: [] };
    await categoriseAsTravel();
    expect(
      await screen.findByText("No funding sources found for the selected Job number."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("says when the job carries no units, but still lets the row be saved", async () => {
    state.details = { ...jobDetails, businessUnit: "" };
    await categoriseAsTravel();
    expect(
      await screen.findByText(
        "No Product unit and/or Business unit found for the selected Job number.",
      ),
    ).toBeInTheDocument();
    // validateRequiredFields (utils.ts:59-64) asks Travel only for a job
    // number, a comment and an expense type — never for the units. So the
    // source warns and saves, and blocking here would be a deviation.
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });
});

// EditPane.tsx:364 matches with startsWith, so a sub-category still needs a
// sub-region. The port matched the exact string and skipped the rule.
describe("marketing sub-categories still need a sub-region", () => {
  it("requires one for 'Marketing - Digital'", async () => {
    show();
    await pick("Expense category", "Marketing - Digital");
    await pick("Expense type", "Ads");
    fireEvent.change(screen.getByLabelText("Comment"), { target: { value: "Campaign" } });
    await pick("Product unit", "Integration — Platform");

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    await pick("Sub region", "South Asia");
    await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).toBeEnabled());
  });
});
