# PAR (Performance Appraisal Review) — functional specification

**Status:** written ahead of the port, from the source implementation rather than from any prior
document. This is the reference for verifying the migration and for writing test cases against it.

**Source of truth for behaviour:** `digiops-hr/apps/par-app` — `webapp/src/` for the UI rules and
`backend/` (`service.bal`, `manager.bal`, `modules/types/types.bal`) for the server rules. Where the
two disagreed, the server is authoritative and the difference is recorded in §9.

**Scale.** 26,837 lines across 111 files, six routes, four roles, ~39 endpoints. The migration is
sliced (see §8); this document covers all of it, so the domain only has to be learned once.

**In One WSO2:** everything under the Me perspective — `/me/par`, `/me/par/history`, `/me/par/team`,
`/me/par/admin`, `/me/par/settings`. The backend is reused unchanged via `ONE_WSO2_PAR_BACKEND_URL`,
already configured.

---

## 1. The domain

Nothing else in this document makes sense without this section.

**A PAR cycle** is a time-boxed, organisation-wide appraisal round — "2024 H2" — created by an
administrator. **Only one cycle can be active at a time**; the backend refuses to create another
while any cycle is `PENDING`, `PENDING_QUOTA` or `OPEN`.

A cycle carries two date ranges and five deadlines:

| Field | Meaning |
|---|---|
| `parCycleStartDate` … `parCycleEndDate` | the performance period being appraised |
| `parEvaluationStartDate` … `parEvaluationEndDate` | when appraisal activity may happen |
| `parEmployeeDeadline` | last day an employee may write and share their own PAR |
| `parThreeSixtyRatingDeadline` | last day to request or give 360° feedback |
| `parLeadDeadline` | last day a lead may write and share their review |
| `parSpecialRatingDeadline` | last day to assign Top 5% / Top 20% |
| `parF2FDeadline` | last day to record the face-to-face meeting |

All are `YYYY-MM-DD` strings. A deadline is "passed" when the current local time is after the **end
of that day**.

**A PAR rating** is one employee's record within one cycle: their own written appraisal, their lead's
review, a rating value, an optional special rating, and the F2F record. It is the central object —
most endpoints hang off `/par-cycles/{id}/employees/{email}/par-ratings`.

**The rating scale is not fixed in code.** It comes from the cycle's own configuration
(`parCycleConfigurations.parRatings`), so it can differ per cycle. Two values are singled out by
deployment configuration rather than by name: one enables the Top 5%/20% option (default
`"Successful"`), and one requires supporting evidence (default `"Needs Improvement"`).

**360° feedback** is peer review. An employee — or their lead — nominates reviewers by email; each
reviewer writes a review that ends up `SHARED` or `REJECTED`. Minimum one reviewer, no maximum. The
employee and their lead are excluded from their own reviewer list.

**Special ratings** are Top 5% and Top 20% — scarce recognitions with quotas allocated per group of
teams. A lead assigns one to a report; the server refuses if the group's quota is already spent.

**The F2F** is the face-to-face conversation between lead and employee, recorded as a completion date
once the lead has shared their review.

### Status values

| Enum | Values |
|---|---|
| `ParCycleStatus` | `PENDING`, `PENDING_QUOTA`, `OPEN`, `CLOSED` — and `FAILED`, which the backend can set but no screen displays (§9) |
| `ParEmployeeStatus` | `PENDING`, `DRAFT`, `SHARED`, `SHARED_BLOCKED` |
| `ParLeadStatus` | `PENDING`, `DRAFT`, `SHARED` |
| `ParF2fStatus` | `PENDING`, `SCHEDULED`, `COMPLETED` |
| `ParThreeSixtyReviewStatus` | `PENDING`, `DRAFT`, `COMPLETED` (wire value `"SHARED"`), `REJECTED` |
| `ParSpecialRating` | `TOP5P`, `TOP20P`, `NOT_ASSIGNED` |

`SHARED` means visible to the other party and no longer editable by the author. **Sharing is
one-way** — neither an employee nor a lead can unshare.

---

## 2. Roles

Four roles, from **two different sources** — which matters, because it is why PAR cannot reuse One
WSO2's people-app capability model.

| Role | Where it comes from |
|---|---|
| `ADMIN` | an Asgardeo group on the ID token |
| `EMPLOYEE` | an Asgardeo group on the ID token |
| `LEAD` | PAR's own employee-info response (`lead`) |
| `TEAM_LEAD` | PAR's own employee-info response (`isTeamLead`) |

**Only `TEAM_LEAD` opens the Lead Portal.** `LEAD` gates one different thing — see below. The source
carries a standing note about moving both to Asgardeo groups eventually.

### 2.1 `LEAD` versus `TEAM_LEAD` — settled

This was an open question through Slices 0–2, and an earlier draft of this section said `LEAD` "gates
nothing meaningful". That was wrong. Read from the source's `authSlice` and route table:

| Role | Derived from | Gates, in the entire source |
|---|---|---|
| `TEAM_LEAD` | `employeeInfo.isTeamLead` | the **Lead Portal** route, and nothing else |
| `LEAD` | `employeeInfo.lead` | the **chain view** tab in PAR History, and nothing else |

Each is referenced exactly once outside the auth slice, and they gate different screens, so they are
genuinely distinct rather than two names for one idea.

