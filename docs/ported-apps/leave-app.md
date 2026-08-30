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

**In One WSO2:** four screens under Me → Leave. `/me/leave/apply`, `/me/leave/history`,
`/me/leave/reports`, `/me/leave/sabbatical`. Backend is the leave service configured as
`ONE_WSO2_LEAVE_BACKEND_URL`.

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

### 2.1 Apply — `/me/leave/apply`

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

### 2.2 My History — `/me/leave/history`

Cards for one year at a time, newest first, statuses `[APPROVED, PENDING]`. Cancel is offered until
the leave started more than 30 days ago. The year list runs from the employment year to now.

### 2.3 Reports — `/me/leave/reports`

A DataGrid: six columns, sortable, paged at ten, with the filter panel, column visibility, density
and CSV/print export the component provides. Filters are drafted and applied on **Fetch report**.
The day total is shown only when the result covers one employee.

### 2.4 Sabbatical — `/me/leave/sabbatical`

Not yet ported. Currently a card linking out to the standalone app. See §8.

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
| My History | ✓ | ✓ | ✓ | ✗ * |
| Reports | ✗ | ✗ | ✓ | ✓ |
| Approve sabbatical | ✗ | ✗ | ✓ | ✗ |

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

---

## 7. Deviations from the source, and why

**Kept — the port is right and the source is wrong.** The source parses `new Date("2026-08-15")` as
UTC midnight, so dates render a day early west of UTC; it renders "1 days"; it renders
"Conges_payes Leave"; and its `SingleLeaveHistory` omits `status`, which the backend returns and the
port's DTO carries.

**Not ported.** The source's Apply/History screens each have a General | Sabbatical tab strip; here
those are separate rail entries. The source's employee pickers show avatars and display names; ours
list addresses.

---

## 8. Sabbatical — not yet ported

Five screens in the source, ~1,300 lines: Apply, Approve, Approve History, My Sabbatical History, and
a Sabbatical Report. `LeaveApprovePage.tsx` in this repo is an unrouted first draft of the approve
screen — shipped in `8a7f924`, unwired in `a944919` in favour of the link-out, never deleted.

The whole Apply screen is gated on `appConfig.isSabbaticalLeaveEnabled`, and hidden entirely when the
user has no `leadEmail`. Eligibility is a warning derived from the last approved sabbatical, or the
employment start date when there is none.

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
