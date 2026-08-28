# My Team — functional specification

**Status:** written ahead of the port, from the source implementation rather than from any prior
document. This is the reference for verifying the port and for writing test cases against it.

**Source of truth for behaviour:** `people-ops-suite/apps/people-app` — `webapp/src/view/employees/myTeam/`
for the UI rules, and `backend/service.bal` + `backend/modules/database/{db_queries,types}.bal` for
the server rules. Where the two disagreed, the server is authoritative and the difference is
recorded in §7.

**In One WSO2:** `/me/my-team` under the Me perspective, lead-only. A detail screen at
`/me/my-team/:employeeId`. Backend is the people-app service already configured as
`ONE_WSO2_PEOPLE_BACKEND_URL`.

---

## 1. Purpose and users

The screen a lead uses to see the people who report to them: who they are, what they do, when they
joined, and whether they are still employed. Read-only — nothing here changes any record.

**Who can open it:** anyone the people-app backend considers a lead. That is not a role someone is
granted; it is computed. The backend runs `isLead(email)` — "does at least one employee name you as
their manager, or as an additional manager?" — and if so it adds privilege **993** to the profile it
returns. One WSO2 turns that into the `lead` capability, which gates the rail item and the screen.

So a lead is simply someone with reports. Lose your last report and you lose the screen.

**What "my team" means:** by default the **whole reporting chain** — direct reports, their reports,
and so on, following both the manager field and additional-manager links. A toggle narrows it to
direct reports only. The lead themself is never in the list.

The client never says who it is. It sends `leadOnly: true` and the server resolves the caller from
the token, so the scope cannot be widened by tampering with the request.

---

## 2. Screens and features

### 2.1 The table

Eight columns, in this order:

| Column | Contents | Sortable |
|---|---|---|
| Employee ID | The employee number | yes |
| Employee | 32px photo (initial as fallback) and full name | yes, on full name |
| Email | Work email | yes |
| Designation | Job title. `N/A` when absent | yes |
| External Designation | Outward-facing title. `N/A` when absent | **no** — see §7 |
| Employment Type | Permanent, contract, intern, and so on. `N/A` when absent | yes |
| Start Date | `7 Mar 2021`. `-` when absent | yes |
| Status | A chip: Active (green), Marked leaver (amber), Left (red) | yes |

Default order is Employee ID ascending, and that header shows as the active sort on first paint.
Clicking a sortable header sorts ascending; clicking it again reverses. Clicking a different column
starts ascending again. Sorting always returns to page 1.

Clicking anywhere in a row opens that employee's detail screen. The name within the row is a real
button, which is what keeps the row reachable by keyboard — focusing it and pressing Enter follows
the same single path as a mouse click.

25 rows per page, with a footer reading `Showing 1–25 of 47`.

### 2.2 Finding people

- **Search** — one field, matching across name, employee id, emails, phone numbers, NIC/passport,
  city, country, EPF and job title. It is a single substring match, so `jane perera` finds
  "Jane Perera" but `perera jane` finds nothing. Maximum 100 characters; letters, numbers, spaces
  and `@ . _ - ' +` only. Applied 300ms after typing stops.
- **Direct Reports Only** — a toggle in the toolbar. Off (the default) shows the whole chain.
- **Filters** — a dialog holding eleven organisational filters (Business Unit, Team, Sub Team, Unit,
  Career Function, Designation, Company, Office, Employment Type, Manager, Gender), the employee
  status selection, and two switches: Direct Reports Only and Exclude Future Joiners.
  - Choosing a Business Unit narrows the Team list; a Team narrows Sub Team; a Sub Team narrows
    Unit; a Career Function narrows Designation; a Company narrows Office. Choosing a parent clears
    any child selection that no longer applies.
  - Nothing takes effect until **Apply**. **Cancel** discards the edits.
  - **Clear all** returns every filter to its default. It keeps the search text.
- **The applied filters appear as chips** beneath the toolbar, each removable, with a Clear filters
  button. The chips reflect what is actually applied, from the first paint.
- **Counts** — `Total` is the size of the team with no filters; `Filtered` is the size of the
  current result. `Filtered` shows only when something is filtering.

Default filter state: statuses **Active** and **Marked leaver** (so people who have left are hidden),
whole chain, future joiners excluded.

### 2.3 The detail screen

Reached by clicking a name; `← My Team` returns.

- A header: photo, full name, designation, work email, and the same status chip as the table.
- **Job information** — employee id, work email, designation, external designation, employment type,
  job band, company, office, business unit, team, sub team, unit, start date, length of service,
  probation end, agreement end, reports to, additional leads, number of subordinates, and — where
  the person is leaving — resignation date, final day in office, final day of employment.
- **Personal details** — hidden behind a **Show personal details** control. Only when expanded does
  the screen request NIC/passport, date of birth, personal email, personal phone, home address and
  emergency contacts. Seeing them is a deliberate act, not a side effect of opening the page.

### 2.4 Page states

