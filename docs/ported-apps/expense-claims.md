# Expense Claims — functional specification

Ported from `digiops-finance/apps/expense-claims/webapp` (5,849 lines) into
`webapp/src/features/finance/expense`. Written after reading the source in full; the port
had no specification and no tests, and its DTOs were mirrored from the *backend* rather
than the running app.

Routes: `/me/claims/expense` (a tab of Claims) and `/me/claims/expense/new`. Approving moved to
`/finance/claim-approval/expense` — see `claim-approval.md`. Backend is
`ONE_WSO2_EXPENSE_CLAIMS_BACKEND_URL`.

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

### 3.1 New claim — `/me/claims/expense/new`

- **Expense types depend on the job number** — `GET /user-configurations/expense-types`
  is re-fetched per selection.
- **Past-date restriction.** `pastDateRestrictionDays` bounds how far back a bill date may
  go. The source compares against a *timestamp* (`now − N days`) with `isAfter`, while the
  date is midnight — so midnight of N days ago is never after it, and the oldest date
  accepted is **N−1 days ago**: "within the last N days", counting today as the first. The
  rule is checked on the typed value, not only set as the picker's `min`.
  On a resubmission it counts back from the claim's own `createdDate` instead of today, so
  correcting an old rejected claim does not fail a rule its lines already satisfied.
- **Draft.** Lines autosave to `/claim-drafts`. A saved draft is **offered** via "Restore
  Draft", not loaded automatically; adding a new line while one is held warns first.
- **Editing.** A line can be corrected in place, or removed. This matters more here than
  on OPD: retyping means re-picking the job number, expense type, currency and receipt.
- **Submit.** Confirmed first, and the message names the lead the claim goes to — resolved
  from `/employees`, falling back to the address, and omitting the parenthetical entirely
  when neither is known.

### 3.2 Claim history — `/me/claims/expense`

Defaults to **Latest 100** (`limit: 100` and *no* date filter, so claims across all years
appear); a chosen year narrows to a `startDate`/`endDate` range. Also filterable by
**status** and by **claim ID**, both omitted from the request rather than sent empty.

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
finance later did with it. The lead view is scoped by `leadEmail`, which survives any
filter applied on top. Both stages can narrow the queue by **employee** and **claim ID**.
Rejection requires a reason.

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

**Filters.** The source's custom period is an arbitrary date range; the port offers whole
years alongside Latest 100.

**Copy.** The port keeps its own register in places — "Add an expense" vs "Add Item", and
shorter snackbars without the source's "…contact Internal Apps Team" tail.

## 6. Test checklist

In `expense/**/*.test.tsx` — the three page suites plus `expenseWireFormat.test.tsx`,
which sits a level up because it exercises the query functions rather than a screen.
Every fix carries a test that fails against the previous
behaviour, verified by reverting it: draft offered rather than loaded (and its reimbursement
total survives the round trip) · draft-deletion warning · submit confirmation naming the
lead, falling back to the address, and omitting the parenthetical when there is none ·
in-place line edit replaces rather than appends · resubmission offered on both rejected
statuses and on neither approved one · the claim's **own id** and the **trimmed** payload on
the wire · corrections reaching the request · the discard confirmation · the past-date
boundary at both ends — N-1 days back and no future date — checked on the typed value ·
the status, claim-ID and employee filters
as request payloads, including that a lead stays scoped to their own reports through them,
and that a lead's Approved tab spans all three later statuses.

## 7. Unverified — questions for a live tenant

- whether the backend re-derives reimbursement figures on a `PUT` the same way it does on
  a `POST` (the port sends the same trimmed shape for both, as the source does)
- whether a resubmitted claim re-enters review at the lead stage or the stage that rejected
  it
- whether `pastDateRestrictionDays` is enforced server-side, or only in the form
