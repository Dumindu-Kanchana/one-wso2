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

**Only `TEAM_LEAD` opens the Lead Portal.** `LEAD` is read in exactly one place in the source and
gates nothing meaningful — treat the two as distinct and do not conflate them. The source carries a
standing note about moving both to Asgardeo groups eventually.

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

Includes the **chain view**, showing the appraisal up the reporting line.

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

## 9. Defects and questions in the source

Carried forward deliberately, so they are tracked rather than rediscovered. Items 1 and 2 want a
decision before the relevant slice.

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