The chain view's condition is `isLead && hasSubordinates` — both the `lead` flag AND the employee
directory agreeing the person manages someone. The source computes the second half client-side from a
full directory fetch. This port does not need that: `/employees?leadEmail=<self>` is the same request
the chain view makes to populate its root, so "has reports" is whether that answers with anyone.

**So:** `useParGate` gating the lead screens on `isTeamLead` alone is correct and stays. The chain
view gets `lead` plus a non-empty reports list, and neither flag substitutes for the other.

An administrator does **not** see the Lead Portal unless they are also a team lead. Instead they
reach the same review screens through the Admin Portal in one of two modes (§6.4).

| Who | What they get |
|---|---|
| Employee | `/me/par`, `/me/par/history` |
| Team lead | the above, plus `/me/par/team` |
| Admin | the above as applicable, plus `/me/par/admin` and `/me/par/settings` |
| None of these | "not available to you" — never an error |

---

## 3. The cycle lifecycle

```
(none) --create--> PENDING --[server job]--> PENDING_QUOTA --assign quota--> OPEN --close--> CLOSED
                      |
                      +--[job fails]--> FAILED   (no screen shows this)
```

- **Create** posts the cycle and returns immediately with `PENDING`. The server then runs an
  asynchronous job that snapshots every active employee into special-rating groups, PAR teams and
  default ratings.
- **`PENDING` → `PENDING_QUOTA`** happens by itself when that job finishes. The admin screen polls
  every 10 seconds waiting for it.
- **`PENDING_QUOTA` → `OPEN`** is the admin assigning quotas. Saving quotas and opening the cycle are
  two calls; the cycle only opens if the quota save succeeded.
- **Opening the cycle emails every participant.** This happens on that transition only.
- **`OPEN` → `CLOSED`** is a single confirmed action. **There is no way back.** A closed cycle
  rejects rating writes server-side.

---

## 4. What each deadline actually gates

This table is the heart of the specification. The deadlines do **not** apply uniformly, and one of
them gates nothing at all.

| Deadline | What it locks | Who it affects |
|---|---|---|
| `parEmployeeDeadline` | writing and sharing your own PAR | employee |
| `parLeadDeadline` | writing and sharing a lead review — forces the whole panel read-only | lead |
| `parThreeSixtyRatingDeadline` | requesting 360° feedback | employee and lead |
| `parF2FDeadline` | recording the F2F — the form is hidden entirely, with an explanation | lead |
| `parSpecialRatingDeadline` | **nothing — deliberately.** It only advances a progress stepper | — |

That last row is faithful to the source and is a settled decision, not an oversight (§9.1): the
deadline exists, is configured, is validated on creation and is displayed — but nothing checks it,
and the port does not add a check. It is a communicated date, not a lock. Assigning a special rating
after it passes succeeds.

**A `CLOSED` cycle overrides all of the above** — the server refuses rating writes regardless of any
deadline.

---

## 5. Employee-facing screens

### 5.1 My PAR — `/me/par`

The employee's own appraisal for the open cycle.

- Answer the cycle's `employeeParQuestion` in a rich-text field. Saved as a draft.
- Nominate 360° reviewers by email — at least one; the employee and their lead are excluded.
- Answer 360° requests made *of* them by colleagues.
- **Share** the PAR, which makes it visible to the lead and locks it. One-way.
- After the lead has shared their review, the employee sees it and the F2F record.

Locked when: already `SHARED`, or `parEmployeeDeadline` has passed, or the cycle is `CLOSED`.

**The lead cannot share their review until the employee has shared theirs** — a lead review is
blocked while the employee's status is `PENDING`.

### 5.2 PAR History — `/me/par/history`

Past (`CLOSED`) cycles: what the employee wrote, what their lead wrote, the rating awarded, and any
special rating.

The source pairs this with a second tab, the **chain view**. This spec previously described it as
showing the appraisal *up* the reporting line; that was wrong. It browses **downward** — an org-tree
walker with breadcrumbs, search and a leads-only filter, opening any subordinate's PAR history — and
it is shown only to people who have reports. It reads other employees' appraisals, so it belongs with
the lead screens; see §8.6.

---

## 6. Lead and admin screens

### 6.1 My Team's PAR — `/me/par/team`

