begin;

-- ============================================================================
-- CONTENTMANAGER RBAC
--
-- Doel:
-- - voeg role 'contentmanager' toe;
-- - behoud admin-only autorisatie;
-- - geef actieve contentmanagers dagelijks ledenbeheer;
-- - voorkom beheer van admin- en contentmanageraccounts door contentmanagers;
-- - voorkom privilege-escalatie door contentmanagers;
-- - laat self-activation uitsluitend voor gewone members bestaan.
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. Rollenconstraint
-- --------------------------------------------------------------------------

alter table public.profiles
drop constraint if exists profiles_role_check;

alter table public.profiles
add constraint profiles_role_check
check (
  role = any (
    array[
      'admin'::text,
      'contentmanager'::text,
      'member'::text
    ]
  )
);

-- --------------------------------------------------------------------------
-- 2. Helper voor operationele beheerrechten
--
-- public.is_current_user_admin() blijft bewust ongewijzigd.
-- Deze SECURITY DEFINER-helper voorkomt RLS-recursie wanneer policies moeten
-- bepalen of de actuele gebruiker admin of contentmanager is.
-- --------------------------------------------------------------------------

create or replace function public.is_current_user_manager()
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
      and role = any (
        array[
          'admin'::text,
          'contentmanager'::text
        ]
      )
      and status = 'active'
  );
$function$;

revoke all
on function public.is_current_user_manager()
from public;

revoke all
on function public.is_current_user_manager()
from anon;

revoke all
on function public.is_current_user_manager()
from authenticated;

grant execute
on function public.is_current_user_manager()
to authenticated;

-- --------------------------------------------------------------------------
-- 3. Admin-update-policy uitbreiden met contentmanager als geldige doelrol.
--
-- Alleen een actieve admin voldoet aan is_current_user_admin().
-- Hiermee kan een admin later gecontroleerd beheerrollen toekennen.
-- --------------------------------------------------------------------------

drop policy if exists "Admins can update all profiles"
on public.profiles;

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
      'contentmanager'::text,
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
-- 4. Managers mogen profielen lezen voor de beheeromgeving.
--
-- De bestaande eigen-profiel-policy en admin-policy blijven bestaan.
-- is_current_user_manager() voorkomt een recursieve profiles-policy.
-- --------------------------------------------------------------------------

drop policy if exists "Managers can read all profiles"
on public.profiles;

create policy "Managers can read all profiles"
on public.profiles
as permissive
for select
to authenticated
using (
  public.is_current_user_manager()
);

-- --------------------------------------------------------------------------
-- 5. Contentmanager mag uitsluitend gewone member-profielen wijzigen.
--
-- USING:
--   controleert het bestaande doelrecord.
--
-- WITH CHECK:
--   controleert het resultaat na de mutatie.
--
-- Hierdoor kan een contentmanager:
-- - geen admin wijzigen;
-- - geen contentmanager wijzigen;
-- - geen member promoveren naar een beheerrol;
-- - alleen een toegestane memberstatus bewaren.
--
-- Een admin valt voor ruime updates onder de aparte admin-policy hierboven.
-- --------------------------------------------------------------------------

drop policy if exists "Contentmanagers can update member profiles"
on public.profiles;

create policy "Contentmanagers can update member profiles"
on public.profiles
as permissive
for update
to authenticated
using (
  role = 'member'
  and public.is_current_user_manager()
)
with check (
  role = 'member'
  and status = any (
    array[
      'pending'::text,
      'active'::text,
      'inactive'::text
    ]
  )
  and public.is_current_user_manager()
);
-- --------------------------------------------------------------------------
-- 6. Bescherm gevoelige profielkolommen tegen contentmanager-updates.
--
-- RLS bepaalt welke rijen een contentmanager mag wijzigen.
-- Deze trigger bepaalt aanvullend welke KOLOMMEN gewijzigd mogen worden.
--
-- Whitelist voor dagelijks ledenbeheer:
-- - full_name
-- - street
-- - house_number
-- - postal_code
-- - city
-- - phone
-- - status
-- - updated_at
--
-- Alle andere bestaande en toekomstige profielkolommen zijn voor een
-- contentmanager standaard beschermd.
--
-- Admins zijn expliciet uitgezonderd.
-- --------------------------------------------------------------------------

create or replace function public.protect_contentmanager_profile_update()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  blocked_columns text[];
begin
  if public.is_current_user_manager()
     and not public.is_current_user_admin() then

    select array_agg(n.key order by n.key)
    into blocked_columns
    from jsonb_each(to_jsonb(new)) as n(key, value)
    join jsonb_each(to_jsonb(old)) as o(key, value)
      using (key)
    where n.value is distinct from o.value
      and n.key <> all (
        array[
          'full_name',
          'street',
          'house_number',
          'postal_code',
          'city',
          'phone',
          'status',
          'updated_at'
        ]::text[]
      );

    if blocked_columns is not null then
      raise exception
        'Contentmanager mag beschermde profielvelden niet wijzigen.'
        using
          errcode = '42501',
          detail = 'Geblokkeerde velden: ' || array_to_string(blocked_columns, ', ');
    end if;
  end if;

  return new;
end;
$function$;

revoke all
on function public.protect_contentmanager_profile_update()
from public;

revoke all
on function public.protect_contentmanager_profile_update()
from anon;

revoke all
on function public.protect_contentmanager_profile_update()
from authenticated;

drop trigger if exists protect_contentmanager_profile_update
on public.profiles;

create trigger protect_contentmanager_profile_update
before update
on public.profiles
for each row
execute function public.protect_contentmanager_profile_update();

commit;
