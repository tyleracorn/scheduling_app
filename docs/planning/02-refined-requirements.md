# Cabin Scheduling Application — Refined Requirements

**Version:** 1.0  
**Status:** Planning baseline  
**Product philosophy:** Lightweight coordination and visibility. Negotiations, approvals, messaging, voting, and dispute resolution happen **outside** the application.

---

## 1. Purpose and scope

### 1.1 Purpose

Provide a shared calendar and scheduling workflow for approximately **five households** that jointly use **one recreational cabin**. The application makes **who has which week** easy to see and runs a **fair, ordered draft** for each scheduling period. It does **not** govern on-site behavior, guest policies, or interpersonal agreements.

### 1.2 In scope (initial release family)

- Calendar-first UI: assignments, notes, occupancy indicators, period/draft status
- Scheduling periods with configurable date ranges and opening date/time
- Pre-draft household notes on the calendar
- Round-based sequential draft with timeouts, warnings, auto-skip, and coordinator hold
- Coordinator assignment of remaining weeks and post-publish edits (with audit)
- Daily green/red occupancy indicators (informational)
- User/household management, invite-only email/password auth
- Email and in-app notifications
- Admin-configurable system settings and rolling history retention

### 1.3 Out of scope (non-goals)

Do not build: chat, voting, approval workflows, complex swap workflows, payment/expense tracking, maintenance tracking, reservation request queues, automatic assignment/fairness engines, multi-cabin tenancy (MVP), OAuth (MVP), SMS (MVP).

---

## 2. Users and roles

### 2.1 Primary users

- **Households:** ~5 groups; each may have multiple user accounts; typically one person drives scheduling but **any member** may act on a turn.
- **Coordinators:** 1–3 people who run periods, priority, draft recovery, and remaining-week assignment.
- **Administrators:** Manage households, users, invites, coordinators, and global settings.

### 2.2 Roles (v1)

| Role | Description |
|------|-------------|
| **Household Member** | Belongs to exactly one household. View calendar/history; CRUD household notes and occupancy; pick/skip on household turn. |
| **Coordinator** | All member capabilities plus period/draft/assignment administration within coordinator powers. May belong to a household. |
| **Administrator** | Full system configuration, household/user lifecycle, coordinator roster, retention. Implies coordinator capabilities unless restricted by policy. |

**Deferred:** Separate “Household Representative” role. Accountability uses **audit fields** (`picked_by_user_id`, etc.). Nice-to-Have: rep-only picking.

### 2.3 Deployment model

- **Single cabin** per deployment (no multi-tenant cabin list in MVP).
- **Household roster may change** over time (add, deactivate); historical assignments remain attributed to the household record.

---

## 3. Core concepts

### 3.1 Scheduling period

A bounded interval for which week assignments are planned.

- Defined by **start date**, **end date**, and **opening date/time** (when the period becomes visible for notes and, later, draft).
- **Not** required to align to calendar quarters; admins/coordinators create periods (e.g. quarterly or three custom periods per year).
- **Week list** is **computed** from period dates, cabin timezone, and week-start setting (see §4).

**Period states:**

| State | Meaning |
|-------|---------|
| `scheduled` | Created; before opening datetime |
| `open` | Opening datetime reached; notes allowed; draft not started |
| `draft` | Sequential draft in progress |
| `assignment` | Draft complete; coordinator assigning remaining weeks |
| `published` | All weeks assigned or explicitly left unassigned; calendar authoritative |
| `archived` | Past retention display rules; read-only |

### 3.2 Week

- A **full calendar week** anchored on the configured **week start day** (e.g. Sunday 00:00 through Saturday 23:59:59 in cabin timezone).
- **Exclusive assignment:** at most one household per week.
- **Period boundary rule:** If a period ends mid-week, the **entire week** is included in the period where that week’s **start date** first falls. No splitting weeks across periods.

### 3.3 Assignment

- Links one **week** (within a period) to one **household**.
- Sources: `draft_pick`, `coordinator_manual`, `coordinator_edit`.
- May be changed after publish by coordinator (audit required).

### 3.4 Household note

- **Household-scoped**, not user-attributed in the UI (display household name).
- Any member of that household may create, edit, or delete.
- **Informational only** — does not reserve or block weeks.
- Attached to a **date range** on the calendar (single day allowed).

### 3.5 Occupancy indicator

- Per household, per **date range**, status: **green** (welcome others) or **red** (prefer exclusive use).
- **Informational only** — no permissions, bookings, or workflows.
- Not auto-deleted when assignments change.

### 3.6 Draft

- Round-based sequential selection per [01-pick-model-decision.md](./01-pick-model-decision.md).
- Setting: `week_selections_per_household` (default **1**).

---

## 4. Time, timezone, and calendar

### 4.1 Cabin timezone

