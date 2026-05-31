# Cabin Scheduling Application — User Stories

**Format:** As a [role], I want [goal], so that [benefit].  
**Tags:** `[MVP]` `[Nice-to-Have]` `[Future]`

---

## Epic: Calendar

| ID | Story | Tag |
|----|-------|-----|
| CAL-01 | As a **household member**, I want to open the app to a **month calendar** showing assigned weeks by household color, so that I can quickly see who has the cabin when. | MVP |
| CAL-02 | As a **member**, I want to see **unassigned weeks** clearly distinguished, so that I know what is still open during/after draft. | MVP |
| CAL-03 | As a **member**, I want a **status banner** (period name, draft turn, assignment phase), so that I understand what is happening without opening admin screens. | MVP |
| CAL-04 | As a **member**, I want to **tap a week** and see assignment, notes, and occupancy, so that I get full context in one place. | MVP |
| CAL-05 | As a **member**, I want to **navigate months** within the retention window, so that I can review past and upcoming plans. | MVP |
| CAL-06 | As a **member**, I want a **compact week strip** optimized for mobile, so that I can scan schedules on a phone easily. | Nice-to-Have |
| CAL-07 | As a **member**, I want to **export assigned weeks to iCal**, so that I can add them to my personal calendar. | Nice-to-Have |

---

## Epic: Household notes

| ID | Story | Tag |
|----|-------|-----|
| NOTE-01 | As a **household member**, I want to add a **note on a date range** before/during the open period, so that I can communicate preferences to other households. | MVP |
| NOTE-02 | As a **member**, I want notes to show **household name** (not individual author), so that the calendar stays simple and household-oriented. | MVP |
| NOTE-03 | As a **member**, I want to **edit or delete** my household’s notes, so that I can keep information current. | MVP |
| NOTE-04 | As a **member**, I want to see **all households’ notes** on the calendar, so that I can coordinate informally outside the app. | MVP |

---

## Epic: Occupancy indicators

| ID | Story | Tag |
|----|-------|-----|
| OCC-01 | As a **household member**, I want to mark date ranges **green** (others welcome) or **red** (prefer exclusive), so that I can signal expected use without a booking system. | MVP |
| OCC-02 | As a **member**, I want to see **persistent disclaimer** that indicators are informational only, so that I do not confuse them with rules. | MVP |
| OCC-03 | As a **member**, I want to see **multiple households’ indicators** on the same days, so that everyone’s signals are visible. | MVP |
| OCC-04 | As a **member**, I want a **visual hint** when red overlaps another household’s assigned week, so that I notice potential friction. | Nice-to-Have |
| OCC-05 | As a **member**, I want to **filter** calendar to one household’s occupancy, so that I can reduce visual noise. | Nice-to-Have |

---

## Epic: Scheduling period administration

| ID | Story | Tag |
|----|-------|-----|
| PER-01 | As a **coordinator**, I want to **create a scheduling period** with start/end dates and opening datetime, so that the group knows when planning begins. | MVP |
| PER-02 | As a **coordinator**, I want to **preview computed weeks** for a period, so that I verify boundaries before publishing the period. | MVP |
| PER-03 | As a **coordinator**, I want to set **household priority order** for the draft, so that selection order is fair and agreed. | MVP |
| PER-04 | As a **coordinator**, I want to **edit period dates** before the draft starts, with warnings if weeks shift, so that I can fix mistakes safely. | MVP |
| PER-05 | As a **administrator**, I want **inactive households** excluded from new periods automatically, so that the draft only includes current members. | MVP |

---

## Epic: Draft

| ID | Story | Tag |
|----|-------|-----|
| DRF-01 | As a **coordinator**, I want to **start the draft** when the group is ready, so that households can begin picking after the notes phase. | MVP |
| DRF-02 | As a **household member**, I want to receive **email and in-app notice** when it is my household’s turn, so that I do not miss the pick window. | MVP |
| DRF-03 | As a **household member**, I want to **pick an available week** during our turn, so that we secure time at the cabin. | MVP |
| DRF-04 | As a **household member**, I want to **voluntarily skip** our turn, so that we can pass without taking a week this round. | MVP |
| DRF-05 | As a **household member**, I want to **change our pick** before the turn advances, so that I can fix a mistake immediately. | MVP |
| DRF-06 | As a **household member**, I want a **warning** before my turn expires, so that I can act before auto-skip. | MVP |
| DRF-07 | As a **system**, I want to **auto-skip** expired turns and notify the next household, so that the draft does not stall indefinitely. | MVP |
| DRF-08 | As a **coordinator**, I want the draft to **pause (hold)** after two consecutive auto-skips, so that I can intervene before order breaks down. | MVP |
| DRF-09 | As a **coordinator**, I want to **resume, force-skip, or pick for** the held household, so that I can unblock the draft. | MVP |
| DRF-10 | As a **administrator**, I want to configure **`week_selections_per_household`**, so that the group can run multi-round drafts when needed. | MVP |
| DRF-11 | As a **coordinator**, I want to **pause the draft** without a hold condition, so that I can wait for a household that asked for delay. | Nice-to-Have |
| DRF-12 | As a **household member**, I want **only designated representatives** to pick (not all members), so that one decision-maker acts per household. | Nice-to-Have |

