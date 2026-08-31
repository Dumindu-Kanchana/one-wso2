# Claims — one entry for both kinds

Not a port. The two standalone apps each have their own New Claim and Claim History screens;
this is One WSO2's arrangement of them.

Route: `/me/claims`, with `expense` and `opd` tabs beneath it, and `expense/new` and
`opd/new` as pages of their own. Backends are `ONE_WSO2_EXPENSE_CLAIMS_BACKEND_URL` and
`ONE_WSO2_OPD_BACKEND_URL`; each tab reports its own.

---

## 1. Why it exists

Filing and tracking your own claims was four menu entries — New Claim and Claim History,
twice over. The two histories are near enough the same screen (claim id, when it was
submitted, how much, where it got to), so they are one screen with a tab each.

The **forms** are not the same, and that is what shapes the rest:

| Expense claim | OPD claim |
|---|---|
| out-of-pocket spend, any currency, converted to yours | medical bills, one currency |
| a line carries a job number and a receipt | a bill counts against an **annual limit** |
| any date inside the past-date window | every bill in **one year** |
| lead approves, then finance | finance approves, no lead stage |

There is no single form that could take both, so the type is chosen before a form opens.

## 2. Screens

### 2.1 Claims — `/me/claims`

Opens on **Expense claims**, which are filed more often. Deliberately not "the tab you used
last": two people describing this screen to each other should be looking at the same thing.

Each tab is a route, so a tab can be linked and survives a refresh, and each reports its own
backend's connectivity — the screen spans two, and either may be missing.

### 2.2 Add claim

One button, in the same place on both tabs, whose menu names the two types with a line each
saying what they are for.

**Not a split button whose primary action follows the open tab.** That would save a click,
and cost a button whose label and meaning shift underneath you as you move between tabs. The
two types are easy to confuse and go to different people under different rules, so the choice
is explained where it is made rather than in a dialog of its own to dismiss.

The menu **navigates**; it does not open a form in a box. Both forms are long, both hold a
draft, and both are worth linking to directly.

### 2.3 This year's OPD allowance

The annual limit, what has been claimed against it, and what is left now sit above the OPD
list. They used to appear only inside the new-claim form — after someone had already decided
to file one, when the question "is this worth claiming" has already been answered. Same
`/app-data` call the form makes, so it costs no extra request.

Three figures, not four: `OpdClaimSummary` carries exactly these. The form's fourth stat is
what the claim being written comes to, which has no meaning on a list of filed ones.

When there is no summary the strip is **absent rather than dashed** — a row of "—" above the
claims reads as something broken, and the claims are the point of the screen.

## 3. Who sees what

No role gate. Filing a claim and reading your own history are open to everyone; only deciding
other people's is restricted, and that is Finance → Claim approval.

## 4. Deviations, and things deliberately not done

**Credit card is not part of Claims.** Its transactions arrive from a bank statement rather
than being filed by anyone, so there is nothing to "add" — Claims means the things you file.
It keeps its own entry under Me.

**No combined tab.** Unlike the approval screen, there is no "everything" view: your own
claims are not a queue and nothing here is waiting on you, so ordering the two types together
would answer no question.

**The old URLs are gone, not redirected.** `/me/opd/new` and the other three simply moved.
Nothing is released, so there is nobody holding a link to them.

## 5. Test checklist

- `ClaimsPage.test.tsx` — opens on expense; a tab per type, the URL-named one marked;
  clicking a tab changes the URL; the button reads the same on both tabs; the menu asks
  rather than guessing from the open tab, says what each type is for, and opens the right
  form; the form replaces the tabs rather than opening in a box.
- `OpdHistoryPage.test.tsx` — the allowance shows the three figures the summary carries,
  including what is left; absent rather than dashed when there is no summary; resubmit
  navigates to the form's new path.
- The two history suites mock their own backend as configured, since the tab now owns that
  check rather than a shared frame.

## 6. Unverified — questions for a live tenant

- whether `claimSummary` is ever absent in practice, or only when `/app-data` fails
- whether people who file both kinds would rather the screen remembered the last tab, which
  we chose against for consistency between two people looking at it
