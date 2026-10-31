-- Usage (LOCAL stack only; ask the user first, it is a DB write):
--   (cat tests/cleanup-test-data.sql; echo "commit;") | docker exec -i supabase_db_hok psql -U postgres -At
-- Dry run: replace "commit;" with "rollback;" to see the counts first.
-- Removes rows left behind by automated test runs (RBAC script, integration
-- tests, Playwright e2e) from the LOCAL HOK database. Seed accounts
-- (*@hok.test without a test prefix) and their real demo data are kept.
\set ON_ERROR_STOP on
begin;

create temp table t_users on commit drop as
  select id from public.profiles where email ~ '^(rbac-|it-|e2e\.)';
create temp table t_clients on commit drop as
  select id from public.clients
  where owner_id in (select id from t_users)
     or business_name ~ '^(E2E |RBAC |IT |QB |Dash Test )';

select 'test users', count(*) from t_users;
select 'test clients', count(*) from t_clients;

delete from public.staff_tasks
  where assignee_id in (select id from t_users)
     or client_id in (select id from t_clients)
     or title ~ '^(E2E |IT |RBAC |QB |Dash )';
delete from public.client_todos
  where client_id in (select id from t_clients) or title ~ '^(E2E |IT |RBAC )';
delete from public.assets where client_id in (select id from t_clients);
delete from public.tags where client_id in (select id from t_clients);
delete from public.personal_events
  where client_id in (select id from t_clients) or title ~ '^(E2E |IT |RBAC |QB |Dash )';
delete from public.client_comments
  where client_id in (select id from t_clients) or body ~ '^(E2E |RBAC |IT |Dash )';
delete from public.portal_links where client_id in (select id from t_clients);
delete from public.events
  where client_id in (select id from t_clients) or title ~ '^(E2E |RBAC |IT |QB |Dash )';
delete from public.clients where id in (select id from t_clients);
delete from public.stage_templates where name ~ '^(E2E |RBAC |IT |QB |Dash )';
delete from public.notifications where payload::text ~ '(E2E |RBAC |IT Tasks|Dash Test|QB )';
delete from auth.users where id in (select id from t_users); -- profiles, prefs, push subs cascade

select 'left: profiles', count(*) from public.profiles;
select 'left: clients', count(*) from public.clients;
select 'left: events', count(*) from public.events;
select 'left: tasks', count(*) from public.staff_tasks;
select 'left: to-dos', count(*) from public.client_todos;
