-- Follow-up to 20261030000001: GoTrue's admin createUser inserts the auth.users
-- row first and writes app_metadata (where the role now lives) in a later
-- UPDATE, so the AFTER INSERT trigger never saw the role and no profile was made.
-- The profile is now also created when a role first appears in app_metadata.
-- It is created once only: an existing profile is never overwritten (role
-- changes go through hok-api's profiles update, not through app_metadata).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.raw_app_meta_data ->> 'role' is null then
    return new;
  end if;

  insert into public.profiles (id, full_name, email, role, time_zone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    new.email,
    new.raw_app_meta_data ->> 'role',
    coalesce(new.raw_user_meta_data ->> 'time_zone', 'Asia/Kolkata')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_role_assigned
  after update of raw_app_meta_data on auth.users
  for each row
  when (old.raw_app_meta_data ->> 'role' is null and new.raw_app_meta_data ->> 'role' is not null)
  execute function public.handle_new_user();
