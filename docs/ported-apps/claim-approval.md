# Claim approval — functional specification

Not a port. The two standalone apps each have their own approval screen, reached from their
own menu; this is One WSO2's arrangement of them, built on those screens and those rules.

Route: `/finance/claim-approval`, with `needs-you`, `expense`, `opd` and `decided` beneath it.
Backends are `ONE_WSO2_OPD_BACKEND_URL` and `ONE_WSO2_EXPENSE_CLAIMS_BACKEND_URL`.

---

## 1. Why it exists

Approving was four menu entries across three apps, all filed under **Me** — the place for
things you do for yourself. Approving is the opposite: work you do for other people. An
approver had to know which app a claim came from before they could find it.

Three of those four moved here. **Credit card keeps its own Approve Submissions under Me**,
because a card transaction is not a claim and the menu is named for claims.

**Submitting and history stayed under Me.** Filing your own claim and looking up what you
filed are things you do for yourself. This does split each app across two perspectives,
which is the price of the change and worth stating rather than discovering.

## 2. Screens

### 2.1 Needs you — `/finance/claim-approval/needs-you`

The default, and the question an approver arrives with. Every claim waiting on *them*,
grouped by which app it came from, longest wait first.

Grouped rather than merged into one table. An OPD claim is a set of medical bills checked
against an annual limit; an expense claim is a set of lines with receipts and a stage.
Merging them would need one column set that suits neither, and an Amount column mixing
currencies whose total would mean nothing.

**The waiting column is not the submission date.** It counts from when the claim reached
its *current* approver: submission for a claim still with its lead, and the lead's approval
for one that has moved to finance. Dating a finance wait from submission would charge
finance for the lead's week, and knowing whose backlog it is is the whole point of the
column. Seven days or more is marked.

**Each expense row says which hat it needs** — *as lead* or *as finance* — because the two
backend flags are independent and someone holding both sees both kinds in one list.

**One backend failing does not blank the other.** A finance approver whose OPD backend is
down still has expense claims to get through, so a failure shows a notice above whatever
did load. An empty queue with a failed request is never presented as "nothing to do".

### 2.2 Expense claims — `/finance/claim-approval/expense`

The screen that was two menu entries. Pending / Approved / Rejected, filters by employee
and claim ID, and the app's own review dialog — unchanged.

**The stage is a control here, not a separate entry.** The flags are independent, so a
person holding both had to leave one screen to see the other half of their own queue.
Someone holding one flag sees no switch, because there is nothing to switch to.

The two stages do not mirror each other: a lead's Approved tab spans everything they passed
on, whatever finance did with it afterwards.

### 2.3 OPD claims — `/finance/claim-approval/opd`

Unchanged from the screen it was. Pending asks for `PENDING` **and** `PENDING_OLD` — claims
filed before the status was split carry the legacy value, and asking for `PENDING` alone
hides them from the queue entirely. Pending is not year-scoped, so nothing ages out.

### 2.4 Decided — `/finance/claim-approval/decided`

Claims in this person's scope that already have a decision. Read-only: the review dialogs
open without their decision controls.

**Called "Decided", not "Decided by you", and that is the data's doing.** Both DTOs record
`financeApproverEmail`, so a finance decision can be attributed — but the lead side carries
only `leadApprovedDate` and `leadRejectedDate`, with no lead approver. A lead's own
decisions cannot be told from a co-lead's on the same card. The column names who decided
wherever the backend knows and shows a dash where it does not; the tab does not promise
what the data cannot deliver.

## 3. Who sees what

The rules are the two standalone apps' own, unchanged — only where they are read has moved.

| | Rule | Source |
|---|---|---|
| The rail entry | any of the three below | — |
| OPD tab | `userRoles` contains `555`; `444` is submit-only, and no lead stage exists | `userSlice.ts:38-40` |
| Expense tab | `enableLeadView` **or** `enableFinanceView` | `appDataSlice.ts:99-103` |
| Needs you · Decided | same as the entry | — |

**The entry appears when any one of them says yes.** Requiring all three would hide the
screen from nearly everyone: holding every role across three separate backends is the rare
case. Someone with one flag gets a screen containing exactly one thing, which is correct.

**Each tab is gated at its route, not only hidden from the bar.** A hidden tab is not access
control — the URL can be typed, pasted from a chat, or bookmarked from when the person did
hold the role. A refused tab redirects to one they may see, or explains when that is none.

**Nothing is decided while the backends are still answering.** An unresolved gate reports no
roles, so deciding on it would bounce an approver off the URL they asked for — and a
redirect is not undone when the answer arrives.

## 4. Deviations, and things deliberately not done

**No bulk approve.** The rows in Needs you answer to two different backends with two
different mutations, so a single "approve selected" would either be dishonest about what it
did or need to report partial failure per row. The per-type tabs are where volume work
belongs.

**No cross-type totals.** Mixed currencies make a column total meaningless, so none is
offered.

**Credit card is not here.** It is approved by a lead or by finance like the others, but a
card transaction is not a claim. If it moves later, it is a fourth tab and a fourth gate id,
not a redesign.

## 5. Test checklist

- `claimWaiting.test.ts` — the wait starts at submission for a lead-stage claim and at the
  lead's approval for a finance-stage one; calendar days, so overnight is a day and not
  zero; never negative; survives an unparseable date; longest wait first without mutating
  the caller's array. Fixtures are built from local date parts, so they hold in any
  timezone.
- `useFinanceGate.test.tsx` — the entry on each role alone and withheld from someone who
  approves nothing; the OPD tab needs `555` and not `444`, and no expense flag opens it;
  either expense flag opens its tab; the retired ids are gone from the registry.
- `ClaimApprovalRouting.test.tsx` — opens on Needs you; each role sees only its own tabs;
  a refused tab's URL redirects; nothing is decided while resolving; clicking a tab changes
  the URL.
- `NeedsYouTab.test.tsx` — what each backend is asked for per role, including the legacy
  OPD status and that the finance queue is unscoped; grouping and counts; which hat each row
  asks for; longest wait first; one backend down keeps the other visible; the right dialog
  opens per type.
- `ExpenseApprovalsPage.test.tsx` — both stages' payloads, isolated by holding one flag.
- `DecidedTab.test.tsx` — what each role is asked for, that holding both flags asks once
  rather than twice, who decided where the backend records it and a dash where it does not.

Every mock reports a **disabled** query the way React Query does: `isPending` true (it never
fetches, so it never resolves) with `isLoading` false. A mock that returned `isPending: false`
regardless is what let the screens ship waiting on the wrong flag — they passed their tests
and spun in the browser for anyone holding less than all three roles.

## 6. Unverified — questions for a live tenant

- whether `financeApproverEmail` is populated on a *rejected* claim as well as an approved
  one, which is what the Decided column assumes
- whether a lead's decided queue should span their reports' claims after finance has acted
  on them, or stop at their own decision
- whether `PENDING_OLD` still occurs in current OPD data, or is purely historical
