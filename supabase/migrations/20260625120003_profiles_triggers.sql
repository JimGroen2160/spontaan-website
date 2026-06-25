-- ============================================================================
-- SPONTAAN-WEBSITE
-- Profiles updated_at trigger
--
-- Bewuste beveiligingsverbetering:
-- - vaste search_path;
-- - geen publieke, anonieme of authenticated uitvoerrechten;
-- - volledige wijziging wordt atomair uitgevoerd.
-- ============================================================================

begin;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path to 'pg_catalog'
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

revoke all
  on function public.set_updated_at()
  from public;

revoke all
  on function public.set_updated_at()
  from anon;

revoke all
  on function public.set_updated_at()
  from authenticated;

create trigger trg_profiles_updated_at
before update
on public.profiles
for each row
execute function public.set_updated_at();

commit;
