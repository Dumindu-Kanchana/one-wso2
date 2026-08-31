# Credit Card Expenses — functional specification

Ported from `digiops-finance/apps/cc-expenses/webapp` (13,764 lines) into
`webapp/src/features/finance/cc`. Written after reading the source in full; the port
had no specification and no tests, and its DTOs were mirrored from the *backend*
rather than from the running app, which is where the gaps below came from.

Routes: `/me/cc/dashboard`, `/me/cc/new`, `/me/cc/pending`, `/me/cc/approve`,
`/me/cc/history`, `/me/cc/settings`. Backend is `ONE_WSO2_CC_EXPENSES_BACKEND_URL`.

---

## 1. Purpose and users

A company credit-card transaction arrives from the bank statement uncategorised. The card
holder categorises it and submits it; a lead approves it; finance approves it again and it
is booked. Nothing here is a reimbursement — the money has already left the card.

Access comes from `GET /user-info` as **privilege names**, not numbers
(`ccTypes.ts:21`), and `ccHasAccess` tests membership:

| Privilege | Sees |
|---|---|
| `employee`, `cc_owner` | Dashboard, New Transactions, Pending Submissions, History |
| `lead` | the above, plus Approve Submissions |
| `finance` | all of the above, plus Statement ingestion |

## 2. Screens

### 2.1 Dashboard — `/me/cc/dashboard`

What is still unsubmitted, how long it has been sitting, and what has been claimed.

A header stating both windows the screen covers ("As of" today, and the reporting window
the category table spans), then four tiles in a 2×2 grid — three stat cards and one table
— followed by two more tables. Three tables in all. Every figure is USD, and every amount
drops the cents, as the source's `formatCurrency(x).split(".")[0]` does throughout.

- **Three stat cards** — Total Amount Pending Submission (which links out to New
  Transactions), Total Transactions Pending Submission, and Avg. Days Taken to Submit
  (suffixed "days", "-" when the backend has no figure). All three follow a **period** —
  All time (the default), Last 6 months, Last year. "All time" sends no lower bound at all.
- **Pending by Age**, the fourth tile and the first of the three tables: one row per
  bucket, AGE / COUNT / VALUE, repeating "As of" today's date. The bucket labels come from
  the response; the port does not invent its own bands.
- **Cardholders Details** — per card holder, their outstanding total, transaction count,
  average days to submit, and how many of their transactions sit in each ageing band
  (0-7D / 8-14D / 15-30D / 30+D). The last two turn red when they are not empty. Lead and
  finance only.
- **Submitted Expenses by Category**, over a fixed six-month window ending today, shown
  **Monthly / Quarterly / Annually**. Widening the granularity collapses the same six
  months into fewer columns; it does not widen the window. Categories rank by total spend,
  with a Total row and a Total column.
- **View switch.** A lead or finance opens on **Admin view** and can narrow to **Employee
  view**; that also hides the cardholder table. An ordinary card holder has no switch —
  the backend already scopes them — so the request omits `ownedCardsOnly` rather than
  sending it as false.

### 2.2 New transactions — `/me/cc/new`

Uncategorised transactions from the last **seven days**. Each needs an expense type, a
comment, and — depending on the category — more:

| Category | Also required |
|---|---|
| Travel | a travel job number |
| Marketing (and any `Marketing - …` sub-category) | sub-region **and** product unit |
| anything else | product unit |

**Travel job numbers carry their own units.** Picking one calls `GET /travels/{jobNumber}`
and fills the product and business unit from the job rather than asking; that is why they
are required. A job with **no funding sources** is refused rather than half-applied, and a
job missing units says so. The engagement and its funding split are shown against the
transaction amount.

A row can be saved as a draft or submitted. Receipts and contracts attach per transaction.

### 2.3 Pending submissions — `/me/cc/pending`

The card holder's own submitted transactions, still with a lead or with finance. **While
it is still with the lead**, the card holder can correct a submission in place, saved
through `/save-edit`. Once finance has it, it is locked.

### 2.4 Approve submissions — `/me/cc/approve`

Lead and finance. Finance sees a queue spanning **both** stages, so work still sitting
with a lead is visible rather than absent until the lead acts — but they cannot select
what is not yet theirs. Finance may also correct a transaction that has reached them.

### 2.5 History — `/me/cc/history`

Everything the viewer is entitled to see, over a chosen window (7 days by default).
Someone who can see other people's spend also gets **employee**, **card** and **lead**
filters. A card can carry several leads, so the lead filter matches within the list rather
than comparing the whole string.

Opening a transaction shows its categorisation and its **approval trail** — who had it and
when, and the report sequence number once booked.

### 2.6 Statement ingestion — `/me/cc/settings`

Finance only. Upload a bank statement, then process it into transactions.

## 3. API contract

