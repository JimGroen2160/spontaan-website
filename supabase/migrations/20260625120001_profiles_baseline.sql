-- ============================================================================
-- SPONTAAN-WEBSITE
-- Profiles database baseline
--
-- Doel:
-- - reproduceerbare basis voor een afgescheiden Supabase-testomgeving;
-- - gebaseerd op de read-only inventarisatie van productie;
-- - bevat geen persoonsgegevens of testdata;
-- - wordt in deze fase niet op productie uitgevoerd.
-- ============================================================================

create table public.profiles (
  id uuid not null default gen_random_uuid(),
  auth_user_id uuid not null,
  full_name text not null,
  street text not null,
  house_number text not null,
  postal_code text not null,
  city text not null,
  phone text not null,
  email text not null,
  role text not null,
  status text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),

  constraint profiles_pkey
    primary key (id),

  constraint profiles_auth_user_id_key
    unique (auth_user_id),

  constraint profiles_email_key
    unique (email),

  constraint profiles_role_check
    check (
      role = any (
        array[
          'admin'::text,
          'member'::text
        ]
      )
    ),

  constraint profiles_status_check
    check (
      status = any (
        array[
          'pending'::text,
          'active'::text,
          'inactive'::text
        ]
      )
    )
);

-- Deze twee niet-unieke indexes bestaan ook in productie.
-- De unieke constraints hierboven maken daarnaast automatisch unieke indexes aan.
-- Mogelijke dubbele indexdekking wordt pas in een aparte wijziging beoordeeld.
create index idx_profiles_auth_user_id
  on public.profiles using btree (auth_user_id);

create index idx_profiles_email
  on public.profiles using btree (email);

comment on table public.profiles is
  'Ledenprofielen voor authenticatie, autorisatie en ledenbeheer.';