---

## Epic: Coordinator assignment

| ID | Story | Tag |
|----|-------|-----|
| ASN-01 | As a **coordinator**, I want to see a **list of unassigned weeks** after the draft, so that I can fill gaps efficiently. | MVP |
| ASN-02 | As a **coordinator**, I want to **assign each remaining week** to a household, so that the period is complete. | MVP |
| ASN-03 | As a **coordinator**, I want to **publish** the period, so that everyone sees final assignments on the calendar. | MVP |
| ASN-04 | As a **coordinator**, I want to **change an assignment** after publish with a recorded reason, so that agreed swaps are reflected. | MVP |
| ASN-05 | As a **member**, I want to see when an assignment was **updated** after publish, so that I know the calendar changed. | MVP |
| ASN-06 | As a **coordinator**, I want **suggested fair assignments** for remaining weeks, so that I spend less cognitive effort balancing. | Future |

---

## Epic: Notifications

| ID | Story | Tag |
|----|-------|-----|
| NTF-01 | As a **member**, I want an **in-app notification list** with read/unread state, so that I can catch up on scheduling events. | MVP |
| NTF-02 | As a **member**, I want **email** for turn, warning, hold, and publish events, so that I am notified without opening the app. | MVP |
| NTF-03 | As a **member**, I want to **opt out of non-critical emails**, so that I control noise. | Nice-to-Have |
| NTF-04 | As a **member**, I want **SMS** for turn reminders, so that I notice time-sensitive actions faster. | Future |

---

## Epic: Users and authentication

| ID | Story | Tag |
|----|-------|-----|
| AUTH-01 | As an **administrator**, I want to **invite a user by email** to a household, so that new family members can access the calendar. | MVP |
| AUTH-02 | As an **invited user**, I want to **set my password** from the invite link, so that I can log in securely. | MVP |
| AUTH-03 | As a **user**, I want to **reset my password** if forgotten, so that I am not locked out. | MVP |
| AUTH-04 | As a **user**, I want to **log in with email and password**, so that I can access my household’s data. | MVP |
| AUTH-05 | As an **administrator**, I want to **deactivate a user**, so that departed members lose access without deleting history. | MVP |
| AUTH-06 | As a **user**, I want to **sign in with Google**, so that I do not manage another password. | Future |

---

## Epic: Administration and settings

| ID | Story | Tag |
|----|-------|-----|
| ADM-01 | As an **administrator**, I want to **create and name households** with display colors, so that the calendar is legible. | MVP |
| ADM-02 | As an **administrator**, I want to **deactivate a household**, so that departed groups no longer appear in drafts. | MVP |
| ADM-03 | As an **administrator**, I want to assign **up to three coordinators**, so that scheduling duties are shared. | MVP |
| ADM-04 | As an **administrator**, I want to set **cabin timezone, week start, pick window, warning lead, and retention years**, so that the system matches our norms. | MVP |
| ADM-05 | As an **administrator**, I want to view an **audit log** of assignment and coordinator draft actions, so that changes are transparent. | MVP |
| ADM-06 | As an **administrator**, I want a **full activity feed** of all user actions, so that I can troubleshoot disputes. | Nice-to-Have |

---

## Epic: Non-goals (explicitly not building)

| ID | Story | Tag |
|----|-------|-----|
| NG-01 | As a **user**, I want in-app **chat** — **not planned**; use phone/text. | Future (out) |
| NG-02 | As a **user**, I want **voting** on weeks — **not planned**. | Future (out) |
| NG-03 | As a **user**, I want **payment tracking** — **not planned**. | Future (out) |

---

## Traceability

Stories map to requirements in [02-refined-requirements.md](./02-refined-requirements.md) (`FR-*` IDs). Implementation priority follows [08-roadmap-and-mvp.md](./08-roadmap-and-mvp.md).
