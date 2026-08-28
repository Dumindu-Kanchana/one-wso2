# Menu (cafeteria) — functional specification

**Status:** written ahead of the port, from the source implementation rather than from any prior
document. This is the reference for verifying the port and for writing test cases against it.

**Source of truth for behaviour:** `people-ops-suite/apps/menu-app` — `webapp/` for the UI rules and
`backend/` (Ballerina, `service.bal` / `utils.bal` / `modules/database/db_queries.bal`) for the
server rules. Where the two disagreed, the server is authoritative and the divergence is recorded in
§7.

**In One WSO2:** one route, `/workspace/menu`, under the Workspace perspective. Backend reached via
`ONE_WSO2_MENU_BACKEND_URL`; the existing service is reused unchanged.

---

## 1. Purpose and users

A cafeteria tool for WSO2 employees. Three things, on one screen:

1. See what the kitchen is serving today.
2. Leave feedback on lunch.
3. Order, change, or cancel a "Dinner on Demand" meal.

**Every signed-in employee sees the same screen.** The backend issues two privileges — `ADMIN` (789)
and `EMPLOYEE` (987) — but the source app renders **identical UI for both**: there is no admin
screen, no admin-only button, and no role conditional anywhere in its `src`. Menu content is
maintained in a Google Sheet, not in the app, so there is nothing for an administrator to do here.

That is why the port has **no capability gate** and no `useMenuGate`. The absence is deliberate;
it is not an unfinished piece of work.

---

## 2. Screens and features

One screen, three stacked areas. Section headings below match the visible structure.

### 2.1 Today's menu

- A date line, from the menu response's own `date` field, formatted long: `Monday, August 24, 2026`.
- Up to five meal cards, always in this order:

  | Slot | Serving time shown | Feedback? |
  |---|---|---|
  | Breakfast | 07:30 – 09:30 | no |
  | Juice | 10:30 – 11:00 | no |
  | Lunch | 12:00 – 14:00 | **yes** |
  | Dessert | 12:00 – 14:00 | no |
  | Snack | 15:30 – 16:30 | no |

  The serving times are display-only labels. They gate nothing.

- Each card shows an icon, the slot name, the serving time, the item description, and
  `Supplier: <title>`.
- **A slot with a blank title is not rendered.** The server returns `""` for an unlisted meal; empty
  and whitespace-only titles both count as absent.
- **Empty state:** when *neither* breakfast nor lunch has a title, the whole menu area is replaced by
  a single sentence naming the date. Juice, dessert, or snack alone do **not** prevent the empty
  state — see §7 for why that rule is kept as-is.
- **Load failure:** an error alert. No retry button; the query retries on its own for 5xx only.

### 2.2 Lunch feedback

- Reached from a **Feedback** button on the lunch card only. Other cards have no such button.
- Opens a dialog titled `Lunch Feedback`.
- **Inside the feedback window:** a notice that the submitter's email is recorded alongside the
  feedback, a multi-line text field, and Cancel / Submit.
- **Outside the window:** the dialog opens but shows prose only — no field, no submit — naming the
  date and the window. The button stays enabled so the user can find out *why* it is unavailable
  rather than facing a dead control.
- **Validation:** feedback is required, minimum 10 characters. The message is checked when the user
  tries to submit.
- **On success:** the dialog closes and a success notification appears.
- **On failure:** the server's own message is shown, inline in the dialog and as a notification.
- There is **no limit** on how many times one person may submit feedback in a day. Each submission is
  appended as a new row.

### 2.3 Dinner on Demand

- Three meal options: **Chicken**, **Fish**, **Vegetarian**. Exactly one may be selected.
- A notice states the ordering window.
- **With no existing order:** pick an option, then **Order dinner**.
- **With an existing order:** a summary line names the ordered meal and the date it is for, plus a
  **Cancel order** button. Choosing a different option enables **Update dinner**.
- **Selection rules:**
  - Clicking an unselected option selects it.
  - Clicking the selected option deselects it — *unless* it is the option currently on order, in
    which case nothing happens. Once an order exists you can never arrive at "nothing selected".
  - Submit is disabled while a request is in flight, when nothing is selected, and when the selection
    equals what is already ordered (there would be nothing to change).
- **Cancelling** opens a confirmation dialog. Confirming cancels the order; the summary disappears
  immediately. Both dialog buttons are disabled while the request is in flight.
- **Outside the ordering window:** the options are non-interactive and Order/Update/Cancel are
  disabled, with the notice explaining when it reopens. **An existing order remains visible.**
- **One order per person per day.** Ordering again the same day replaces the meal choice rather than
  creating a second order. Cancelling and re-ordering the same day reuses the same order.

### 2.4 Page-level states

| Condition | What the user sees |
|---|---|
| `ONE_WSO2_MENU_BACKEND_URL` not set | An info alert naming the missing key. No requests are made. |
| Signed in, but in no authorised group | One warning alert for the page. The backend answers 403 on every endpoint, so per-section errors would be four copies of the same fact. |
| Menu request fails | An error alert in the menu area. Dinner still renders. |
| Dinner request fails | An error alert in the dinner area. The menu still renders. |

