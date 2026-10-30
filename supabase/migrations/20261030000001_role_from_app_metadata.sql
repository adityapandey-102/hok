-- Security audit run 1 (supabase.handle-new-user-trusts-user-metadata-role):
-- the profile role used to come from raw_user_meta_data, which a self-signing-up
-- user controls (sign-up options.data). If public sign-up were ever enabled on
-- the hosted project, anyone could have created an Admin.
--
-- Now the role comes only from raw_app_meta_data, which only server-side code
-- (hok-api's service-role createUser) can set. An auth user created any other
-- way gets NO profile, so hok-api refuses it (requireAuth: missing profile = 403).
-- Existing profiles are untouched.

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
  );
  return new;
end;
$$;
