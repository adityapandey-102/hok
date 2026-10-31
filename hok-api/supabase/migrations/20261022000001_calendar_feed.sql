-- Calendar subscribe link (FR-CAL-08): one secret feed link per person, for
-- Google Calendar / Apple / Outlook "subscribe by URL". Like portal links,
-- only the SHA-256 of the token is stored; null = no link (or turned off).
-- Making a new link replaces the hash, so the old link stops working at once.

alter table public.profiles
  add column calendar_feed_token_hash text,
  add column calendar_feed_created_at timestamptz,
  add constraint profiles_calendar_feed_pair_chk
    check ((calendar_feed_token_hash is null) = (calendar_feed_created_at is null));

-- The public feed looks a person up by hash; only people with a link are indexed.
create unique index profiles_calendar_feed_token_idx
  on public.profiles (calendar_feed_token_hash)
  where calendar_feed_token_hash is not null;
