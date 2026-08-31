# OPD Claims — functional specification

Ported from `digiops-finance/apps/opd-claims/webapp` (7,021 lines) into
`webapp/src/features/finance/opd`. Written after reading the source in full; the port
had no specification and no tests, and its DTOs were mirrored from the *backend*
rather than from the running app, which is where the gaps below came from.

Routes: `/me/opd/new`, `/me/opd/history`. Approving moved to
`/finance/claim-approval/opd` — see `claim-approval.md`. Backend is
`ONE_WSO2_OPD_BACKEND_URL`.

---

## 1. Purpose and users

An employee claims outpatient medical expenses against an annual limit. Each claim is a
set of **bills** (date, amount, description, receipt); finance reviews the claim as a
whole and approves or rejects it.

| Role | Number | Sees |
|---|---|---|
| `CLAIM_SUBMITTER` | 444 | New Claim, Claim History |
| `FINANCE_APPROVER` | 555 | Approvals |

The source builds its router from these (`routes.tsx:13-21`): `View.USER` gets new-claim
and claim-history, `View.FINANCE` gets finance-approvals.

## 2. Screens

### 2.1 New claim — `/me/opd/new`

Bills are added one at a time and submitted together.

- **Year.** A claim is filed against one year's balance. When the backend reports a
  `lastYearClaimSummary`, a **This Year / Last Year** choice appears; the balance figures
  and the bill-date bounds both follow it (current year runs to today, a past year runs
  to 31 Dec). Switching with bills already added warns first, then clears them and the
  draft.
- **Single year.** Every bill in a claim must fall in the same year. Enforced on add, not
  just implied by the picker, because the date field is typeable.
- **Amount cap.** A bill cannot exceed the year's remaining balance less the bills
  already in the list. While a bill is being *edited*, its own amount is excluded — it
  has not been spent yet.
- **Draft.** Bills autosave to `/claim-drafts` on a debounce. A saved draft is **offered**
  via "Restore Draft", not loaded automatically. A restore is refused when the draft spans
  two years, or when its year differs from bills already entered. Adding a new bill while
  a draft is held warns that the draft will be dropped.
- **Editing.** A bill can be corrected in place, or removed.
- **Submit.** Confirmed before sending; the claim then goes to finance for review.

Limits: description 100 characters; receipt 10 MB; JPG, PNG or PDF.

### 2.2 Claim history — `/me/opd/history`

The employee's own claims, filtered by **period** (This Year / Last Year / Custom, the
last spanning a start and end year), **status** and **claim ID**. Opening one shows its bills, receipts and,
when rejected, the finance reason.

**Resubmission.** A *rejected* claim offers "Resubmit as New Claim": its bills seed a
fresh claim, replacing whatever draft was saved. It does not amend the rejected claim.

### 2.3 Approvals — `/finance/claim-approval/opd`

Finance-only. Three tabs — Pending, Approved, Rejected — narrowable by **employee** and
**claim ID**.

**Pending asks for `PENDING` *and* `PENDING_OLD`.** Claims filed before the status was
split carry `PENDING_OLD`; asking for `PENDING` alone hides them from the queue entirely.
The rule lives in `opdStatusFilter` so the history status filter gets it too, and
`PENDING_OLD` is never offered as its own choice.
Pending is not year-scoped, so nothing ages out of it; Approved and Rejected scope to the
current year.

## 3. API contract

| Call | Notes |
|---|---|
| `GET /user-info` | `userRoles: number[]` |
| `GET /app-data` | `claimSummary`, `lastYearClaimSummary`, saved `draft` |
| `POST /search-claims` | `{ email?, ids?, startYear?, endYear?, status? }` |
| `POST /claims` | `{ transactions }` |
| `POST /claims/{id}/status` | `{ status, reason? }` |
| `POST` / `DELETE /claim-drafts` | `{ transactions }` on save; DELETE when the list empties |
| `GET /claims/transactions/receipts/file/{name}` | blob; type sniffed for PDF vs image |
| `GET /employees` | approver-view names and avatars |

## 4. Deviations from the source, and why

**Structural.** The source is a standalone app with its own shell, mobile drawers and a
Redux store; One WSO2 renders three routes inside its own shell with React Query. Mobile
layouts are the host's responsibility.

**Not ported.** The claim-activity **timeline** (Claim Submission → Finance Review) and
the **"Print Claim" PDF export** (`ReportTemplate` + `@react-pdf/renderer`).

**Copy.** The port keeps its own register in places the source words differently — "Add a
bill" vs "Add OPD Claim", "Amount (LKR)" vs a `Rs.` adornment on "Claim Amount", and
shorter snackbars without the source's "…contact Internal Apps Team" tail.

## 5. Dead code in the source — do not port

- `PUT /claims/{id}/transactions` (`updateClaimItems`) is **never dispatched**. The
  claim-details panel renders bills `VIEW_ONLY`, and the only live resubmit path is
  "Resubmit as New Claim", which starts a new claim locally. The port's
  `opdServiceUrls.claimTransactions` is likewise unused.
- `ClaimTabLabels.PENDING_OLD` exists but is not a tab; `PENDING_OLD` is handled in the
  search payload instead.
- `ClaimItem.billReference` is in the DTO and no source screen reads or writes it.

## 6. Test checklist

Covered in `opd/pages/*.test.tsx` — the first tests any of the three finance ports have.
Every fix carries a test that fails against the previous behaviour, verified by reverting
it.

Year flow (tabs shown only when there is a last-year balance; figures and date bounds
follow the tab; a seeded draft picks its own year) · single-year rule · year-switch
warning clears bills and draft · resubmit offered only on a rejected claim, and only
after confirmation · Pending asks for both pending statuses and no year · draft offered
rather than loaded, with both refusal cases · draft-deletion warning · submit
confirmation · in-place edit replaces the row and frees its own amount · the period,
status and claim-ID filters as request payloads, including the legacy-pending rule and
that the legacy status is not offered on its own.

## 7. Unverified — questions for a live tenant

Nothing here is asserted as fact:

- whether `PENDING_OLD` still occurs in current data, or is purely historical
- whether the backend rejects a claim whose bills span two years, or accepts and
  mis-files it (the frontend rule is the only guard we can see)
- whether `lastYearClaimSummary` is withdrawn at a fixed cutoff date
