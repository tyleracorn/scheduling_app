# Cabin Scheduling Application — API Design

**Style:** REST JSON over HTTPS  
**Versioning:** `/api/v1` prefix  
**Auth:** Session cookie (httpOnly, secure) or JWT in httpOnly cookie — recommend **server session** for simplicity.

---

## 1. Conventions

| Convention | Choice |
|------------|--------|
| IDs | UUID in path and body |
| Dates | ISO 8601 `YYYY-MM-DD` for civil dates; RFC 3339 for instants |
| Errors | `{ "error": { "code", "message", "details" } }` |
| Pagination | `?cursor=` for notifications; calendar uses date range |
| Idempotency | `Idempotency-Key` header on pick/skip POST |

### 1.1 Standard HTTP status

| Status | Use |
|--------|-----|
| 200 | Success with body |
| 201 | Created |
| 204 | Success no body |
| 400 | Validation error |
| 401 | Unauthenticated |
| 403 | Forbidden (wrong role/household) |
| 404 | Not found |
| 409 | Week already assigned / conflict |
| 410 | Turn no longer active |
| 422 | Semantic error (e.g. draft on hold) |

---

## 2. Authentication

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/auth/login` | `{ email, password }` → session |
| POST | `/api/v1/auth/logout` | Clear session |
| POST | `/api/v1/auth/forgot-password` | Send reset email |
| POST | `/api/v1/auth/reset-password` | `{ token, password }` |
| POST | `/api/v1/auth/accept-invite` | `{ token, password, display_name }` |
| GET | `/api/v1/auth/me` | Current user + household + roles |

---

## 3. Calendar (read-optimized aggregate)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/calendar` | **Primary read API** |

**Query params:**

- `start` (date, required)
- `end` (date, required)

**Response shape:**

```json
{
  "range": { "start": "2026-01-01", "end": "2026-01-31" },
  "settings": { "cabin_timezone": "America/Denver", "week_start_day": 0 },
  "periods": [
    {
      "id": "uuid",
      "name": "2026 Q1",
      "status": "draft",
      "draft_summary": {
        "current_round": 1,
        "on_hold": false,
        "active_turn": {
          "household_id": "uuid",
          "household_name": "Smith",
          "expires_at": "2026-01-15T18:00:00Z"
        }
      }
    }
  ],
  "weeks": [
    {
      "period_week_id": "uuid",
      "week_start_date": "2026-01-04",
      "week_end_date": "2026-01-10",
      "assignment": {
        "household_id": "uuid",
        "household_name": "Smith",
        "color": "#3366CC",
        "source": "draft_pick",
        "updated_at": "2026-01-02T12:00:00Z"
      }
    }
  ],
  "notes": [
    {
      "id": "uuid",
      "household_id": "uuid",
      "household_name": "Jones",
      "start_date": "2026-01-05",
      "end_date": "2026-01-12",
      "body": "Flexible this week"
    }
  ],
  "occupancy": [
    {
      "id": "uuid",
      "household_id": "uuid",
      "household_name": "Smith",
      "start_date": "2026-01-04",
      "end_date": "2026-01-06",
      "status": "green"
    }
  ]
}
```

---

## 4. Scheduling periods

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/api/v1/periods` | member+ | List periods (filter by status, year) |
| GET | `/api/v1/periods/{id}` | member+ | Period detail + weeks + priorities |
| POST | `/api/v1/periods` | coordinator | Create period |
| PATCH | `/api/v1/periods/{id}` | coordinator | Update dates/name (guarded by status) |
| PUT | `/api/v1/periods/{id}/priorities` | coordinator | `[{ household_id, position }]` |
| POST | `/api/v1/periods/{id}/start-draft` | coordinator | `open` → `draft`, create round 1 turns |
| POST | `/api/v1/periods/{id}/publish` | coordinator | `assignment` → `published` |
| POST | `/api/v1/periods/{id}/archive` | coordinator | → `archived` |

**POST body (create):**

```json
{
  "name": "2026 Q2",
  "start_date": "2026-04-01",
  "end_date": "2026-06-30",
  "opening_at": "2026-03-01T09:00:00-07:00"
}
```

**Response includes computed `weeks[]` preview.**

---

## 5. Draft and turns

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/api/v1/periods/{id}/draft` | member+ | Full draft state: rounds, turns, active turn, available weeks |
| POST | `/api/v1/periods/{id}/turns/{turnId}/pick` | member* | `{ period_week_id, client_action_id }` |
| POST | `/api/v1/periods/{id}/turns/{turnId}/skip` | member* | `{ client_action_id }` |
| POST | `/api/v1/periods/{id}/draft/resume` | coordinator | Resume from hold `{ reset_auto_skip_counter: true }` |
| POST | `/api/v1/periods/{id}/turns/{turnId}/force-skip` | coordinator | Force skip active turn |
| POST | `/api/v1/periods/{id}/turns/{turnId}/coordinator-pick` | coordinator | Pick week for household |

