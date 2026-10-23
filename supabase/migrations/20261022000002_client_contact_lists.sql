-- A client can have several websites, phone numbers, contact people and
-- social accounts (user request 2026-10-22). They are small lists always
-- read and edited with the client, never queried on their own, so they live
-- on the client row (array / jsonb) rather than in child tables: no extra
-- queries, and the client's `version` still guards concurrent edits.
-- Existing single values are carried over, then the old columns are dropped.

alter table public.clients
  add column websites text[] not null default '{}',
  add column phones text[] not null default '{}',
  -- [{ "name": "Priya", "phone": "+91 …" | null, "email": "…" | null }]
  add column contacts jsonb not null default '[]'::jsonb,
  -- [{ "platform": "instagram", "handle": "@acme" }]; a platform may repeat
  add column social_accounts jsonb not null default '[]'::jsonb;

update public.clients set
  websites = case when website is null then '{}' else array[website] end,
  phones = case when phone is null then '{}' else array[phone] end,
  contacts = case
    when contact_person is null then '[]'::jsonb
    else jsonb_build_array(jsonb_build_object('name', contact_person, 'phone', null, 'email', null))
  end,
  social_accounts = coalesce(
    (select jsonb_agg(jsonb_build_object('platform', h.key, 'handle', h.value) order by h.key)
       from jsonb_each_text(social_handles) as h),
    '[]'::jsonb
  );

-- Caps match the API (client-profile.rules.ts); the database is the last line.
alter table public.clients
  add constraint clients_websites_max check (cardinality(websites) <= 10),
  add constraint clients_phones_max check (cardinality(phones) <= 10),
  add constraint clients_contacts_list check (jsonb_typeof(contacts) = 'array' and jsonb_array_length(contacts) <= 20),
  add constraint clients_social_accounts_list check (jsonb_typeof(social_accounts) = 'array' and jsonb_array_length(social_accounts) <= 20);

alter table public.clients
  drop column website,
  drop column phone,
  drop column contact_person,
  drop column social_handles;
