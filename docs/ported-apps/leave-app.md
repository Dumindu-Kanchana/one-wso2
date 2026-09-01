# Leave — functional specification

**Status:** written *after* the port rather than ahead of it, from three full audits of the source
against the shipped screens. The Leave port had no specification, so nothing recorded what was
deliberately left out — and the commit that claimed to close its parity gaps (`f48da88`, *"Close
remaining leave-app parity gaps"*) has an empty body naming neither the gaps nor which it closed.
This document is that record, and the reference for the Sabbatical port that follows.

**Source of truth for behaviour:** `people-ops-suite/apps/leave-app/webapp/src`. That app is in
production; what it does is observed. Its Ballerina backend was read only to understand wire shapes —
anything inferred from it and never seen in the running app is marked as such in §9 and is a question,
not a claim.

**In One WSO2:** two entries under Me → Leave, one per kind of leave, each opening on tabs for
everything you can do with that kind. `/me/leave/general` → `apply`, `history`, `reports`;
`/me/leave/sabbatical` → `apply`, `history`, `approve`, `approval-history`, `report`. Backend is the
leave service configured as `ONE_WSO2_LEAVE_BACKEND_URL`.

---

## 1. Purpose and users

Employees request leave and track their own; leads report on their reports' leave; People Ops report
across the org. Sabbatical is a separate flow with its own eligibility rules and the only approval
step in the product — general leave has no approval anywhere in the source.

Four roles, from the **leave backend's own** `/user-info` privileges — not people-app's:

| Role | Number | Gets |
|---|---|---|
| `EMPLOYEE` | 987 | Apply, My History |
| `INTERN` | 678 | denied Sabbatical apply and Sabbatical history |
| `LEAD` | 879 | + Reports, + Sabbatical approve |
| `PEOPLE_OPS_TEAM` | 789 | + Reports, org-wide scope. **Not** approve |

The backend grants `LEAD` on having subordinates, so anyone leading a team holds the number.
`useLeaveGate` is the single answer to who gets in; the rail and each page read it.

---

## 2. Screens

### 2.1 Apply — `/me/leave/general/apply`

Dates, leave type, day portion, people to notify, an optional comment. A live validation call
(`isValidationOnlyMode=true`, debounced 400 ms) returns the working-day count for the range.

**Leave types are location-specific.** The same type is named differently per location, and only some
are offered:

| Location | Offered | Named |
|---|---|---|
| Sri Lanka | casual | "Casual/Annual" |
| India | annual, casual, sick | "Annual / Earned", "Casual" *(Maharashtra only)*, "Sick Leave" *(Karnataka only)* |
| France | conges_payes, rtt, sick | "Congés Payés", "RTT", "Sick Leave" |
| Spain | annual, casual, sick | "Annual Leave", "Casual Leave", "Sick Leave" |

Maternity, paternity and lieu are offered everywhere. An unknown location falls back to Sri Lanka.

**Half-days** apply to a single calendar day only; choosing a multi-day range resets the portion to
full. A half-day counts 0.5 in "Days selected".

**Notify** is pre-seeded with `optionalMails` — whoever was copied on the user's last request — and
the mandatory recipients (lead, People Ops) render as fixed chips that cannot be removed. Departed
employees are not offerable.

**Submitting** asks for confirmation first, naming the type, working days, range and portion.

### 2.2 My History — `/me/leave/general/history`

Cards for one year at a time, newest first, statuses `[APPROVED, PENDING]`. Cancel is offered until
the leave started more than 30 days ago. The year list runs from the employment year to now.

### 2.3 Reports — `/me/leave/general/reports`

A DataGrid: six columns, sortable, paged at ten, with the filter panel, column visibility, density
and CSV/print export the component provides. Filters are drafted and applied on **Fetch report**.
The day total is shown only when the result covers one employee.

### 2.4 Sabbatical — `/me/leave/sabbatical`

Its own rail entry, holding everything to do with sabbaticals. A sabbatical is a once-in-years
thing, so it stays out of the everyday path rather than appearing as a tab in every group.

| Route | Who | Source |
|---|---|---|
| `/me/leave/sabbatical/apply` | employee or lead, not intern | `ApplyTab.tsx` |
| `/me/leave/sabbatical/history` | employee or lead, not intern | `SabbaticalLeaveHistory.tsx` |
| `/me/leave/sabbatical/approve` | lead | `ApproveLeaveTab.tsx` + `ApproveLeaveTable.tsx` |
| `/me/leave/sabbatical/approval-history` | lead | `ApproveHistoryTab.tsx` + `ApprovalHistoryTable.tsx` |
| Report | lead or People Ops | `AdminSabbaticalTab.tsx` |

The whole screen is replaced by a notice when `appConfig.isSabbaticalLeaveEnabled` is false. Apply is
replaced by an explanation when the user has no `leadEmail` — there is nobody to route the request
to. Eligibility is measured from the last approved sabbatical, or the employment start date when
there is none, and the warning names which of the two it used. It renders as a warning but blocks
submit.

The date the user gives as their last sabbatical is **appended to the free-text comment**
(`**** Last Sabbatical Leave End Date: … ****`) rather than sent as a field: `types.ts:275-280`
declares `SabbaticalApplicationRequest.lastSabbaticalLeaveEndDate`, but nothing sends it — the submit
is the ordinary `POST /leaves`. Reproduced, not corrected; that is where the approver reads it.

Approving shows what share of the lead's team is already booked away over the same dates. The source
fetches that before opening the dialog; we open immediately and hold the confirm button until it
lands, so the lead still cannot decide without seeing it.

---

## 3. Business rules

1. **Working days** are computed server-side. A half-day request is 0.5 regardless of range.
2. **Overlaps** are rejected server-side. There is no client-side overlap gate — the app posts and
   surfaces what the server says.
3. **Entitlement** is a warning, never a block, and only where quota tracking exists.
4. **Cancellation** is offered for 30 days after the leave started.
5. **Blocking validation** on Apply, in order: dates required → working days ≥ 1 → portion required →
   type required. The last two cannot occur in this port, where the state cannot hold null.

---

## 4. Role matrix

| | Employee | Intern | Lead | People Ops |
|---|---|---|---|---|
| Apply (general) | ✓ | ✓ | ✓ | ✓ |
| Apply (sabbatical) | ✓ | ✗ | ✓ | ✗ * |
| My History (general) | ✓ | ✓ | ✓ | ✗ * |
| My History (sabbatical) | ✓ | ✗ | ✓ | ✗ * |
| Reports (general) | ✗ | ✗ | ✓ | ✓ |
| Approve sabbatical | ✗ | ✗ | ✓ | ✗ |
| Approval history | ✗ | ✗ | ✓ | ✗ |
| Sabbatical report | ✗ | ✗ | ✓ | ✓ |

\* A People-Ops-**only** user holds no EMPLOYEE privilege and so has no personal screens. In practice
the backend grants EMPLOYEE to anyone in the employee groups, so most hold both.

---

## 5. API contract

| Call | Notes |
|---|---|
| `GET /user-info` | privileges, `workEmail`, `leadEmail`, `location`, `employmentStartDate` |
| `GET /app-configs` | mandatory/optional mail lists, sabbatical policy URLs and durations |
| `GET /employees?employeeStatuses=Active&…=Marked leaver&…=Left` | **all three, always** |
| `GET /leaves?…` | `email`, `approverEmail`, dates, `statuses[]`, `leaveCategory[]`, `employeeStatuses[]`, `orderBy`, `limit` |
| `POST /leaves?isValidationOnlyMode=true` | returns the working-day count |
| `POST /leaves?isValidationOnlyMode=false` | creates it |
| `DELETE /leaves/{id}` | cancels |
| `POST /leaves/{id}/{approve\|reject}` | sabbatical only, lead only |

**The report sends no `limit` and no `orderBy`.** Both were port inventions; the cap existed only
because every row was rendered at once, which paging fixed.

**`employeeStatuses` is sent for every lead, not only People Ops.** It is not a display filter — it
changes which rows come back.

---

## 6. Test checklist

- Apply: each location offers its own types under its own names; half-day resets on a multi-day
  range and counts 0.5; the confirmation names type, days, range and portion; nothing posts until it
  is answered; both blocking messages appear rather than a dead button.
- Notify: seeded from `optionalMails`; the lead appears once and cannot be removed; leavers absent.
- History: 30-day cancel boundary — the day before, the day of, the day after.
- Reports: `employeeStatuses` on the wire for a plain lead; no `limit`, no `orderBy`; paged at ten;
  sortable; the total only for one employee; the toolbar's four controls present.
- Gate: employee, intern, lead, People Ops, and none — `isLead` alone and `subordinateCount > 0`
  alone must **not** grant Reports.
- Rail entries (`useLeaveGate.test.tsx`): an entry appears when any tab in it does — Sabbatical is
  offered to People Ops for its Report, withheld entirely from an intern, and General is offered to
  everyone because applying is open to all.
- Tab routing (`LeaveTabRouting.test.tsx`): the group URL redirects to the first *permitted* tab;
  the bar offers only permitted tabs and says so when there are none; the tab named by the URL is
  the one marked selected; clicking a tab changes the URL; a refused tab's URL redirects to one the
  visitor may see, or explains when there is none; and nothing is decided while the gate is still
  resolving — a deep-linked lead stays on the URL they asked for.

---

## 7. Deviations from the source, and why

**Kept — the port is right and the source is wrong.** The source parses `new Date("2026-08-15")` as
UTC midnight, so dates render a day early west of UTC; it renders "1 days"; it renders
"Conges_payes Leave"; and its `SingleLeaveHistory` omits `status`, which the backend returns and the
port's DTO carries.

**Structural.** The source's route table (`route.ts:47-150`) nests action-first — Apply →
General|Sabbatical, Approve → Sabbatical|Approval History, My History → General|Sabbatical, Reports →
General|Sabbatical — and draws the second level as a sidebar. One WSO2 transposes it: two entries by
**kind**, each holding the actions for that kind. The screens, their rules and their order within a
group are unchanged; what differs is which level is the rail and which the tabs.

The reason is frequency. General leave is an everyday errand and sabbaticals are taken once in
several years, so threading Sabbatical through Apply, My History and Reports would put a rare thing
in front of everyone, every time. Kept apart, the common path is one entry with three tabs.

Each tab is a real route, so a tab can be linked, survives a refresh, and is reachable with the back
button. It is also *gated* at the route: `useLeaveGate.canSee` decides the rail entry, the tab in the
bar, and whether the tab's route will render, from one mapping — so a hidden tab cannot be reached by
typing its URL. The tab bar is filtered by the same call, so the bar can never offer something the
route would refuse.

Two consequences worth stating. The group URL (`/me/leave/apply`) redirects to the first tab the
visitor is *allowed*, not a hardcoded one — a People-Ops-only account cannot apply for a sabbatical,
so a fixed redirect would land them on a refusal. And nothing below the group page renders until
`/user-info` resolves, because deciding on an unresolved gate would redirect a lead away from a
deep link before their privileges arrived, and a redirect is not undone when the answer comes.

**General has no Approve tab.** That is the source's own asymmetry (`route.ts:80-103`): its Approve
route has only sabbatical children, because general leave is approved elsewhere. So Approve and
Approval history appear under Sabbatical and nowhere else.

**A rail entry appears when any tab inside it does** — not when the person may take that kind of
leave. People Ops cannot hold a sabbatical but the sabbatical Report is theirs (`route.ts:143-148`),
so the entry is offered to them and opens on Report. Gating it on the sabbatical permission alone
hid a screen they are entitled to and left it reachable only by typing the URL, which is what the
previous single-entry arrangement did.

**Cosmetic.** The source's tables are MUI DataGrids; the sabbatical approve, approval-history and
report tables here are plain tables, so they have no column picker or CSV export. The general report
does use the DataGrid, lazily, and that is the only screen that pays for it.

---

## 8. Sabbatical — the arithmetic

Two `appConfig` values drive every rule, both in **days**, while every message speaks in years and
weeks. `util/sabbatical.ts` holds the conversions so no screen does the arithmetic inline.

| Rule | Config | Default | Shown as |
|---|---|---|---|
| Eligibility gap | `sabbaticalLeaveEligibilityDuration` | 1095 days | "at least 3 years" |
| Maximum length | `sabbaticalLeaveMaxApplicationDuration` | 42 days | "6 weeks" |

`eligibilityGapDays` subtracts one from the plain day difference (`ApplyTab.tsx:168`), which makes
the check a day stricter than it reads. Reproduced deliberately — §9 records it as a question for a
live tenant, not something corrected here. With the defaults, an anchor of 2024-01-01 first becomes
eligible on 2027-01-01.

Length is inclusive of both ends and strictly greater than the limit is too long, so 42 days is
accepted and 43 is not.

`LeaveApprovePage.tsx` — the unrouted first draft of the approve screen, shipped in `8a7f924` and
unwired in `a944919` — has been **deleted**. It widened the lead check to `isLead ||
LEAD privilege || subordinateCount > 0`, which granted the approve queue to people the running app
does not, and it had none of the source's dialog copy or the team-share query.

---

## 9. Source behaviour to reproduce, and claims still unverified

**Reproduce — observed in the running app.** The last-sabbatical date the user types is appended to
the free-text comment rather than sent as a field; `pageSize: 10` with `pageSizeOptions={[5]}`;
`textTransform: "capitalize"` leaves `APPROVED` in caps; double-spaced titles ("Sabbatical  Leave
Approval"); "1 days"; no double-submit guard on approve/reject; date-range separators that vary
between "to", an en dash and a hyphen.

**Unverified — read from the backend, never observed.** Each is a question to confirm against a live
tenant, not a defect to design around:

- that cancelling a PENDING sabbatical returns HTTP 500
- that a plain lead's sabbatical report cannot show PENDING rows
- that the frontend's eligibility check is a day stricter than the backend's
- that `isValidationOnlyMode` is ignored on the sabbatical path

---

## 10. Known dead code in the source

`view/LeadReport/Report.tsx` imports `./panel/AdminReportTab`, which does not exist, and nothing
imports `Report` — it would not compile. `POST /leaves/report` and its Redux slice are registered and
never dispatched. `layout/BreadCrumbs/` and `component/common/SessionWarningDialog.tsx` are imported
nowhere. None of it is a gap in the port.