| Condition | What the user sees |
|---|---|
| `ONE_WSO2_PEOPLE_BACKEND_URL` not set | A notice naming the missing key. No requests. |
| Profile still loading | A skeleton block. |
| Profile request failed | An error with a **Retry** button — never "you are not a lead", which would present a temporary failure as a permanent state. |
| Not a lead | An informational notice that My Team is for leads. Not an error. |
| No reports match | `No one matches these filters` with a Clear filters button, or `No reports found` when nothing is filtering. |
| The page went past the end | `This page is empty — the list changed while you were on it`, with a button to the last page. |
| Detail: not your report | `You don't have access to this employee's record.` |
| Detail: no such employee | `That employee doesn't exist.` |

---

## 3. Business rules

1. **Scope is server-side and cannot be widened.** `leadOnly: true` makes the server resolve the
   caller from the token and restrict to their subtree. An admin who sends this payload still sees
   only their own reports.
2. **Default is the whole chain, including additional managers.** The recursive walk follows both
   the manager field and the additional-manager table, with a cycle guard. `Direct Reports Only`
   narrows to one hop — still including additional-manager links.
3. **People who have left are hidden by default.** Status defaults to Active + Marked leaver.
   Clearing the status selection entirely removes the filter and includes Left.
4. **Future joiners are hidden by default** — anyone whose start date is after today. This is
   time-dependent and flips at the database server's midnight.
5. **Lead status ignores employment status.** Someone whose only reports have all left is still a
   lead: they keep the rail item and see an empty table. A revoked additional-manager link also
   still counts — see §8.
6. **Sorting is server-side** and restricted to a fixed set of fields. Anything outside it is
   rejected, so the UI only offers what the server accepts.
7. **Any change to filters, search, or sort returns to page 1.** Only paging itself preserves the
   page.
8. **The detail screen's access is decided by the server**, not by the lead capability: admin, or
   yourself, or someone in your subtree.

---

## 4. Role matrix

| Who | What they see |
|---|---|
| Lead (privilege 993 — has at least one report) | The full screen. All filters, all columns, the detail screen for anyone in their chain. |
| Admin who is also a lead | Exactly the same. `leadOnly: true` is always sent, so admin does not widen this screen. |
| Admin who leads nobody | The "available to leads" notice. The backend would refuse the request anyway. |
| Employee with no reports | The "available to leads" notice. |
| Profile request failed | An error with Retry — deliberately distinguished from "not a lead". |

There is no admin mode, no editing, and no export.

---

## 5. API contract

All requests carry the signed-in user's bearer token; the gateway rewrites it to the header the
service reads. Base URL: `ONE_WSO2_PEOPLE_BACKEND_URL`.

| Endpoint | Purpose | Notes for testing |
|---|---|---|
| `GET /user-info` | Profile and privileges | Already used app-wide. Privilege 993 means lead. |
| `POST /employees/search` | The team list | Body carries filters, pagination, sort and `leadOnly: true`. Limit 1–100. Search max 100 chars. An unaccepted sort field is a 400. |
| `GET /employees/{id}` | One employee's job record | Permitted for admin, self, or a lead of that employee. |
| `GET /employees/{id}/personal-info` | Personal details | Same permission rule. Requested **only** when the disclosure is expanded. |
| `GET /business-units`, `/teams`, `/sub-teams`, `/units`, `/career-functions`, `/designations`, `/companies`, `/offices`, `/employment-types` | Filter option lists | Five accept a parent id to narrow. Requested only once the filter dialog has been opened. |
| `GET /employees/managers` | Manager filter options | **Org-wide, not scoped to your chain** — see §8. |

Server messages are shown as-is where they exist; raw response bodies are never surfaced.

---

## 6. Test checklist

Executable by hand. You need an account that leads at least two people, ideally with an indirect
report and someone who has left.

### Access

- [ ] As a lead, My Team appears in the rail under Me and opens.
- [ ] As someone with no reports, the rail item is absent and the notice says it is for leads.
- [ ] Block the profile request: an error with a working **Retry** appears — *not* "available to
      leads". This distinction is the point.
- [ ] With the backend URL unset, the not-connected notice appears and no requests are made.

### The table

- [ ] Indirect reports appear by default, not only direct ones.
- [ ] Someone who lists you as an *additional* manager appears.
- [ ] You do not appear in your own team.
- [ ] Someone who has left is absent by default; clearing the status filter reveals them.
- [ ] Someone joining next month is absent; turning off Exclude Future Joiners reveals them.
- [ ] Missing designation, external designation and employment type each read `N/A`; a missing start
      date reads `-`. These differ deliberately.
- [ ] Status chips: Active green, Marked leaver amber, Left red.
- [ ] Photos load; someone without one shows their first initial.

### Sorting

- [ ] Employee ID shows as the active sort on first load.
- [ ] Clicking Designation sorts ascending; clicking again reverses.
- [ ] Clicking Email after that starts ascending again, not descending.
- [ ] **External Designation is not clickable** and announces no sort state. It must never produce
      an error — in the source app clicking it fails with a 400.