---

## 3. Business rules

### 3.1 Lunch feedback window — 12:00 to 16:15

- Both ends **inclusive**.
- Anchored to **the menu's date, in IST** (UTC+05:30). Feedback is open only when the current IST
  date equals the date on the menu *and* the IST time of day is within the window. A menu that is
  stale — the sheet still showing yesterday — therefore accepts no feedback.
- The window's start and end are **deployment configuration** on the server, exposed by
  `GET /meta-info`. The port reads them from there and falls back to 12:00–16:15 if unavailable.
- The server enforces this window and rejects a late submission with a message naming the date and
  the window.

### 3.2 Dinner ordering window — 16:00 to 19:00

- Both ends **inclusive**; 19:00:00 exactly is still open.
- Evaluated in **IST**, the same as feedback.
- **Enforced by the client only.** The server applies no time check to ordering or cancelling. The
  window is a kitchen convention that the UI upholds; it is not a security boundary.

### 3.3 One order per person per day

- Keyed on (person, date). Re-ordering updates the existing order in place.
- Cancelling is a soft delete on the server: the record is retained and marked inactive, and a
  later order the same day revives it.
- The date is supplied by the client, taken from the current IST date.

### 3.4 What an order carries

The meal choice, the date, and — copied from the employee's profile at order time — their department,
team, and manager's email. The kitchen uses these for distribution. Team may legitimately be absent.

---

## 4. Role matrix

| Who | What they can do |
|---|---|
| `EMPLOYEE` (privilege 987) | Everything in §2: view the menu, submit lunch feedback, order / update / cancel dinner. |
| `ADMIN` (privilege 789) | **Exactly the same.** No additional screen, control, or data. |
| Both privileges | Same again; they are not additive. |
| Signed in, no authorised group | Nothing. The backend answers **403** on every endpoint, including the profile lookup. The page shows one warning alert. |

The privilege numbers are fetched as part of the profile because the profile is needed anyway
(department, team, manager). **Nothing in the UI branches on them.**

---

## 5. API contract

All requests carry the signed-in user's bearer token; the gateway rewrites it to the header the
service reads. Every endpoint requires membership in an authorised group and answers **403**
otherwise.

| Endpoint | Purpose | Notes for testing |
|---|---|---|
| `GET /user-info` | The employee profile plus privileges. | Supplies department, team, and manager email for an order. |
| `GET /meta-info` | The configured feedback window. | Present in the service but **never called by the source app**. If the gateway does not publish it, the port falls back to the hard-coded window and nothing else changes. |
| `GET /menu` | Today's menu: a date and five meal slots, each a title and description. | Unlisted meals come back as empty strings, not as missing keys. |
| `POST /feedback` | Submit lunch feedback. Body: the message. | Rejected outside the window with a message naming the date and window. |
| `GET /dinner` | The current order. | **Returns 200 with an explanatory message when there is no order — not 404.** The port detects "no order" by the shape of the response, never by matching the message text. |
| `POST /dinner` | Place or change an order. | Includes the existing order's id when changing one. Changing someone else's order is refused. |
| `DELETE /dinner` | Cancel the order. | Refused with a message when there is nothing to cancel. No time check. |

Server messages are shown to the user verbatim where they exist; raw response bodies are never
surfaced.

---

## 6. Test checklist

Executable by hand against a deployed backend. IST is UTC+05:30 — for windows, use the cafeteria's
clock, not the tester's.

### Menu

- [ ] The date line matches the menu's own date, not the tester's local date.
- [ ] Only slots with a title appear; a slot the kitchen left blank is absent, not an empty card.
- [ ] Slots always appear in the order breakfast → juice → lunch → dessert → snack.
- [ ] Each card shows the serving time and `Supplier: …`.
- [ ] With neither breakfast nor lunch listed, the empty-state sentence appears and names the date.
- [ ] With the backend URL unset, the info alert appears and the network tab shows no requests.
- [ ] A user in no authorised group sees exactly one warning alert, not four errors.

### Lunch feedback

- [ ] Only the lunch card offers Feedback.
- [ ] Inside the window: the field appears, along with the notice about the email being recorded.
- [ ] Fewer than 10 characters is refused with a message; 10 or more submits.
- [ ] A successful submit closes the dialog and shows a success notification.
- [ ] Submitting twice in a day is allowed.
- [ ] Outside the window: the dialog opens, shows prose naming the date and window, and offers no
      field or submit button.
- [ ] **Timezone check:** from a machine set to a timezone several hours behind IST, at a local time
      that is inside 12:00–16:15 locally but outside it in IST, feedback is reported closed. (In the
      source app the form appeared and the submission failed with an error the user never saw.)
- [ ] **Stale-menu check:** when the menu's date is not today in IST, feedback is closed.
- [ ] A server rejection shows the server's own sentence, not a generic "try again".

### Dinner

- [ ] Inside the window with no order: pick an option, order it, and the summary appears naming the
      meal and its date.
