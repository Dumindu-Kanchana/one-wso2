# Expense Claims — functional specification

Ported from `digiops-finance/apps/expense-claims/webapp` (5,849 lines) into
`webapp/src/features/finance/expense`. Written after reading the source in full; the port
had no specification and no tests, and its DTOs were mirrored from the *backend* rather
than the running app.

Routes: `/me/expense/new`, `/me/expense/history`, `/me/expense/lead-approvals`,
`/me/expense/finance-approvals`. Backend is `ONE_WSO2_EXPENSE_CLAIMS_BACKEND_URL`.

---

## 1. Purpose and users

An employee claims out-of-pocket expenses. Each claim is a set of **lines** (date, travel
job number, currency + amount, expense type, description, receipt). A claim is reviewed
**twice**: by the employee's lead, then by finance.

| View | Gate | Screens |
|---|---|---|
| User | everyone | New Claim, Claim History |
| Lead | `enableLeadView` | Lead Approvals |
| Finance | `enableFinanceView` | Finance Approvals |

## 2. Money

A line is entered in **any currency** and reimbursed in the subsidiary's `currencyCode`.
The rate comes from `GET /currencies/{reimbursementCurrency}/rates/{billDate}` — **per bill
date**, so changing the date changes the rate. A foreign currency with no rate in the
fetched list must not fall back to 1; that would submit the raw foreign amount as if it
were already converted.

The submit payload is deliberately **trimmed** (`ClaimItemPayload`): `expenseType`,
`currencyConversionRate`, `reimbursementAmount` and `reimbursementCurrency` are derived by
the backend and are not sent.

## 3. Screens

### 3.1 New claim — `/me/expense/new`

- **Expense types depend on the job number** — `GET /user-configurations/expense-types`
  is re-fetched per selection.
- **Past-date restriction.** `pastDateRestrictionDays` bounds how far back a bill date may
  go. On a resubmission the source measures it from the claim's `createdDate` instead of
  today.
- **Draft.** Lines autosave to `/claim-drafts`. A saved draft is **offered** via "Restore
  Draft", not loaded automatically; adding a new line while one is held warns first.
- **Editing.** A line can be corrected in place, or removed. This matters more here than
  on OPD: retyping means re-picking the job number, expense type, currency and receipt.
- **Submit.** Confirmed first, and the message names the lead the claim goes to — resolved
  from `/employees`, falling back to the address, and omitting the parenthetical entirely
  when neither is known.

### 3.2 Claim history — `/me/expense/history`

Defaults to **Latest 100** (`limit: 100` and *no* date filter, so claims across all years
appear); a chosen year narrows to a `startDate`/`endDate` range.

**Resubmission.** A claim rejected at **either** stage (`LEAD_REJECTED` or
`FINANCE_REJECTED`) can have its lines corrected and be resubmitted with
`PUT /claims/{id}/transactions`. The claim **keeps its id** and returns to review — this
is not a new claim, which is the opposite of OPD's "Resubmit as New Claim". Corrections
are held locally until resubmitted, so closing with unsaved ones is confirmed.

### 3.3 Approvals — lead and finance

One screen parameterised by stage, three tabs each. The status sets are not symmetrical:

| Tab | Lead asks for | Finance asks for |
|---|---|---|
| Pending | `PENDING_LEAD` | `PENDING_FINANCE` |
| Approved | `PENDING_FINANCE`, `APPROVED`, `FINANCE_REJECTED` | `APPROVED` |
| Rejected | `LEAD_REJECTED` | `FINANCE_REJECTED` |

A lead's "Approved" tab deliberately spans everything they have passed on, whatever
finance later did with it. The lead view is scoped by `leadEmail`. Rejection requires a
reason.

## 4. Deferred — "Submitting for" (claim on behalf of another employee)

**Not ported, deliberately.** `appData.onBehalfOfEmployees` drives a picker on New Claim
that lets a delegate file for someone else: their travel job numbers replace yours,
`onBehalfOfEmail` rides on both the submit payload and the expense-types query, and the
confirmation names them.

It is left out because it is **new and still settling**, not because it is hard:

| Date | |
|---|---|
| 2026-08-28 | Six commits for issue #2027 — DB migration, module methods, backend, GraphQL entity, frontend, then "Minor updates" the same day |
| 2026-08-29 | "Update travel detail fetch logic" **adds** `fetchOnBehalfOfJobNumbers` and the revert-on-failure — i.e. the feature shipped without fetching the delegate's job numbers at all |

It also spans a database migration and a GraphQL entity change, so it is not frontend-only.
Revisit once it has settled upstream.

## 5. Deviations from the source, and why

**Structural.** The source is a standalone app with its own shell and a Redux store; One
WSO2 renders four routes inside its own shell with React Query.

**Not ported.** The **PDF "Print Claim" export** (`ReportTemplate` + `@react-pdf/renderer`)
and the **claim-activity timeline** (Claim Submission → Lead Review → Finance Review).

**Filters.** The source's history has a status and claim-ID filter, and the approver views
add an employee filter; the port has the period selector only. Its custom range is an
arbitrary date range in the source and whole years here.

**Boundary.** `pastDateRestrictionDays` is enforced here as an inclusive `min` date, where
the source compares against a timestamp (`now − N days`) — so the port accepts a bill one
day older at the edge.

**Copy.** The port keeps its own register in places — "Add an expense" vs "Add Item", and
shorter snackbars without the source's "…contact Internal Apps Team" tail.

## 6. Test checklist

In `expense/pages/*.test.tsx`. Every fix carries a test that fails against the previous
behaviour, verified by reverting it: draft offered rather than loaded (and its reimbursement
total survives the round trip) · draft-deletion warning · submit confirmation naming the
lead, falling back to the address, and omitting the parenthetical when there is none ·
in-place line edit replaces rather than appends · resubmission offered on both rejected
statuses and on neither approved one · the claim's **own id** and the **trimmed** payload on
the wire · corrections reaching the request · the discard confirmation.

## 7. Unverified — questions for a live tenant

- whether the backend re-derives reimbursement figures on a `PUT` the same way it does on
  a `POST` (the port sends the same trimmed shape for both, as the source does)
- whether a resubmitted claim re-enters review at the lead stage or the stage that rejected
  it
- whether `pastDateRestrictionDays` is enforced server-side, or only in the form