- One **cabin timezone** (IANA, e.g. `America/Denver`) stored as system setting.
- All period boundaries, week boundaries, opening datetime, turn deadlines, and calendar rendering use this timezone.

### 4.2 Week start

- Admin-configurable **week start day** (Sunday–Saturday).
- Weeks are seven-day blocks from that anchor.

### 4.3 DST and leap years

- Store instants in UTC; present in cabin timezone.
- Week boundaries computed in local civil dates to avoid off-by-one around DST.

---

## 5. Functional requirements

### 5.1 Calendar (primary screen)

**FR-CAL-01** Month view (MVP minimum) showing weeks in the cabin timezone.  
**FR-CAL-02** Display for each week: assigned household (color/label), unassigned state, period boundary markers.  
**FR-CAL-03** Display household notes overlapping each day/week.  
**FR-CAL-04** Display green/red occupancy for relevant households (legend + filters Nice-to-Have).  
**FR-CAL-05** Display scheduling period status banner: upcoming opening, draft in progress (whose turn), assignment phase, published.  
**FR-CAL-06** Read-only navigation across rolling history window (assignments); notes/occupancy hidden per retention (§8).  
**FR-CAL-07** Selecting a week opens detail: assignment, notes, occupancy, period metadata.

*Classification:* MVP except filtered occupancy views (Nice-to-Have).

### 5.2 Notes

**FR-NOTE-01** Members can add notes for their household on a date range when period is `scheduled`, `open`, or `draft`.  
**FR-NOTE-02** Notes visible to all authenticated users.  
**FR-NOTE-03** Members can edit/delete only their household’s notes.  
**FR-NOTE-04** After period archived beyond retention, notes are hidden (not deleted from DB unless purge policy added later).

*Classification:* MVP.

### 5.3 Occupancy indicators

**FR-OCC-01** Members can set green or red for their household on a date range.  
**FR-OCC-02** Multiple households may overlap on the same day; all display.  
**FR-OCC-03** UI disclaimer: informational only, not enforceable.  
**FR-OCC-04** Members can update or remove their household’s indicators.

*Classification:* MVP; overlap highlight when red on another’s assigned week (Nice-to-Have).

### 5.4 Scheduling period administration

**FR-PER-01** Coordinator can create period: name, start/end dates, opening datetime.  
**FR-PER-02** System computes week list on save; show preview.  
**FR-PER-03** Coordinator can configure **priority order** of active households for that period’s draft.  
**FR-PER-04** Coordinator can edit period before `draft` if no picks exist; warn on date changes that reassign weeks across periods.  
**FR-PER-05** Deleting period with assignments requires coordinator confirmation; prefer soft-delete.  
**FR-PER-06** Coordinator starts draft (`open` → `draft`).

*Classification:* MVP.

### 5.5 Draft and turns

**FR-DRF-01** Draft runs in rounds (1..N per `week_selections_per_household`).  
**FR-DRF-02** Within a round, households act in priority order, one at a time.  
**FR-DRF-03** Active household may **pick** an unassigned week in the period or **skip**.  
**FR-DRF-04** Pick rejected if week already assigned (optimistic UI must reconcile).  
**FR-DRF-05** While turn active, household may change pick or skip choice until advance.  
**FR-DRF-06** Turn advance records `picked_by_user_id`, timestamp, action (`pick`|`skip`|`auto_skip`).  
**FR-DRF-07** Pick window: per-turn deadline = turn start + `pick_window_duration` (setting).  
**FR-DRF-08** Warning notification at `turn_start + pick_window - warning_lead_time`.  
**FR-DRF-09** On timeout: auto-skip, increment consecutive auto-skip counter, notify next actor; if counter ≥ 2, enter **hold** state.  
**FR-DRF-10** Hold: no further turns until coordinator **resumes** (resets or clears counter per policy below).  
**FR-DRF-11** Coordinator may **force-skip**, **assign week** for current household, or **resume** from hold.  
**FR-DRF-12** Inactive households excluded from draft order.  
**FR-DRF-13** When all rounds complete, transition to `assignment` phase.

**Hold resume policy:** On resume, coordinator chooses: reset consecutive auto-skip counter to 0, or continue with counter = 1. Default UI: reset to 0.

*Classification:* MVP; draft pause without hold (Nice-to-Have).

### 5.6 Coordinator assignment and edits

**FR-ASN-01** In `assignment`, show list of unassigned weeks.  
**FR-ASN-02** Coordinator assigns each remaining week to a household or marks week **intentionally unassigned** (rare; requires note).  
**FR-ASN-03** Publish period when coordinator confirms (`assignment` → `published`).  
**FR-ASN-04** After publish, coordinator may change assignment; audit log entry required.  
**FR-ASN-05** If no unassigned weeks after draft, skip assignment phase to publish confirmation.