- [ ] Submit is disabled with nothing selected.
- [ ] With an order placed, selecting the same option leaves Update disabled; selecting a different
      one enables it.
- [ ] Clicking the on-order option does not deselect it.
- [ ] Updating changes the meal and does not create a second order.
- [ ] Cancelling asks for confirmation; confirming removes the summary immediately.
- [ ] **Double-click the confirm button:** the cancel is requested once, not twice. Both buttons are
      disabled while it is in flight.
- [ ] Cancelling then ordering again the same day works and yields one order.
- [ ] **Outside the window with an existing order:** the summary is still visible; options are
      non-interactive; Order/Update/Cancel are disabled; the notice says when it reopens. (In the
      source app the entire section vanished, hiding the order.)
- [ ] Outside the window with no order: options are visible but non-interactive.
- [ ] At exactly 16:00 and at exactly 19:00 IST, ordering is open.
- [ ] At 15:59 and 19:01 IST, it is closed.
- [ ] Leaving the page open across 16:00 IST: the section becomes interactive **at** the boundary,
      without a reload. (The source app could be up to five minutes late.)
- [ ] Leaving the page open across IST midnight: the menu and any order refresh for the new day.

### Cross-cutting

- [ ] `/workspace` still lists its app cards, and the Menu card navigates to the screen.
- [ ] The rail shows Menu as a single item under Workspace and highlights it on the screen.
- [ ] Pinning the screen produces the label `Menu · Home`, not a guessed one.
- [ ] A failing request is not retried repeatedly before the error appears. (The source app retried
      client errors three times, delaying the message by several seconds.)

---

## 7. Deviations from the source app

Each is deliberate. Everything not listed here is intended to behave identically.

| # | Change | Why |
|---|---|---|
| 1 | An existing dinner order stays **visible** outside the ordering window. | The source hid the whole section, so the order could not even be seen. Read-only information, hiding it helped nobody. |
| 2 | Cancelling remains **blocked** outside the window. | Decided deliberately: the server permits it, but the kitchen's window is the point of the rule and this is a low-stakes app. |
| 3 | The cancel-confirm button is disabled while the request is in flight. | In the source it only changed colour and stayed clickable, so it could fire twice. |
| 4 | The server's own error message is shown. | The source replaced every failure with a generic "try again", hiding the reason a submission was refused. |
| 5 | Client errors are not retried. | The source's retry condition was inverted, so precisely the non-retryable statuses were retried three times with backoff — several seconds before the user saw anything. |
| 6 | The feedback window is read from the server (`GET /meta-info`), with the hard-coded window as fallback. | The source hard-coded it, so a deployment that changed the configuration would disagree with its own UI. |
| 7 | Both windows are evaluated in **IST**, matching the server, instead of the browser's timezone. | The source used browser-local time while the server used IST, so a user outside IST could be shown a form whose submission was then refused. |
| 8 | The window state updates **at** the boundary. | The source polled every five minutes and so could be that far out of date. |
| 9 | A day change while the page is open refreshes the menu and the order. | The source kept showing yesterday indefinitely. |
| 10 | `Supplier:` instead of `Supplier :`. | Typography. |
| 11 | The Feedback button is simply absent on non-lunch cards. | The source rendered it disabled and invisible on all four, which is the same outcome by a longer route. |
| 12 | Icons are the shared icon set; the standalone info-icon asset is dropped. | House convention — no bespoke icon assets, no emoji. |
| 13 | The empty-menu rule is unchanged: blank breakfast **and** lunch means empty, even if another slot is listed. | Faithful to the source. It is arguably wrong, but changing it is a product decision, not a porting one. |

Not ported, because it does nothing: an `/app-config` call that exists on neither side, a
`mealType` field the feedback endpoint ignores, and a maintenance page that cannot be reached.

---

## 8. Known defects left in the backend

Out of scope by decision — the port reuses the service unchanged. Recorded so they are tracked
rather than rediscovered.

1. **The dinner window is not enforced server-side.** Neither ordering nor cancelling checks the
   time, so the window can be bypassed outside the UI. "The window handling was fixed in the port"
   means the client is now consistent and punctual — not that the server enforces anything.
2. **The current-order lookup has no upper date bound.** It returns any active order dated today or
   later, so a future-dated row would be shown as the current one. Mitigated in the UI by always
   labelling the summary with the order's own date and never the word "today".
3. **The spreadsheet cancel matches the wrong column** — it compares the email against the column
   holding the date, so spreadsheet rows are unlikely ever to be removed. The database record is
   cancelled correctly; the sheet keeps a stale row.
4. **One-order-per-day depends on a client-supplied date.** A device with a wrong clock can create a
   second order for a different date.
5. **The dinner endpoints reject valid email addresses.** The address pattern excludes dots and
   digits in the local part, so accounts like `john.doe@wso2.com` cannot order dinner at all.
6. **The feedback window ignores the seconds component** of its configuration.

Items 3 and 5 are user-visible and worth raising with the service owners; 5 in particular blocks a
whole class of account.
