begin;

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'member'));

alter table public.profiles
  drop constraint if exists profiles_status_check;

alter table public.profiles
  add constraint profiles_status_check
  check (status in ('pending', 'active', 'inactive'));

create index if not exists idx_profiles_auth_user_id
  on public.profiles (auth_user_id);

create index if not exists idx_profiles_email
  on public.profiles (email);

drop policy if exists "Admins can read all profiles" on public.profiles;
drop policy if exists "Admins can update all profiles" on public.profiles;

create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where auth_user_id = auth.uid()
      and role = 'admin'
      and status = 'active'
  );
$$;

revoke all on function public.is_current_user_admin() from public;
grant execute on function public.is_current_user_admin() to authenticated;

create policy "Admins can read all profiles"
on public.profiles
for select
to authenticated
using (
  public.is_current_user_admin()
);

create policy "Admins can update all profiles"
on public.profiles
for update
to authenticated
using (
  public.is_current_user_admin()
)
with check (
  role in ('admin', 'member')
  and status in ('pending', 'active', 'inactive')
);

commit;