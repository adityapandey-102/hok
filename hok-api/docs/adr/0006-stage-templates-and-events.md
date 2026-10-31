# 0006: Stage templates and events -- copied stages, free stage moves, range-bounded calendars

## Status

Accepted (2026-10-14), M4.

## Context

REQUIREMENTS §5.3: the Admin defines stage templates (an ordered list of stages); a manager creates an event for one of their clients from a template and uses its stages as-is; editing a template later must not change existing events; moving the stage records who, when and an optional note that may be shown to the client; any event can be cancelled or postponed. M5's calendars need a range query, in several time zones.

## Decisions

1. **Stages are copied onto the event** (`event_stages`), never referenced from the template. `events.template_id` (nullable) and `template_name` (snapshot) remember the origin. A template edit replaces its own stage list (rename / reorder / add / remove in one PATCH) and never reaches an existing event. `events.stage_count` is a snapshot too, so a list row shows "stage 3 of 6" without a per-row count.

2. **The current stage always belongs to the event**: composite FK `(current_stage_id, id) → event_stages (id, event_id)`, deferrable so an event and its stages can be inserted in one transaction.

3. **Stage moves go to any stage of the event, forward or back.** Work does go back (client review → editing), and a mis-click must be undoable; `event_stage_history` (append-only) keeps every move, with `from_stage_id`, note, `visible_to_client` and `changed_by`. Refused: the stage it's already at (409), another event's stage (400), a cancelled or postponed event (409, reactivate first). The move and its history row are one transaction with the version check. Creation writes the first history row (`from_stage_id` null). Stage moves are recorded there, not in `audit_log`.

4. **State is separate from stage**: `active | cancelled | postponed`, any change allowed through PATCH (FR-EVT-04/07).

5. **Row scope comes from the client.** `events:read` / `events:write` (Admin all; SMM/MM own) plus the client's `owner_id`: another manager's event, or a client that isn't yours on create, is a 404. An **archived client makes its events read-only** (`409 CLIENT_ARCHIVED`); reads still work. Template reads: the Admin sees all; managers see active ones only (an inactive template is a 404 for them); writes are `stage_templates:manage` (Admin).

6. **Time.** `starts_at`/`ends_at` are `timestamptz` (UTC); the API only accepts ISO instants **with an offset**, never zone-less wall times. `time_zone` is the event's own IANA zone (defaults to the client's), shown beside the viewer's zone by the web. Ends on or after start, **at most 31 days** (API rule + CHECK).

7. **Calendar range** (`GET /events?from&to`): both ends or neither, at most 92 days; returns events **overlapping** `[from, to)`, earliest first. Because no event lasts more than 31 days, the query adds `starts_at >= from - 31 days`, so the `events (starts_at)` index bounds the scan. Page cap 200 (a month of calendar at once), with `total`. Without a range: newest first.

8. **Lists and details without N+1.** A list row joins the client (name, owner) and the current stage (name, position) in the page query; a detail is the event + three parallel queries (stages, last 100 history entries with names, team names).

## Consequences

- The portal (M8) can show a stage tracker and the client-visible notes straight from `event_stages` + `event_stage_history`.
- M5 calendars need no new endpoint for client / manager / Admin views: the range query with `clientId` / scope / `ownerId` covers them.
- Templates are never deleted by the API (deactivate instead); test fixtures delete them directly.
