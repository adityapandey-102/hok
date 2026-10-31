-- Phase 2: reminders and last seen (REQUIREMENTS FR-EVT-10, FR-TSK-11, FR-NTF-06/07, FR-SYS-03).
--
-- Reminders need no table of their own: the reminder is derived from the
-- event's start / the task's due time, and the row records when it was sent.
-- A background check every 10 minutes (in hok-api) claims what is due --
-- active events starting within 2 hours, open tasks due within 2 hours, not yet
-- reminded -- with FOR UPDATE SKIP LOCKED, so two API instances never send the
-- same reminder. Changing the start / due time clears the mark, so the
-- reminder follows the new time.

alter table public.events add column if not exists reminded_at timestamptz;
alter table public.staff_tasks add column if not exists due_reminded_at timestamptz;

comment on column public.events.reminded_at is 'When the 2-hour start reminder went to the owner; null = not yet (cleared when starts_at changes).';
comment on column public.staff_tasks.due_reminded_at is 'When the 2-hour due reminder went to the assignee; null = not yet (cleared when due_at changes or the task reopens).';

-- The check's whole working set: only rows still waiting for a reminder, by time.
-- Each run is one range scan [now, now + 2 h] over these small partial indexes.
create index if not exists events_reminder_due_idx on public.events (starts_at)
  where reminded_at is null and state = 'active';
create index if not exists staff_tasks_reminder_due_idx on public.staff_tasks (due_at)
  where due_reminded_at is null and status <> 'done' and due_at is not null;

-- Last seen: when the person last used HOK (any authenticated API call), written
-- on their own row at most once every few minutes -- reading it is a primary-key
-- lookup, never a log scan. Older than 45 days (or null) reads "not seen".
alter table public.profiles add column if not exists last_seen_at timestamptz;
comment on column public.profiles.last_seen_at is 'Last authenticated API call (throttled to one write per few minutes).';

-- Team status / reports: active staff, most recently seen first.
create index if not exists profiles_last_seen_idx on public.profiles (last_seen_at desc nulls last) where active;