- [ ] Sorting while on page 3 returns you to page 1.

### Search and filters

- [ ] Typing filters after a brief pause, not on every keystroke.
- [ ] A full name matches; the same words reversed does not (a known limitation).
- [ ] Over 100 characters, or a character like `<`, is refused with an explanation.
- [ ] Clearing the search restores the full list.
- [ ] Choosing a Business Unit narrows the Team list; choosing a Team then a different Business Unit
      clears the stale Team.
- [ ] Editing filters then pressing **Cancel** changes nothing — no request, no chip change.
- [ ] **Apply** applies exactly what was drafted, and returns to page 1.
- [ ] The filter chips are correct immediately, without needing to open the dialog first.
- [ ] Removing a chip re-runs the search.
- [ ] **Clear all** resets the filters but keeps the search text.
- [ ] Turning off Exclude Future Joiners is visible: the chip row and the filter count reflect it.
      (In the source app this filter changed results while appearing inactive.)
- [ ] `Total` stays constant as you filter; `Filtered` tracks the result.
- [ ] Toggling Direct Reports Only does not change `Total`.
- [ ] Picking a Manager outside your chain gives the "no one matches" state, not an error.

### Paging

- [ ] The footer range matches the rows shown.
- [ ] Paging keeps your filters and sort.
- [ ] On the last page, going forward is not possible.

### The detail screen

- [ ] Clicking anywhere in a row — including an empty part of a cell — opens that record;
      `← My Team` returns.
- [ ] Tabbing to the employee's name and pressing Enter opens the same record.
- [ ] Clicking directly on the name navigates once, not twice.
- [ ] The rail keeps My Team highlighted while on the detail screen.
- [ ] Job information renders; personal details are **not** requested until expanded — verify in the
      network tab.
- [ ] Expanding shows personal details. If refused, only that section shows a notice; the job record
      stays.
- [ ] Editing an employee id in the URL to someone outside your chain gives the access notice.
- [ ] A nonexistent id gives the not-found notice.

---

## 7. Deviations from the source app

| # | Change | Why |
|---|---|---|
| 1 | External Designation is not sortable. | The server rejects that field. The source leaves the header clickable, so clicking it fails with a 400 and an error toast. |
| 2 | Exclude Future Joiners is always a real true/false. | The source stored "off" as absent, so it was invisible to the filter count and the chip row while still changing results. |
| 3 | The filter chip row shows from the first paint. | The source hid the entire row until the user had opened the dialog and pressed Apply at least once. |
| 4 | `Total` is a separate unfiltered count. | The source captured it and then froze it once any filter was applied, and toggling Direct Reports Only rewrote it. |
| 5 | Changing the page size cannot strand you past the end. | The source reset the page for filters but not for page size, so a high page plus a larger size requested rows beyond the total. |
| 6 | Rows keep showing while the next page loads. | The source cancelled in-flight requests per URL, which made the skeleton flash and briefly showed stale rows as though fresh. |
| 7 | The filter dialog cannot lose your edits. | The source re-seeded its draft whenever the applied filters changed identity, discarding work in progress. |
| 8 | Option lists load when the dialog is first opened. | The source fetched all ten on page load, always, even for someone who never filters. |
| 9 | The organisation filters genuinely narrow each other. | The source's hierarchy was decorative — every list was the full set, so you could combine a Team with an unrelated Business Unit and get nothing. |
| 10 | The whole row is clickable, and the name inside it is a focusable button. | The source's row click was unreachable by keyboard and invisible to a screen reader; a name-only target was too small. This gives a full-width target that is still keyboard-reachable, via one navigation path rather than two. |
| 11 | Personal details are behind an explicit disclosure. | The source's detail page showed them by default. They are permitted for a lead, but they should be asked for. |
| 12 | Fixed 25 per page. | The source's page-size selector is what produced deviation 5. |
| 13 | No per-cell tooltips. | The source put one on all eight cells of every row. The two that truncate carry a plain title instead. |
| 14 | Search rejects invalid input with an explanation. | The source silently refused the keystroke with no feedback. |

---

## 8. Known defects left in the backend

Out of scope — the service is reused unchanged. Recorded so they are tracked rather than
rediscovered.

1. **`/employees/managers` is org-wide.** It lists every manager in the company, not those in your
   chain, so most selections combine with the lead scoping to produce nothing. Wants a scoped
   variant.
2. **Lead status and the subtree walk ignore whether a management link is active.** A revoked
   additional-manager row still makes someone a lead and still pulls that person — and everyone
   under them — into the team.
3. **The organisation records carry no parent id**, so narrowing has to be a round trip to the
   server; it cannot be derived from lists already held.
4. **`externalDesignation` is displayed but not sortable** — the field is missing from the server's
   sort allow-list.
5. **The current-team query has no upper bound on start date** beyond the optional future-joiner
   filter, so its interpretation of "today" is the database server's, not the caller's.
6. **Search is a single substring match** across sixteen columns, so multi-word queries only match
   in the stored order.
