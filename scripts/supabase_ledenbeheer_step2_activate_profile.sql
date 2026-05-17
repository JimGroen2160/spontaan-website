begin;

create or replace function public.activate_current_user_profile()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_profile public.profiles;
begin
  update public.profiles
  set
    status = 'active',
    updated_at = now()
  where auth_user_id = auth.uid()
    and role = 'member'
    and status = 'pending'
  returning *
  into updated_profile;

  if updated_profile.id is not null then
    return updated_profile;
  end if;

  select *
  into updated_profile
  from public.profiles
  where auth_user_id = auth.uid();

  return updated_profile;
end;
$$;

revoke all on function public.activate_current_user_profile() from public;
grant execute on function public.activate_current_user_profile() to authenticated;

commit;