-- ============================================================================
-- SPONTAAN-WEBSITE
-- Profiles security baseline
--
-- RLS wordt al in migratie 001 ingeschakeld.
--
-- Bewuste afwijking ten opzichte van de huidige productieconfiguratie:
-- - geen EXECUTE voor PUBLIC of anon op SECURITY DEFINER-functies;
-- - authenticated krijgt alleen de functioneel noodzakelijke RPC-rechten;
-- - grants en revokes worden expliciet vastgelegd.
-- ============================================================================

begin;

-- --------------------------------------------------------------------------
-- Controleert of de actuele ingelogde gebruiker een actieve admin is.
-- --------------------------------------------------------------------------

create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.profiles
    where auth_user_id = auth.uid()
      and role = 'admin'
      and status = 'active'
  );
$function$;

revoke all
  on function public.is_current_user_admin()
  from public;

revoke all
  on function public.is_current_user_admin()
  from anon;

revoke all
  on function public.is_current_user_admin()
  from authenticated;

grant execute
  on function public.is_current_user_admin()
  to authenticated;

-- --------------------------------------------------------------------------
-- Activeert uitsluitend het eigen pending member-profiel.
-- Een ander profiel, een adminrol of een andere status wordt niet gewijzigd.
-- --------------------------------------------------------------------------

create or replace function public.activate_current_user_profile()
returns public.profiles
language plpgsql
security definer
set search_path to 'public'
as $function$
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
$function$;

revoke all
  on function public.activate_current_user_profile()
  from public;

revoke all
  on function public.activate_current_user_profile()
  from anon;

revoke all
  on function public.activate_current_user_profile()
  from authenticated;

grant execute
  on function public.activate_current_user_profile()
  to authenticated;

-- --------------------------------------------------------------------------
-- RLS-policies
-- --------------------------------------------------------------------------

create policy "Users can read own profile"
on public.profiles
as permissive
for select
to authenticated
using (
  auth.uid() = auth_user_id
);

create policy "Admins can read all profiles"
on public.profiles
as permissive
for select
to authenticated
using (
  public.is_current_user_admin()
);

create policy "Admins can update all profiles"
on public.profiles
as permissive
for update
to authenticated
using (
  public.is_current_user_admin()
)
with check (
  role = any (
    array[
      'admin'::text,
      'member'::text
    ]
  )
  and
  status = any (
    array[
      'pending'::text,
      'active'::text,
      'inactive'::text
    ]
  )
);

-- --------------------------------------------------------------------------
-- Expliciete tabelrechten
--
-- RLS bepaalt welke rijen daadwerkelijk toegankelijk zijn.
-- anon krijgt geen directe rechten op profiles.
-- --------------------------------------------------------------------------

revoke all
  on table public.profiles
  from public;

revoke all
  on table public.profiles
  from anon;

revoke all
  on table public.profiles
  from authenticated;

grant select, update
  on table public.profiles
  to authenticated;

-- service_role blijft uitsluitend bestemd voor vertrouwde server-side taken,
-- zoals testdataherstel, cleanup en Edge Functions.
grant select, insert, update, delete
  on table public.profiles
  to service_role;

commit;
