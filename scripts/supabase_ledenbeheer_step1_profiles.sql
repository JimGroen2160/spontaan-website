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

create policy "Admins can read all profiles"
on public.profiles
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles as me
    where me.auth_user_id = auth.uid()
      and me.role = 'admin'
      and me.status = 'active'
  )
);

drop policy if exists "Admins can update all profiles" on public.profiles;

create policy "Admins can update all profiles"
on public.profiles
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles as me
    where me.auth_user_id = auth.uid()
      and me.role = 'admin'
      and me.status = 'active'
  )
)
with check (
  role in ('admin', 'member')
  and status in ('pending', 'active', 'inactive')
);

commit;