| Call | Notes |
|---|---|
| `GET /user-info` | `privileges: string[]` |
| `GET /credit-cards` | active cards only unless inactive are asked for |
| `PATCH /credit-cards/{id}?label=` | rename a card |
| `GET /transactions?dateFrom&dateTo&includeInactive` | **all three required**; window ends *tomorrow* |
| `POST /transactions/save-draft` · `/employee-submit` · `/save-edit` | |
| `POST /transactions/lead-approve` · `/finance-approve` | |
| `GET /transactions/new-transaction-summary` | `?dateFrom&ownedCardsOnly`, both omitted when falsy |
| `GET /transactions/submitted-transaction-summary` | `?dateFrom&dateTo&ownedCardsOnly` |
| `GET /transactions/card-holder-compliance-summary` | `?dateFrom&ownedCardsOnly`; not called at all unless shown |
| `GET /travels/job-numbers` · `GET /travels/{jobNumber}` | the job's units and funding sources |
| `GET /configurations/expense-types` · `/sub-regions` · `/product-and-business-units` | |
| `GET`/`DELETE`/`PUT /transactions/{id}/attachments` | note the backend's misspelled `fileExtenstion` query param on upload |
| `POST /transactions?bankCode&statementFileName` · `/transactions/process-statement` | statement ingestion |

## 4. Deviations from the source, and why

**Structural.** The source is a standalone app with its own shell, mobile drawers and a
Redux store; One WSO2 renders six routes inside its own shell with React Query. Mobile
layouts are the host's responsibility.

**Nothing dropped from the dashboard.** The source renders it as stat cards and three
tables, with no charting library; all of it is ported, including the ageing-band columns
and the "As of" date.

**Attachments.** The port accepts the same types the source does, bmp, gif and svg
included.

**One guard the source does not have.** Approving is held while an edit saved from the
approve screen is still in flight. The source's `isApproveDisabled`
(`ApproveTransactionsDataGrid.tsx:189-191`) checks only the selection and the approval
request, so it can approve a row whose correction has not landed — booking the pre-edit
version. Invisible when nothing is in flight.

## 5. Source behaviour reproduced deliberately, though it looks wrong

Kept because the two apps run side by side during the migration and must agree. Each is
worth raising with the source's owners rather than diverging here.

- **The reporting window omits the start year.** `formatReportingWindow`
  (`utils.ts:47-52`) stamps `now.getFullYear()` on both ends, so from January to May the
  label reads e.g. "Aug - Jan 2026" for a window that begins in August 2025. The port
  reproduces it exactly.
- **A travel job with no product or business unit still saves.**
  `validateRequiredFields` (`utils.ts:59-64`) asks a Travel transaction only for a job
  number, a comment and an expense type — never the units — so
  `handleJobNumberChange` (`EditPane.tsx:591-598`) warns and lets the save through with
  them null. Only a job with **no funding sources** is refused, and that one is refused by
  never being applied at all. Pinned by a test, so it cannot be "fixed" by accident.

## 6. Test checklist

Covered in `cc/ccDashboard.test.ts`, `cc/ccWireFormat.test.tsx`, `cc/CcEditDialog.test.tsx`,
`cc/components/CardMenu.test.tsx` and `cc/pages/{CcApprovePage,CcDashboardPage,CcHistoryPage,CcPendingPage}.test.tsx`.
Every fix carries a test that fails against the previous behaviour, verified by reverting it.

Active-card filter, including case-insensitive status · the window ends tomorrow, not
today · the seven-day default, and a caller's own window overriding it · travel job
details fill the units, and the two refusal cases · `startsWith` matching for marketing
sub-categories · finance's two-stage queue and the selection lock · the card holder's
edit-while-with-lead affordance · the approval trail · the history person filters · the
dashboard's date arithmetic (period bounds with day-clamping, the six-month window,
monthly/quarterly/yearly bucketing, category ranking, out-of-window items dropped) · who
sees the view switch and the cardholder table, and that a card holder's browser never
issues the compliance request · the age table's three columns and the cardholder table's
eight · amounts rendered without cents · the "days" unit · falsy query parameters omitted
rather than sent as "false" · one lead named on the approval trail, not the whole assigned
list, and the source's "(not provided)" / "(not approved)" wording · reaching rename by
keyboard does not also switch card · approving waits for an in-flight edit · a job missing
units warns but still saves.

Date expectations are built with local date fields, matching the helpers under test — a
UTC ISO string plus a fixed 86,400,000 ms offset names a different calendar day in the
evening of any negative-offset zone, and the suite would fail there and nowhere else.

One equivalent mutation is knowingly not covered: dropping `isAdminEligible` from
`ownedCardsOnly` changes nothing observable, because a card holder never gets the toggle
that could move `viewMode`. The guard mirrors `index.tsx:64` and stays.

## 7. Unverified — questions for a live tenant

Nothing here is asserted as fact:

- whether the backend treats an omitted `ownedCardsOnly` and an explicit `false`
  identically, or only the former (the source only ever omits it)
- which age-bucket labels the backend actually returns, and whether they are stable
- whether a travel job with no funding sources occurs in current data, or only in
  half-created records
- how often a travel job legitimately has funding sources but no units, given the source
  books those with null units
