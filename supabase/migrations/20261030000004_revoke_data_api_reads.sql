-- Security audit run 1 (supabase.rls-ignores-role-and-active), owner decision 2026-10-30:
-- hok-api reads and writes through a direct Postgres connection and never uses
-- Supabase's Data API (PostgREST). Its row-level policies only checked team
-- membership, not role or active status, so a demoted or deactivated staff member
-- holding a token could still read former clients' rows there.
--
-- Remove every Data API permission for the signed-in and anonymous roles. Row-level
-- security stays enabled as a second wall. hok-api is unaffected (it does not use
-- these roles). Re-grant per table only if a Data API use is ever added, and then
-- make the policies check role and active status too.

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