\*Member of the **active turn household** only; enforced server-side.

**GET draft response (abbreviated):**

```json
{
  "period_id": "uuid",
  "status": "draft",
  "on_hold": false,
  "consecutive_auto_skips": 1,
  "current_round": 1,
  "max_rounds": 1,
  "active_turn": { "id": "uuid", "household_id": "uuid", "expires_at": "..." },
  "available_weeks": [{ "period_week_id": "uuid", "week_start_date": "..." }],
  "turns": [{ "round": 1, "household_id": "uuid", "status": "completed", "action": "pick" }]
}
```

---

## 6. Assignments

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/api/v1/periods/{id}/assignments` | member+ | All assignments |
| GET | `/api/v1/periods/{id}/assignments/unassigned` | coordinator | Weeks without assignment |
| PUT | `/api/v1/periods/{id}/assignments/{weekId}` | coordinator | Assign/reassign `{ household_id, reason }` |
| DELETE | `/api/v1/periods/{id}/assignments/{weekId}` | coordinator | Remove assignment (rare) |

Published period edits use same PUT with audit `reason` required.

---

## 7. Notes

| Method | Path | Role |
|--------|------|------|
| GET | `/api/v1/notes?start=&end=` | member+ |
| POST | `/api/v1/notes` | member (own household) |
| PATCH | `/api/v1/notes/{id}` | member (own household) |
| DELETE | `/api/v1/notes/{id}` | member (own household) |

**POST body:** `{ start_date, end_date, body }` — `household_id` from session.

---

## 8. Occupancy

| Method | Path | Role |
|--------|------|------|
| GET | `/api/v1/occupancy?start=&end=` | member+ |
| POST | `/api/v1/occupancy` | member |
| PATCH | `/api/v1/occupancy/{id}` | member (own) |
| DELETE | `/api/v1/occupancy/{id}` | member (own) |

**POST body:** `{ start_date, end_date, status: "green" | "red" }`

---

## 9. Notifications

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/notifications?cursor=` | Paginated inbox |
| POST | `/api/v1/notifications/{id}/read` | Mark read |
| POST | `/api/v1/notifications/read-all` | Mark all read |

---

## 10. Administration

| Method | Path | Role |
|--------|------|------|
| GET | `/api/v1/admin/households` | admin |
| POST | `/api/v1/admin/households` | admin |
| PATCH | `/api/v1/admin/households/{id}` | admin |
| GET | `/api/v1/admin/users` | admin |
| POST | `/api/v1/admin/users/invite` | admin |
| PATCH | `/api/v1/admin/users/{id}` | admin |
| GET | `/api/v1/admin/settings` | admin |
| PUT | `/api/v1/admin/settings` | admin |
| GET | `/api/v1/admin/audit?entity_type=&entity_id=` | admin/coordinator |
| PATCH | `/api/v1/admin/coordinators` | admin — set coordinator flags (max 3) |

---

## 11. Internal / worker endpoints

Protected by shared secret or run in worker process only (not public):

| Job | Trigger |
|-----|---------|
| Process turn timeout | Worker polls `draft_turns` where `expires_at < now()` and `status=active` |
| Process period open | `scheduling_periods` where `opening_at < now()` and `status=scheduled` |

Prefer **queue messages** scheduled at turn creation time over polling when infrastructure allows.

---

## 12. Authorization matrix (summary)

| Resource | Member | Coordinator | Admin |
|----------|--------|-------------|-------|
| Calendar read | ✓ | ✓ | ✓ |
| Notes/occupancy own | ✓ | ✓ | ✓ |
| Draft pick/skip | own turn | — | — |
| Period/draft control | — | ✓ | ✓ |
| Assignments manual | — | ✓ | ✓ |
| Users/settings | — | — | ✓ |

---

## 13. Real-time (optional)

**MVP:** Polling — client refreshes calendar every 60s during active draft, or on focus.

**Nice-to-Have:** SSE `/api/v1/events` for `draft_updated`, `period_published`.

---

## References

- [05-database-schema.md](./05-database-schema.md)
- [04-system-workflows.md](./04-system-workflows.md)
