-- Client teams (user decision 2026-10-23): HOK owns every client; who works
-- on it is its assigned TEAM. The Admin sees everything; a Social Media /
-- Marketing / Project Manager sees only clients they're assigned to.
-- `clients.owner_id` stays and now means the client's LEAD (one per client,
-- always also a team member). The API keeps "lead is a member" true inside
-- the same transaction that changes either.
--
-- Also: a new role, project_manager, with the same access as the other two
-- managers.

create table public.client_members (
  client_id uuid not null references public.clients (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  added_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (client_id, profile_id)
);

-- "Clients assigned to me" (every manager's list, scope check and filter):
-- the PK serves "who is on this client".
create index client_members_profile_idx on public.client_members (profile_id, client_id);
-- FK index rule (schema test): every foreign key is covered.
create index client_members_added_by_idx on public.client_members (added_by) where added_by is not null;

-- Today's owners become each client's first team member (and lead).
insert into public.client_members (client_id, profile_id)
select id, owner_id from public.clients;

-- Data API: defence in depth only (hok-api uses its own Postgres connection).
grant select, insert, update, delete on public.client_members to service_role;
grant select on public.client_members to authenticated;
alter table public.client_members enable row level security;
create policy client_members_select_own on public.client_members
  for select using (profile_id = auth.uid());

-- The read-only Data API policies follow the team instead of the owner.
-- Outer columns are always table-qualified: inside the subquery an unqualified
-- client_id would mean client_members.client_id and match every row.
drop policy clients_select_own on public.clients;
create policy clients_select_own on public.clients for select
  using (exists (select 1 from public.client_members m where m.client_id = clients.id and m.profile_id = auth.uid()));

drop policy events_select_own on public.events;
create policy events_select_own on public.events for select
  using (exists (select 1 from public.client_members m where m.client_id = events.client_id and m.profile_id = auth.uid()));

drop policy event_stages_select_own on public.event_stages;
create policy event_stages_select_own on public.event_stages for select
  using (exists (select 1 from public.events e join public.client_members m on m.client_id = e.client_id
                 where e.id = event_stages.event_id and m.profile_id = auth.uid()));

drop policy event_stage_history_select_own on public.event_stage_history;
create policy event_stage_history_select_own on public.event_stage_history for select
  using (exists (select 1 from public.events e join public.client_members m on m.client_id = e.client_id
                 where e.id = event_stage_history.event_id and m.profile_id = auth.uid()));

drop policy assets_select_own on public.assets;
create policy assets_select_own on public.assets for select
  using (assets.deleted_at is null and exists (select 1 from public.client_members m where m.client_id = assets.client_id and m.profile_id = auth.uid()));

drop policy tags_select_own on public.tags;
create policy tags_select_own on public.tags for select
  using (exists (select 1 from public.client_members m where m.client_id = tags.client_id and m.profile_id = auth.uid()));

drop policy asset_tags_select_own on public.asset_tags;
create policy asset_tags_select_own on public.asset_tags for select
  using (exists (select 1 from public.assets a join public.client_members m on m.client_id = a.client_id
                 where a.id = asset_tags.asset_id and a.deleted_at is null and m.profile_id = auth.uid()));

drop policy client_todos_select_own on public.client_todos;
create policy client_todos_select_own on public.client_todos for select
  using (exists (select 1 from public.client_members m where m.client_id = client_todos.client_id and m.profile_id = auth.uid()));

-- The new role.
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in (
  'admin', 'social_media_manager', 'marketing_manager', 'project_manager', 'marketing_agent', 'developer', 'editor'
));