Five areas: **Direct Reports**, **Additional Reports** (indirect only), **Report Chain** (drill down
through subordinates' subordinates), **Employee History**, and **Top 5%/20% Allocation** (read-only).

With more than one team the lead first picks a team; with exactly one they go straight to it. Each
team shows completion counts (Employee PAR, Lead's PAR, F2F) and a member list with per-member
status.

Opening a member gives three tabs — **Lead's Feedback**, **360 Reviews**, **F2F** — and a PAR history
button. The lead writes feedback, picks a rating, optionally assigns Top 5%/20% or attaches evidence,
then **Shares**. Sharing is one-way and unlocks the F2F tab, where a completion date is recorded.

Other actions: bulk-share several drafts at once (**all** selected must be drafts), copy selected
emails, send a 360° reminder, sync an employee into the cycle, request 360° feedback on a report's
behalf, and download a PDF summary.

**The evidence rating requires proof.** When the rating is the evidence-enabled value, sharing is
blocked until the lead ticks a confirmation that at least two discussions were held *and* attaches at
least one supporting file.

**Top 5%/20% requires a confirmation.** The option only appears for one specific rating value, and a
checkbox stating the decision was finalised with the functional lead must be ticked before the
selector is enabled. Changing the rating away resets the special rating.

**Quota is enforced by the server, not the browser.** The lead sees allocations but nothing stops
them choosing; the save fails with a quota error if the group is full. One group shape is special: a
group with a Top 5% quota of 1 and Top 20% of 0 is a single flexible slot usable for either.

### 6.2 PAR Administration — `/me/par/admin`

Two tabs: **Ongoing** and **History**.

Ongoing shows one of four things depending on cycle status: an empty state offering **Create Cycle**;
the creation form; the **quota assignment** screen; or the **organisation dashboard**.

The dashboard carries completion cards and four views — Team, Employee, Rejected Reviews, and Quota
Allocations — plus reports and CSV export. From here an admin can edit the open cycle's dates and
questions, send bulk reminders, sync an employee, restore a declined 360 review, and close the cycle.

**Quota assignment** is the gate between `PENDING_QUOTA` and `OPEN`. The admin groups teams, and
every team must end up in a group before the cycle can open. Each group gets default slots derived
from head count — roughly 5% and 20%, with a floor of one each and an adjustment so the two do not
double-count — which the admin may lower but not raise. Each group needs at least one allocated lead.

### 6.3 PAR Settings — `/me/par/settings`

Four organisation-wide defaults: the employee question, the 360° question, and the two rating scales.
**These affect future cycles only** — an open cycle keeps the configuration it was created with, and
the server refuses attempts to change a created cycle's rating scales.

### 6.4 The two admin views of a lead's screen

An admin reaches the lead review UI in one of two modes:

- **Audit view**, for the open cycle: read–write, and it **bypasses the deadline locks**. An admin can
  share or override a lead's rating after the lead deadline has passed, and can write an admin
  comment. See §9 — this is the item most worth confirming with the service owners.
- **History view**, for closed cycles: strictly read-only, with the destructive and administrative
  controls hidden.

---

## 7. API contract

All requests carry the signed-in user's bearer token. Base URL `ONE_WSO2_PAR_BACKEND_URL`. Roughly 39
endpoints; grouped here by purpose rather than listed exhaustively.

| Group | Endpoints |
|---|---|
| Cycles | `GET /par-cycles?status=…`, `GET /par-cycles/{id}`, `POST /par-cycles`, `PATCH /par-cycles/{id}` |
| One person's PAR | `GET`/`PATCH /par-cycles/{id}/employees/{email}/par-ratings[/{ratingId}]` |
| 360° | `GET`/`POST …/reviewers`, `GET …/reviews`, `GET …/review-requests`, `GET`/`PATCH …/review` |
| Teams and reports | `GET …/teams[/{teamId}]`, `…/reports`, `…/report-levels`, `…/participants`, `…/par-ratings` |
| Special ratings | `GET …/special-rating-groups`, `GET`/`POST …/special-rating-groups-quota` |
| History | `GET /par-ratings/summary/{email}` |
| Reminders | six `PATCH /reminders/…` endpoints (§9) |
| Calendar | `GET /calendar/busy-times`, `POST /calendar/schedule-f2f` |
| Config | `GET`/`PUT /meta/configurations`, `GET /meta/employees`, `GET /employees` |
| Housekeeping | `POST …/employees/{email}/sync`, `GET /health` |

Comments are base64-encoded on the wire and decoded for display.

---

## 8. Migration slices

| Slice | Contents | Source size |
|---|---|---|
| 0 | Shared foundation — types, gate, deadline predicates, shell. Nothing user-visible. | — |
| 1 | My PAR (`/me/par`) | 1,531 |
| 2 | PAR History (`/me/par/history`) | 670 |
| 3 | My Team's PAR (`/me/par/team`) | 5,520 |
| 4 | Administration and Settings | 5,920 |

PAR's own Profile screen is **not** ported: One WSO2 already renders the same employee detail on My
profile, and a second screen showing the same person would be a regression.

### 8.1 What Slice 0 landed

`src/features/par/` — `api/parTypes.ts`, `api/useParMe.ts`, `api/useParGate.ts`,
`util/parItems.ts`, `util/parDeadlines.ts`, `util/parStatus.ts`, `components/ParShell.tsx` — plus
`parServiceUrls` grown from 2 to ~30 endpoints, `digiopsHeaders` moved to `@api/`, and the PAR
dispatch added to `SideRail.resolveVisible`. 38 tests. Nothing user-visible: the registry has no PAR
items yet, so the rail dispatch is inert until Slice 1 adds them. It is wired first on purpose —
adding the items before the gate that hides them is what leaks an admin screen.

Roles resolve from two sources that must **both** land before the shell renders a decision:
`isAdmin` from an Asgardeo group named by `ONE_WSO2_PAR_ADMIN_GROUP`, `isTeamLead` from PAR's own
employee record. Reading one before the other arrives would show a denial to someone who has access.
With the group key unset, nobody is an admin — withholding, not granting, is the safe default.

### 8.2 Deviations from the source, taken in Slice 0

Three of these change words a user reads, so they are recorded rather than left as silent drift.

| Source behaviour | Here | Why |
|---|---|---|
| Completed and pending statuses render as an **icon whose only label is a hover tooltip** | A text label beside the icon | A tooltip is unavailable to a screen reader and to any touch device, so the status was effectively unlabelled for both |
| Every other status goes through `capitalizeFirstLetter`, so `SHARED_BLOCKED` reads **"Shared_blocked"** | "Shared (locked)" | The underscore is wire format leaking into the UI. The label also has to say *why* an apparently-shared PAR can't be edited, or being locked out of it looks like a fault |
| A declined 360 request reads **"Rejected"** | "Declined" | The reviewer declined a request to give feedback. "Rejected" reads as a verdict on the person being reviewed, which is not what happened |
| `ParSpecialRating.NONE` renders as **"N/A"** | "—" | Having no special rating is the common case and should be quiet, not flagged as inapplicable |
| One status vocabulary shared across all five enums | One map per enum | The wire value `SHARED` means "shared with the lead" on a PAR and "**completed**" on a 360 review; a shared map has to pick one word and gets the other wrong |

The one source behaviour deliberately **kept**: a 360 review still `PENDING` once its deadline has
passed renders as "—" rather than "Pending", because nobody can act on it any more.

---

### 8.3 What Slice 1 landed

`/me/par`, registered as the `par-my` item under a new PAR app group in `ME_APPS` — which is what
switches on the rail dispatch built in Slice 0. Three panels: the employee's answer with draft/share,
360° nomination, and the requests others made of them.

New in `features/par/`: `util/parHtml.ts` (sanitising, 15 tests), `util/parEditability.ts` (why the
answer is locked, 12 tests), `util/parReviewers.ts` (who may be nominated, 13 tests),
`util/useParNow.ts` (one clock, ticking at local midnight), `api/useParEmployee.ts`,
`api/useParEmployeeMutations.ts`, and six components. 12 further tests cover the page.

### 8.4 Deviations from the source, taken in Slice 1

| Source behaviour | Here | Why |
|---|---|---|
| The nomination dialog excluded only the **lead** when you nominated for your own PAR | Both the employee and their lead are excluded | You could nominate **yourself** as your own 360° reviewer — feedback you write about yourself, presented to your lead as a colleague's view. The mirror case is in the same function for Slice 3: nominating for someone else's PAR excluded only the reviewee, not their lead |
| No way to **decline** a 360° request, though the backend has a `REJECTED` status | A Decline action | An unwanted or mistaken request otherwise sat outstanding forever, and the asker had no way to learn it would never be answered |
| `react-quill` for rich text | A small field in `components/ParRichText.tsx` | Not a preference: react-quill 2 calls `ReactDOM.findDOMNode`, which **React 19 removed**. The five commands the stored HTML actually contains are cheaper than a fork or a larger editor |
| HTML sanitised on display in one component | Sanitised on the way in **and** out, in one place | Sanitising only on display trusts whatever an older client stored; only on input trusts the backend. Every PAR free-text field is an injection site |
| Submitting a 360° review accepted a rating with no comment, or a comment with no rating | Both required to submit | A bare rating is not feedback. Drafts are still saved with either half |
| A missing cycle fell through the deadline checks | Its own state, `noCycle` | Reported as "the deadline passed" it names a date nobody set, and sends the reader to ask about it |

One source oddity **kept**: nominations are additive and the backend appends, so there is no way to
withdraw a request once sent. Removing one is a backend capability that does not exist.

### 8.5 What Slice 2 landed

`/me/par/history`, registered as `par-history`. A table of closed cycles, newest first, opening one at
a time into a full appraisal: what the employee wrote, what the lead wrote, the rating awarded, any
special rating, and the three statuses the record ended on.

New: `api/useParHistory.ts` and `util/parDates.ts` (9 tests), plus 10 tests on the page. The list and
the detail are separate requests — a person with several years of cycles would otherwise fetch every
appraisal to render a table showing none of them.

### 8.6 What Slice 2 deliberately did NOT land

**The chain view is deferred to Slice 3**, with the lead screens. It is 363 of the source view's 670
lines, and it is not an employee feature: it walks the org tree and opens **other people's**
appraisals.

The reason for deferring rather than porting is the gate, not the effort. The source shows the tab
when the signed-in user appears as somebody's manager in the employee directory — a set it computes
client-side from a full directory fetch. This port has two candidate signals instead, `isTeamLead`
from PAR's own record and the `lead` flag beside it, and **§9's open question about which of those
means what is unresolved**. Guessing wrong in either direction on a screen that exposes colleagues'
appraisals is not a trade worth making to close a slice. Slice 3 settles the role semantics, and the
chain view lands behind whatever that turns out to be.

Everything else in §5.2 is in place. **The chain view landed in 3c** — see §8.11.

### 8.7 Deviations from the source, taken in Slice 2

| Source behaviour | Here | Why |
|---|---|---|
| History rendered in whatever order the backend returned | Sorted newest-first in the client | The endpoint does not specify an order, and a history that is not newest-first reads as unordered |
| A rating of `NOT_ASSIGNED` displayed as itself | "No rating recorded" | It is the backend's way of saying no rating was given — printing it states a value that is really an absence |
| Both tabs held in one screen, one of them lead-only | One screen, employee-only | See §8.6 |

### 8.8 Slice 3, proposed breakdown

Slice 3 is the largest thing in this port and the first to write to **other people's** appraisals, so
it is broken up rather than attempted whole.

**The 5,520 figure understates it.** That counts `views/leadPortal/` only. The lead screens also pull
in shared components not counted there — the allocation view (351), employee history (372), the two
F2F components (724), the quota dialogs (332) and more — so the real scope is nearer **7,000 lines**.

| Sub-slice | Contents | Source lines | Writes? |
|---|---|---|---|
| **3a** Team overview | The portal shell, team picking (one team vs many), completion counts, member list with per-member status | ~1,630 | no |
| **3b** The lead's review | The three tabs, feedback, rating, evidence proof, Top 5%/20% and its confirmation, one-way share, the F2F record | ~3,100 | **yes** |
| **3c** Browsing others' PARs | Additional reports, report chain, employee history, the read-only allocation view — and the chain view deferred from Slice 2 | ~1,740 | no |
| **3d** Bulk and utility actions | Bulk share, copy emails, 360° reminder, employee sync, request 360° on a report's behalf, PDF summary | ~500 | yes |

Ordered 3a → 3b → 3c → 3d. 3a first because it is read-only and settles the team/report data model
before anything writes through it; 3b needs 3a's member selection to exist.

**There are two chain views, and they are not duplicates.** `parHistory/ChainViewTab` (363) walks the
employee directory to browse **history** down the chain; `leadPortal/ReportChainView` (535) walks it to
browse the **live cycle's** PARs. Different endpoints, different purpose. Both are in 3c, and the
Slice 2 deferral refers to the first only.

Three things to carry into the work rather than discover in it:

1. **The two write-blockers belong as pure predicates**, tested at their boundaries the way
   `parEditability` is. The evidence rating blocks sharing until a confirmation is ticked AND a file
   is attached; Top 5%/20% is disabled until a separate confirmation is ticked, and resets when the
   rating changes. Both are conditional locks on a one-way action.
2. **Quota is enforced server-side only** (§6.1). The client cannot pre-empt it, so the quota error
   has to be surfaced legibly rather than as a generic failure — including the special one-flexible-slot
   group shape.
3. **§9.7's source bugs live here**: the team-row button that returns its handler instead of calling
   it, the completion chips comparing a string to a number so they never turn green, the special
   rating converted to a label and back so the export and the chip disagree, and the edit form that
   ignores the F2F deadline. Each belongs to a named sub-slice above rather than to "Slice 3".

### 8.9 What sub-slice 3a landed

`/me/par/team`, registered as `par-team` and gated on `isTeamLead` — the first PAR screen that reads
other people's appraisals, so the refusal path has its own test. Read-only by design: opening a member
to write their review is 3b, so there is no row action yet rather than a control that does nothing.

Totals across every team the lead holds, then per team its own progress, its **remaining** quota, and
its members with each stage's status. New: `api/useParTeams.ts`, `util/parTeamSummary.ts` (9 tests),
`ParCompletionBar`, `ParTeamMemberTable`, and the page (12 tests).

**Deviations taken in 3a:**

| Source behaviour | Here | Why |
|---|---|---|
| `CompletionStatusCard` computed `(completed * 100) / total` | Guarded, clamped, and 0 for an empty team | A team with no members produced **NaN** and handed it to the progress bar. Members can legitimately be zero — a team synced into a cycle before anyone is assigned |
| Quota shown as allocated | Shown as **remaining**, out of allocated | The allocated figure tells a lead nothing about whether they can still award one, which is the only question they are asking |
| A rating of `NOT_ASSIGNED` rendered as itself | An em dash | Same as §8.7; it is an absence, not a value |
| Progress bars only | The count beside the bar | A bar cannot say 3 of 4, and 3/4 versus 30/40 changes what a lead does next |
| A lead with no teams fell into a generic empty state | Its own message, naming the cycle, pointing at a sync | Being assigned after a cycle opens is normal, and it must not read as a permission problem |

Not ported yet, and deliberately: the per-member 360° review status here comes from the team endpoint's
own `par360ReviewStatus`, which is a summary. The full 360° list per member belongs to 3b's review
screen.

### 8.10 What sub-slice 3b landed

The lead's review of one report, at `/me/par/team/:employeeEmail` — a route rather than a dialog,
matching the employee-detail screen under My Team, so a lead working through a list can link to,
reopen and pin a person. Gated on `isTeamLead`, like the list it comes from.

Three areas: what the employee wrote, the lead's own review (rating, feedback, Top 5%/20%, evidence,
one-way share), and the face-to-face record. New: `api/useParLead.ts`, `util/parLeadReview.ts`
(19 tests), `util/parEvidence.ts` (15 tests), `util/useDrivePicker.ts`, four components, and the page
(16 tests).

**The CSP was widened for the Drive picker**, by decision, to keep the source's UX. `apis.google.com`
and `accounts.google.com` for script, `docs.google.com` and `accounts.google.com` for frames,
`accounts.google.com` and `www.googleapis.com` for connect, and the two gstatic hosts for the
picker's icons. Named hosts rather than a `*.google.com` wildcard, which would admit every Google
property. All third-party script loading is confined to `useDrivePicker.ts` so that stays true. **The
allow-list is derived from the picker's source and has not been verified against a live client id** —
a missing origin shows as a specific CSP console error, and each entry is commented with its purpose.

**Deviations taken in 3b:**

| Source behaviour | Here | Why |
|---|---|---|
| The three areas behind tabs | Stacked on one screen | A lead needs the employee's words and the 360° feedback in front of them *while* writing the review, not one click away |
| Evidence only via the Drive picker | Picker **and** a paste field | The evidence requirement blocks sharing, so a failed Drive consent would leave a lead unable to finish. The stored value is a URL list either way, so pasting is not a lesser path |
| Both confirmation checkboxes restored from the saved draft | Always start unticked | They attest to something the lead did. A tick restored from storage asserts it on their behalf |
| A duplicate document attached twice | Collapsed to one | The source kept both, showing two identical chips |
| Any URL accepted as evidence | https and Google hosts only | `google.com.evil.example` passed a naive check, and an arbitrary link is not evidence of anything |
| The share conditions duplicated across two buttons' `disabled=` clauses | One tested predicate | Two copies of a four-part rule is how they drift |
| A "held" conversation could be saved with no date | Date required for scheduled and held | Recorded as having happened on no particular day |

Still outstanding in Slice 3: **3c** (additional reports, report chain, employee history, read-only
allocation) and **3d** (bulk share, reminders, sync, PDF).

### 8.11 What sub-slice 3c landed

Four read-only views, all reached from screens that already existed.

On `/me/par/team`, three further tabs: **Additional reports** (people under the lead's reports, and
anyone attached as an additional manager), **Report chain** (drilling the open cycle's PARs level by
level), and **Top 5% / 20%** (the quota pools and the teams drawing from them). Each fetches nothing
until opened.

On `/me/par/history`, a **Team history** tab — the chain view deferred out of Slice 2. It walks the
employee DIRECTORY rather than the cycle, so it reaches people who were not in the open cycle or in
any. Gated per §2.1 on the `lead` flag AND the directory agreeing the person has reports; either
alone is wrong, because the flag can outlive a reorganisation and having reports does not by itself
make somebody a lead in PAR's terms.

On the review screen, **Earlier cycles** for the report being reviewed — context for the review being
written, so it sits last.

New: `api/useParReports.ts`, `api/useParAllocation.ts`, `api/useParDirectory.ts`,
`util/parReports.ts` (12 tests), `util/parAllocation.ts` (12 tests), `util/parChain.ts` (10 tests),
and five components. The history table and detail were extracted into one shared panel used by the
employee's own history, a report's, and the team browser — its copy is passed in as data rather than
switched on a flag, so a caller cannot render "what you wrote" over somebody else's words.

**Deviations taken in 3c:**

| Source behaviour | Here | Why |
|---|---|---|
| `isEmployeeALead` compared case-insensitively in the filter and `=== "True"` exactly in the badge, 200 lines apart | One case-insensitive parse | With a backend answering `"true"` the filter worked and the badge silently never appeared |
| A strict `reportingType === "indirect"` check | Case-insensitive, and anything unrecognised counts as direct | A strict check drops an unexpected value from **both** lists; showing somebody in the wrong one is better than losing them |
| A quota pool of 1 and 0 rendered literally | Labelled "1 slot · Top 5% or Top 20%" | Read literally it says "no Top 20%", telling a lead they cannot award something they can (§6.1) |
| Allocation search hid whole pools | Narrows teams within a pool, keeping the pool | The quota belongs to the pool, so hiding it hides the figure being searched for |
| Drill-down offered on every row | Only for someone with reports | A leaf drills into an empty level, which reads as a broken control |
| Chain trail held in component state with three handlers | `util/parChain.ts`, tested | Re-entering somebody already in the trail now truncates rather than appending, so a loop in the reporting data cannot grow it without bound |
| Two near-identical history tables | One shared panel, copy as data | They would drift, and the wording differs by reader rather than by structure |

### 8.12 What sub-slice 3d landed

The six team-wide actions, as a toolbar above the member list: **share selected**, **copy emails**,
**remind 360° reviewers**, **add someone to the cycle**, and on the review screen **download
summary**. Requesting 360° feedback on a report's behalf reuses the nomination path from Slice 1.

New: `util/parBulkShare.ts` (10 tests), `util/parPdf.ts` (8 tests), three mutations on
`api/useParLead.ts`, `ParTeamToolbar`, and row selection on the member table.

**Bulk share has no bulk endpoint.** It is one PATCH per person, sequential — parallel would make
which writes win the Top 5% / 20% quota a race. So **partial success is the normal outcome**, and the
summary is the mutation's return value rather than an exception: throwing would discard the record of
what did go through. The result names both halves, who failed, and why, de-duplicating identical
reasons so twelve rows failing one quota produce one sentence.

**The PDF needed two dependencies, and they came with a caveat.** `jspdf` and `jspdf-autotable`, both
imported **dynamically** — roughly 600KB across their chunks, and only a lead who presses the button
ever fetches them. Both are pinned to an **exact version**, as every other dependency in this repo
is: `jspdf` at 4.2.1, `jspdf-autotable` at 5.0.8.

The exact pin is not housekeeping here. Every jspdf line up to 4.2.0 carries advisories, two of them
critical, so `^3` installs a flagged package — and even `^4.2.1` would let a future 4.x with a fresh
advisory arrive silently on a clean checkout. Pinned, a version change is a reviewed diff.

Exposure to that history was always small: the advisories concern AcroForm fields, the `addJS`
plugin, the image decoders and HTML injection in new-window paths, while this uses text output and
`autoTable` only. But shipping a flagged package is its own problem. `jspdf-autotable@5` accepts
`^2 || ^3 || ^4`, so the major bump cost nothing.

`html2canvas` (197KB) arrives as an **optional** dependency of jspdf, needed only by `doc.html()`,
which this never calls. It lands in its own chunk and is therefore never fetched.

Production audit after the change: 7 findings, all pre-existing transitive ones — the single high is
`brace-expansion`, via `exceljs → archiver → glob → minimatch` — and none from jspdf.

**The maintenance cost is worth knowing:** ten advisories up to 4.2.0 is an active vulnerability
stream, so jspdf will be flagged again and someone will have to bump it. If that churn stops being
worth it, the zero-dependency escape is a print stylesheet plus `window.print()`, letting the browser
make the PDF — at the cost of control over pagination and table styling.

**Deviations taken in 3d:**

| Source behaviour | Here | Why |
|---|---|---|
| A mixed bulk selection refused with a snackbar | Refused, with the button disabled and the reason stated | All-or-nothing is right — quietly filtering to the shareable rows would let a lead believe they had shared somebody they had not — but a disabled button that does not say why reads as broken |
| Bulk result reported as counts in a snackbar | Counts, the failed addresses, and de-duplicated reasons, in a dismissible panel | A snackbar cannot hold which people to go back to, which is the only actionable part |
| `navigator.clipboard` assumed available | Failure reported | An insecure origin or a denied permission both leave it unavailable, and doing nothing silently reads as a broken button |
| PDF library bundled | Imported on demand | 600KB for a button most users never press |

---

### 8.13 Fixes found while testing

**The rail lit the wrong item on a detail route.** `/me/par/team/<email>` lit "My PAR". The rail's
descendant pass returned the first item whose path prefixed the URL, in registry order, and `/me/par`
is registered before `/me/par/team`. The rule is now the longest match — the most specific route wins
— extracted into `components/side-rail/activeItem.ts` and tested against the real registry.

PAR is the first app whose home item sits at the app ROOT with siblings beneath it; every other app
puts its home under a deeper path, so no sibling had ever prefixed another. The two collisions in the
whole registry are both PAR's.

**A cycle's question printed its own markup.** A configured question arrived as
`Job Execution (…) <br/>Team Work (…)` and the tags showed literally.

This is not a regression — the standalone app renders these questions as plain text too, so it has
the same behaviour. The cause is an authoring mismatch: the settings screen offers a **plain multiline
text box**, and admins have typed HTML into it. Real data therefore carries both conventions, hand-typed
`<br/>` and actual newlines, and printing as text serves neither author — the tags show, and the
newlines collapse.

Both are now rendered through `parConfiguredTextToHtml`, which converts newlines to breaks and then
applies the same allow-list as employee prose, so a question cannot inject markup the rest of the
feature refuses. Applied to the employee question and the 360° question.

The deeper fix belongs to Slice 4: the settings screen should either offer a rich-text field or state
that the box is plain text. Until then, rendering what admins have actually written is the closer
approximation of intent.

---

### 8.14 The wire format for comments — a port defect, found in audit

**Every PAR comment field is stored base64-encoded, and this port was sending
raw HTML.** The standalone app writes `btoa(encodeURIComponent(html))` and reads
`decodeURIComponent(atob(stored))`, guarded by a base64 test, for four fields:
`parEmployeeComment`, `parLeadComment`, `parAdminComment` and `reviewComment`.

Consequences of getting it wrong, both directions:

- Anything this port **wrote** was stored as raw HTML. The real app tests for
  base64 and blanks anything that fails, so those comments read as EMPTY there —
  silent data loss from the user's point of view.
- Anything the real app **wrote** was rendered here as base64 gibberish.

Neither is visible on a staging tenant with no comments in it, which is why it
survived four slices of review.

Now handled by `util/parCommentCodec.ts` at the API boundary — encoded in the
three mutations, decoded in every query that returns a comment — so no component
can get it wrong. Its `decodeParComment` reproduces the source's behaviour
exactly, including blanking a value that is not base64: such a value is already
invisible in the real app, and passing it through would show content the real
app hides.

`api/parWireFormat.test.tsx` asserts the PATCH body rather than the codec, because
the codec having its own tests said nothing about whether it was wired in.

**Why it was missed:** the audit that found it was prompted by the user's review,
not by the port. The four slices before it recorded 37 deviations from the source
without a single check that the data format matched — the reviews had all been of
behaviour and copy.

---

### 8.15 What Slice 4 landed

`/me/par/admin` and `/me/par/settings`, both gated on `isAdmin`, each with a test that a non-admin is
refused — these screens create and close cycles for the whole organisation.

**Administration** is two tabs. *Ongoing* is a state machine over which cycle exists, ported branch
for branch from `views/adminPortal/panels/OngoingPanel.tsx` into `util/parAdminState.ts` (10 tests),
because the branches are not mutually exclusive in the data and the order they are checked in IS the
behaviour: open > quota-pending > pending > none. *History* lists closed cycles into the same summary.

New: `api/useParAdmin.ts`, `util/parAdminState.ts`, `util/parCycleForm.ts` (12 tests),
`util/parQuotaDefaults.ts` (7 tests), `ParCycleForm`, `ParAdminQuotaPanel`, `ParAdminSummaryPanel`,
and the two pages (18 tests).

**A defect found while porting, in already-shipped code:** the four reminder endpoints are **PATCH**,
and slice 3d's "Remind 360° reviewers" was sending POST. The backend would have refused it with a 405.
Corrected.

**Ported carefully rather than tidied:**

- `calculateDefaultQuotaValues` is reproduced arithmetic-for-arithmetic. Its last step subtracts the
  5% figure from the 20% one, so the stored 20% quota is the awards ABOVE the Top 5% ones, not the
  whole top fifth — recomputing them independently would over-allocate. An empty group also ends up
  at `{1, 0}`, because the `> 0` guard is skipped and both figures are then floored to 1; reproduced,
  since an empty group has nobody to award to.
- The cycle form's validation is field for field and **message for message**. Two source omissions are
  reproduced: `parF2FDeadline` has no rule at all, and `parEvaluationStartDate` has none of its own.
  Tightening either would refuse cycles the real app accepts. The lead deadline carries both a `.min()`
  and a separate strict test, and only the strict one stops the two deadlines sharing a day.
- §9.3 and §9.4 are carried forward, not fixed. The PENDING poll stops when the list empties for any
  reason, including a failed job — so the screen then offers to create a cycle whose slot is occupied.
  And the quota grouping lives in browser state until one save.

**Deviations, and the reason for each:**

| Source behaviour | Here | Why |
|---|---|---|
| `calculateDefaultQuotaValues` returns `{NaN, NaN}` for a non-finite headcount | Zeroed | Neither `=== 0` nor `< 1` is true of NaN, so nothing corrects it, and a NaN quota would be stored and then compared against. The only deliberate divergence in the arithmetic, and it can fire only on input the backend cannot send |
| §9.4 unstated on screen | Stated | "There is no way to save one group at a time" is expensive to discover by losing an hour's grouping. It withholds nothing |
| §9.3 unstated on screen | Stated | A poll that stops silently is indistinguishable from one that succeeded |
| Two separate forms for creating and configuring a cycle | One component, two modes | The fields and the rules are identical; two copies would drift, and the rules are the part that must not |
| Icon-only chip delete with no accessible name | Named | Unreachable by keyboard or screen reader. New UI, not source behaviour |

**Judgement calls, since none of these had a source answer:**

1. **Placement stays under Me** (`/me/par/admin`), as §8.8 recorded provisionally. It is an HR function
   and People Ops is the perspective for that, but both screens are admin-gated either way, so moving
   them is a registry entry and a route prefix. Not something to decide while porting.
2. **The two unreachable reminder endpoints (§9.5) are still not surfaced.** They run on server crons
   disabled by default, so a button would claim an effect that may not happen.
3. **Report is a table, not a download.** The source's "Report" view is an org-wide participant list;
   it renders as one here, behind a toggle so the row-per-employee fetch only happens when asked for.

---

## 9. Defects and questions in the source

Carried forward deliberately, so they are tracked rather than rediscovered. Items 1 and 2 want a
decision before the relevant slice. The `LEAD` versus `TEAM_LEAD` question that stood here through
Slices 0-2 is now answered in §2.1.

1. **The special-rating deadline is informational — decided, not a defect.** `parSpecialRatingDeadline`
   is configured, validated on creation and shown in the cycle stepper, but no control enforces it and
   the port does not add enforcement. Assigning Top 5%/20% after it passes succeeds, by design. It is
   a date the organisation communicates, not a lock. Do not "fix" this later without checking here
   first — the absence of a check is deliberate.
2. **The admin audit view bypasses deadline locks — accepted.** An admin opening the live cycle gets
   the lead's review screen in read-write mode with the deadline guards disabled, and may share or
   override a lead's rating after the lead deadline. This is intended behaviour and the port keeps it.
3. **A failed cycle is invisible.** If the post-creation job throws, the backend sets a `FAILED`
   status that no screen queries, so the admin sees "create a cycle" — and creating one then fails
   with a conflict, because the failed cycle still occupies the single active slot.
4. **Quota assignment is not resumable.** The grouping is held in browser state until one save. A
   refresh mid-way loses it, and if the save succeeds but opening the cycle then fails, the cycle is
   stranded with quotas already stored.
5. **Two reminder endpoints are never called by the UI**; they run on server crons that are disabled
   by default. Of the four the UI does call, one is lead-only despite living in an admin screen.
6. **Google Meet scheduling is unreachable for leads** — the component exists and is wired, but the
   flag enabling it is never passed on that path.
7. **Assorted source bugs**: a team-row button that returns its handler instead of calling it;
   completion chips comparing a string to a number so they never turn green; a state reset called
   without dispatch; a special rating converted to a label and back so the export and the chip
   disagree; an edit form that ignores the F2F deadline when deciding whether anything changed.

None of these are fixed by the port unless listed as a deviation. Deviations will be recorded here as
each slice lands.
