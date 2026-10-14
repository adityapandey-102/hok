# 0005: Clients -- single owner, 404 row scope, archive, optimistic lock

## Status

Accepted (2026-10-13), M3.

## Context

Clients are the root of almost everything HOK stores: events, assets, portal links and comments all hang off a client (REQUIREMENTS §5.2, §4 "data isolation"). Each client has exactly one owner, a Social Media / Marketing Manager or the Admin. A manager must never see another manager's clients, the Admin sees all of them and is the only one who reassigns, and two people (the owner and the Admin) can edit the same client at the same time.

## Decisions

1. **One owner column, `owner_id → profiles ON DELETE RESTRICT`.** There's no join table and no sharing (FR-CLI-05: "never shared by two managers"). RESTRICT because staff are deactivated, never deleted; a client must not disappear with a person. Child tables reference `client_id`, so reassigning one column moves "the client and all its data".

2. **Owner on create.** The creator owns the client (FR-CLI-01). Only a caller whose `clients:read` scope is global (the Admin) may pass `ownerId`; a manager naming someone else is `403 CLIENT_OWNER_FORBIDDEN` (refused, not silently ignored, so a client is never filed somewhere the user didn't expect). Any chosen owner, on create or reassign, must be an **active** admin / social_media_manager / marketing_manager (`400 CLIENT_OWNER_INVALID`).

3. **Row scope gives a 404, never a 403** (needleye's leads pattern). Capability (`requireCapability`) answers "may this role touch clients at all?" (task-only staff: 403). The service answers "which ones?": a manager's list is pinned to `owner_id = me` (their `ownerId` filter is ignored), and another manager's client is `404 CLIENT_NOT_FOUND`, the same as a missing id, so existence never leaks. On writes the scope is re-checked on the locked row *before* the version, so a stale version on someone else's client is still a 404.

4. **Status: `active ↔ paused` by edit; archive/unarchive are their own actions.** Archiving stamps `archived_at` (a CHECK keeps it in step with `status`), hides the client from the default list (`status=archived` shows them), and makes it read-only until it's unarchived (`409 CLIENT_ARCHIVED`). Unarchive returns to `active`. Reassign still works on an archived client. Managers may archive their own clients: it's an edit of their own record (`clients:write`), and it's reversible. From M8, archiving also disables the portal link (FR-CLI-07).

5. **Optimistic lock with a `version` column** (needleye's orders/leads). Every write is one transaction: `SELECT … FOR UPDATE OF clients`, a guard callback from the service (scope → version → state → contract dates merged with the stored values), then `UPDATE … version = version + 1`. `PATCH` **requires** `version` (an edit form always has the copy it loaded); archive, unarchive and reassign accept it optionally. A stale version is `409 CLIENT_MODIFIED`. The version check lives in the service's guard (a domain rule), not the repository, so its order relative to the scope check is explicit and unit-tested.

6. **Field shapes.** `social_handles jsonb` is an object keyed by a fixed platform list; values are a handle or an http(s) link, validated in the API (the DB only insists on an object). `services text[]`: a flat list of labels, with no structure that would need jsonb; `= any()` or a GIN index work on it directly if it's ever filtered on. Websites get a scheme (`acme.com` → `https://acme.com`), and only http(s) is stored. Contract dates are `date` (`YYYY-MM-DD`, read as strings, never JS Dates), and the end can't be before the start (API rule + DB CHECK).

7. **Lists return a summary.** `GET /clients` returns the fields a list shows (no notes, address, handles, services), newest first, as one page query joined to the owner's name plus one `count(*)`. Indexes: `(owner_id, created_at desc, id desc)` (a manager's list, the Admin's owner filter, the FK), `(status, created_at desc, id desc)` (the Admin's list and status filter), `lower(industry)`, and a trigram GIN index on `business_name` for search (`pg_trgm`, enabled the way needleye does).

8. **Audit.** Client create / update (field names only, never values) / archive / unarchive / reassign (`{ from, to }`) go to `audit_log`. A typed history table is not needed until a client has a lifecycle worth showing on its own page.

## Consequences

- A manager's view can't widen by accident: the scope is applied in the service from the role, never from a request parameter.
- Concurrent edits fail loudly (409) instead of silently overwriting each other; the web must send back the `version` it loaded and offer a reload on 409.
- An owner can't be deleted while they own clients; the Admin reassigns first (deactivation is the normal path anyway).
- `notes` are internal; the M8 portal presenter must not expose them.
