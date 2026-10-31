-- Notifications: the in-app bell, web push subscriptions and per-trigger
-- preferences (REQUIREMENTS §5.10, FR-NTF-01..04; ARCHITECTURE §8).
--
-- * notifications: one row per recipient. Written by hok-api's notifications
--   module, inside the triggering change's transaction where the caller can
--   (e.g. a client reassignment), otherwise right after its commit. The bell
--   polls the unread count, so that query has its own partial index.
-- * push_subscriptions: one row per browser/device that allowed push
--   (the Push API subscription). A dead endpoint (404/410 from the push
--   service) is deleted by the API when it next tries to send.
-- * notification_preferences: per user, the triggers they muted, separately
--   for push and for the in-app bell. No row = everything on.
--
-- Depends on 20261013000001_profiles.sql (profiles), which sorts first.
-- Row scope (a user only ever reads and changes their own rows) is enforced by
-- hok-api; the grants + RLS below are defence in depth, as for the other tables.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  -- The recipient. CASCADE: a user's bell goes with the account (accounts are
  -- deactivated, not deleted, so in practice rows stay).
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- The trigger, e.g. 'client_reassigned', 'task_assigned'. Open vocabulary
  -- (checked by the API) so a new trigger needs no migration.
  type text not null check (type ~ '^[a-z][a-z_]{0,39}$'),
  -- Who caused it (shown as "by X"); null for system notifications.
  actor_id uuid references public.profiles (id) on delete set null,
  -- { "title": text, "body": text, "url": "/app/...", ...entity ids }.
  -- The url is always an app path (the API checks it; the check is a backstop).
  payload jsonb not null check (
    jsonb_typeof(payload) = 'object'
    and jsonb_typeof(payload -> 'title') = 'string'
    and (payload -> 'url' is null or (payload ->> 'url') like '/%')
    and pg_column_size(payload) <= 4096
  ),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- The bell's list: a user's notifications, newest first (id breaks ties for stable pages).
create index notifications_user_created_idx on public.notifications (user_id, created_at desc, id desc);
-- The bell's badge: polled every minute or so per signed-in user, so it must stay an index-only count.
create index notifications_user_unread_idx on public.notifications (user_id) where read_at is null;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- The push service URL for this browser. Unique: one device = one row; if
  -- another user signs in on the same browser, the row moves to them.
  endpoint text not null unique check (endpoint ~ '^https://' and length(endpoint) <= 2048),
  -- The browser's encryption keys (base64url), needed to encrypt each payload.
  p256dh text not null check (length(p256dh) between 1 and 200),
  auth text not null check (length(auth) between 1 and 100),
  -- Shown in "My profile -> this device" so a user can tell devices apart.
  user_agent text check (length(user_agent) <= 400),
  created_at timestamptz not null default now(),
  -- Last successful send (or re-subscribe): lets stale devices be pruned later.
  last_used_at timestamptz not null default now()
);
-- "Send to every device of these users".
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

create table public.notification_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  -- Trigger types this user doesn't want as a push / in the bell.
  -- Muting the bell also means no push (nothing is recorded).
  muted_push text[] not null default '{}',
  muted_in_app text[] not null default '{}',
  updated_at timestamptz not null default now()
);

-- set_updated_at() is defined in 20261013000001_profiles.sql.
create trigger notification_preferences_set_updated_at
  before update on public.notification_preferences
  for each row
  execute function public.set_updated_at();

-- ------------------------------------------------- Data API (defence in depth) --

grant select, insert, update, delete on public.notifications, public.push_subscriptions, public.notification_preferences to service_role;
grant select on public.notifications, public.notification_preferences to authenticated;

alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_preferences enable row level security;

-- Only your own rows. push_subscriptions has no policy: the browser never reads
-- it through the Data API (its keys stay server-side).
create policy notifications_select_own on public.notifications for select using (user_id = auth.uid());
create policy notification_preferences_select_own on public.notification_preferences for select using (user_id = auth.uid());
