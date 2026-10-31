-- The Owner: the first Admin. Only the Owner can make anyone an Admin, demote
-- or deactivate an Admin, or regenerate another Admin's password, and the
-- Owner can never be demoted or deactivated. Closes audit lead
-- users.admin-password-rule-bypass-via-role-flip (an Admin could demote
-- another Admin, reset their password, then re-promote them).
-- Enforced in hok-api (users/domain/account-admin.rules.ts); this file only
-- stores the flag and guarantees there is at most one.

alter table public.profiles
  add column if not exists is_owner boolean not null default false;

-- Existing installs: the earliest-created Admin becomes the Owner (only if no
-- Owner exists yet, so re-running never moves it).
update public.profiles
set is_owner = true
where id = (
    select id from public.profiles
    where role = 'admin'
    order by created_at asc, id asc
    limit 1
  )
  and not exists (select 1 from public.profiles where is_owner);

-- At most one Owner, whatever the application does.
create unique index if not exists profiles_single_owner_idx
  on public.profiles (is_owner)
  where is_owner;