*Classification:* MVP.

### 5.7 Notifications

**FR-NTF-01** Email + in-app notification center.  
**FR-NTF-02** Events: period opening soon/opened, your turn, turn warning, auto-skip, hold, draft complete, assignment phase, published, assignment changed (affected household).  
**FR-NTF-03** Users can mark in-app notifications read; email always sent for MVP (per-user email opt-out: Nice-to-Have).

*Classification:* MVP.

### 5.8 Users and authentication

**FR-AUTH-01** Invite-only: admin invites email, user sets password via link.  
**FR-AUTH-02** Email + password login; forgot password flow.  
**FR-AUTH-03** User belongs to exactly one household.  
**FR-AUTH-04** Rate limiting on auth endpoints.  
**FR-AUTH-05** Deactivated user cannot log in; household data retained.

*Classification:* MVP.

### 5.9 Administration

**FR-ADM-01** CRUD households (name, display color, active flag).  
**FR-ADM-02** Invite/remove users; assign household.  
**FR-ADM-03** Assign up to 3 coordinators.  
**FR-ADM-04** Configure global settings (§6).  
**FR-ADM-05** Configure `history_retention_years` (default 3).

*Classification:* MVP.

---

## 6. Configurable settings

| Setting | Default | Notes |
|---------|---------|-------|
| `cabin_timezone` | (group decides) | IANA timezone |
| `week_start_day` | Sunday | Drives week computation |
| `week_selections_per_household` | 1 | Draft rounds |
| `pick_window_duration` | 72 hours | Per turn |
| `pick_warning_lead_time` | 12 hours | Before turn deadline |
| `history_retention_years` | 3 | Rolling visibility for notes/occupancy |
| `period_templates` | — | Nice-to-Have: saved duration presets |

**Not configurable in MVP (by design):** negotiation rules, swap rules, payment, auto-assign algorithm, per-household pick window overrides.

---

## 7. Edge case policies

### 7.1 Scheduling period

- Changing dates after notes exist: allowed before draft; recompute weeks; show diff warning.
- Deleting period with data: soft-delete + coordinator confirmation.

### 7.2 Draft

- Concurrent pick attempts: server enforces exclusive week; return 409 with current assignee.
- Timeout during submit: idempotent `POST` with `turn_id` + `client_action_id`.
- All households skip all rounds: coordinator assigns all weeks in assignment phase.
- Household deactivated mid-draft: coordinator removes from remaining turns.

### 7.3 Assignments

- Published edits: coordinator only; show “updated” on calendar for 30 days or until next publish (MVP: badge + audit).

### 7.4 Notes and occupancy

- Overlapping notes: all shown.
- Indicators persist until user deletes.

### 7.5 Retention

- **Assignments:** visible for entire configured retention window (and optionally forever for assignment history — MVP: same window as calendar).
- **Notes and occupancy:** hidden from calendar UI when older than `history_retention_years`; data retained in DB for coordinator export Future.

### 7.6 Security and abuse

- Coordinators who are household members may pick on their turn; system does not block coordinator self-assigning remainder (social norm).

---

## 8. Non-functional requirements

**NFR-01** **Usability:** 90% of routine visits are calendar-only read.  
**NFR-02** **Availability:** Best-effort for small group (single-region deploy acceptable).  
**NFR-03** **Performance:** Calendar month view < 2s on typical mobile network.  
**NFR-04** **Security:** HTTPS, hashed passwords, CSRF protection, role checks on all mutations.  
**NFR-05** **Audit:** Assignment changes and coordinator draft interventions logged.  
**NFR-06** **Accessibility:** WCAG 2.1 AA for primary calendar flows (target; audit in beta).

---

## 9. Feature classification summary

| Area | MVP | Nice-to-Have | Future |
|------|-----|--------------|--------|
| Calendar month + week detail | ✓ | Week strip mobile | |
| Notes | ✓ | | |
| Occupancy | ✓ | Red/green overlap highlight | |
| Round-based draft | ✓ (N default 1) | Draft pause | |
| Coordinator assignment | ✓ | | Auto-assign hints |
| Notifications | ✓ email + in-app | Email opt-out | SMS |
| Auth | ✓ email/password | | OAuth |
| Roles | Member, Coordinator, Admin | Rep-only pick | |
| iCal export | | ✓ | |
| Multi-cabin | | | ✓ |

---

## 10. Open items for implementation (not blocking planning)

- Exact email templates and branding
- Whether “intentionally unassigned week” is needed in MVP or coordinator assigns placeholder household
- Purge job for notes/occupancy older than retention vs UI-only hide (MVP: **UI hide**)

---

## 11. References

- [Pick model decision](./01-pick-model-decision.md)
- Original product brief (conversation baseline)
- Phase 1 planning Q&A decisions (2026-05-30)
