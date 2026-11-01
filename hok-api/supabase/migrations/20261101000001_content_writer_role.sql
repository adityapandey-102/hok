-- New task-only role: Content Writer (same access as Editor and Developer: staff tasks only).
-- The role lives in a CHECK constraint on profiles; widen it.
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in (
  'admin', 'social_media_manager', 'marketing_manager', 'project_manager', 'marketing_agent', 'developer', 'editor', 'content_writer'
));
