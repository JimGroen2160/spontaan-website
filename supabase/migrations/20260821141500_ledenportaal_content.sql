-- ============================================================================
-- SPONTAAN-WEBSITE
-- Ledenportaal: muziek, smoelenboek en private ledenfoto's
--
-- Doel:
-- - bescherm ledenportaalcontent met RLS;
-- - houd profiles de enige bron voor ledenidentiteit;
-- - expose uitsluitend minimale smoelenboekvelden via een SECURITY DEFINER RPC;
-- - geef actieve leden read-only toegang;
-- - geef actieve admin/contentmanager beheerrechten;
-- - maak een private Storage-bucket voor ledenfoto's;
-- - bevat bewust GEEN demo/testdata.
-- ============================================================================

begin;

-- --------------------------------------------------------------------------
-- 1. Helper: is de actuele gebruiker een actieve ledenportaalgebruiker?
-- --------------------------------------------------------------------------

create or replace function public.is_current_user_active_portal_user()
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
      and status = 'active'
      and role = any (
        array[
          'admin'::text,
          'contentmanager'::text,
          'member'::text
        ]
      )
  );
$function$;

revoke all
on function public.is_current_user_active_portal_user()
from public;

revoke all
on function public.is_current_user_active_portal_user()
from anon;

revoke all
on function public.is_current_user_active_portal_user()
from authenticated;

grant execute
on function public.is_current_user_active_portal_user()
to authenticated;

-- --------------------------------------------------------------------------
-- 2. Muziek-tabellen
-- --------------------------------------------------------------------------

create table public.member_songs (
  id uuid not null default gen_random_uuid(),
  title text not null,
  category text not null,
  description text not null default '',
  lyrics text not null default '',
  is_visible boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),

  constraint member_songs_pkey
    primary key (id),

  constraint member_songs_category_check
    check (
      category = any (
        array[
          'current'::text,
          'concept'::text,
          'archive'::text
        ]
      )
    )
);

create table public.member_song_links (
  id uuid not null default gen_random_uuid(),
  song_id uuid not null,
  label text not null,
  link_type text not null,
  url text not null,
  sort_order integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),

  constraint member_song_links_pkey
    primary key (id),

  constraint member_song_links_song_id_fkey
    foreign key (song_id)
    references public.member_songs(id)
    on delete cascade,

  constraint member_song_links_type_check
    check (
      link_type = any (
        array[
          'audio'::text,
          'video'::text,
          'other'::text
        ]
      )
    ),

  constraint member_song_links_https_check
    check (url ~ '^https://[^[:space:]]+$')
);

create index idx_member_songs_category_sort
  on public.member_songs using btree (category, sort_order, title);

create index idx_member_song_links_song_sort
  on public.member_song_links using btree (song_id, sort_order, label);

alter table public.member_songs enable row level security;
alter table public.member_song_links enable row level security;

create trigger trg_member_songs_updated_at
before update
on public.member_songs
for each row
execute function public.set_updated_at();

create trigger trg_member_song_links_updated_at
before update
on public.member_song_links
for each row
execute function public.set_updated_at();

-- Actieve leden lezen uitsluitend zichtbare liedjes.
create policy "Active portal users can read visible songs"
on public.member_songs
as permissive
for select
to authenticated
using (
  is_visible
  and public.is_current_user_active_portal_user()
);

-- Managers moeten ook verborgen items kunnen beheren.
create policy "Managers can read all songs"
on public.member_songs
as permissive
for select
to authenticated
using (
  public.is_current_user_manager()
);

create policy "Managers can insert songs"
on public.member_songs
as permissive
for insert
to authenticated
with check (
  public.is_current_user_manager()
);

create policy "Managers can update songs"
on public.member_songs
as permissive
for update
to authenticated
using (
  public.is_current_user_manager()
)
with check (
  public.is_current_user_manager()
);

create policy "Managers can delete songs"
on public.member_songs
as permissive
for delete
to authenticated
using (
  public.is_current_user_manager()
);

-- Links zijn voor actieve leden alleen leesbaar als het bovenliggende lied
-- via de member_songs-policies leesbaar is.
create policy "Active portal users can read visible song links"
on public.member_song_links
as permissive
for select
to authenticated
using (
  public.is_current_user_active_portal_user()
  and exists (
    select 1
    from public.member_songs as song
    where song.id = member_song_links.song_id
      and song.is_visible
  )
);

create policy "Managers can read all song links"
on public.member_song_links
as permissive
for select
to authenticated
using (
  public.is_current_user_manager()
);

create policy "Managers can insert song links"
on public.member_song_links
as permissive
for insert
to authenticated
with check (
  public.is_current_user_manager()
);

create policy "Managers can update song links"
on public.member_song_links
as permissive
for update
to authenticated
using (
  public.is_current_user_manager()
)
with check (
  public.is_current_user_manager()
);

create policy "Managers can delete song links"
on public.member_song_links
as permissive
for delete
to authenticated
using (
  public.is_current_user_manager()
);

-- --------------------------------------------------------------------------
-- 3. Smoelenboek: alleen contentmetadata, geen duplicatie van profieldata
-- --------------------------------------------------------------------------

create table public.member_directory (
  profile_id uuid not null,
  memo text not null default '',
  photo_path text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),

  constraint member_directory_pkey
    primary key (profile_id),

  constraint member_directory_profile_id_fkey
    foreign key (profile_id)
    references public.profiles(id)
    on delete cascade
);

alter table public.member_directory enable row level security;

create trigger trg_member_directory_updated_at
before update
on public.member_directory
for each row
execute function public.set_updated_at();

-- Directe tabeltoegang is alleen voor managers. Gewone leden gebruiken de
-- beperkte get_member_directory()-RPC hieronder.
create policy "Managers can read member directory metadata"
on public.member_directory
as permissive
for select
to authenticated
using (
  public.is_current_user_manager()
);

create policy "Managers can insert member directory metadata"
on public.member_directory
as permissive
for insert
to authenticated
with check (
  public.is_current_user_manager()
);

create policy "Managers can update member directory metadata"
on public.member_directory
as permissive
for update
to authenticated
using (
  public.is_current_user_manager()
)
with check (
  public.is_current_user_manager()
);

create policy "Managers can delete member directory metadata"
on public.member_directory
as permissive
for delete
to authenticated
using (
  public.is_current_user_manager()
);

create or replace function public.get_member_directory()
returns table (
  profile_id uuid,
  full_name text,
  memo text,
  photo_path text
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    profile.id as profile_id,
    profile.full_name,
    coalesce(directory.memo, '') as memo,
    directory.photo_path
  from public.profiles as profile
  left join public.member_directory as directory
    on directory.profile_id = profile.id
  where profile.status = 'active'
    and profile.role = any (
      array[
        'admin'::text,
        'contentmanager'::text,
        'member'::text
      ]
    )
    and public.is_current_user_active_portal_user()
  order by profile.full_name;
$function$;

revoke all
on function public.get_member_directory()
from public;

revoke all
on function public.get_member_directory()
from anon;

revoke all
on function public.get_member_directory()
from authenticated;

grant execute
on function public.get_member_directory()
to authenticated;

-- --------------------------------------------------------------------------
-- 4. Private Storage-bucket en fotoautorisatie
-- --------------------------------------------------------------------------

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'member-photos',
  'member-photos',
  false,
  5242880,
  array[
    'image/jpeg',
    'image/png',
    'image/webp'
  ]::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Leden mogen alleen foto's lezen die daadwerkelijk bij een actief profiel
-- in het smoelenboek horen. Managers krijgen daarnaast volledige bucket-read
-- zodat upload/vervangen via de Storage API mogelijk blijft.
create or replace function public.can_current_user_read_member_photo(
  object_name text
)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    public.is_current_user_active_portal_user()
    and exists (
      select 1
      from public.member_directory as directory
      join public.profiles as profile
        on profile.id = directory.profile_id
      where directory.photo_path = object_name
        and profile.status = 'active'
    );
$function$;

revoke all
on function public.can_current_user_read_member_photo(text)
from public;

revoke all
on function public.can_current_user_read_member_photo(text)
from anon;

revoke all
on function public.can_current_user_read_member_photo(text)
from authenticated;

grant execute
on function public.can_current_user_read_member_photo(text)
to authenticated;

drop policy if exists "Active portal users can read referenced member photos"
on storage.objects;

create policy "Active portal users can read referenced member photos"
on storage.objects
as permissive
for select
to authenticated
using (
  bucket_id = 'member-photos'
  and public.can_current_user_read_member_photo(name)
);

drop policy if exists "Managers can read all member photos"
on storage.objects;

create policy "Managers can read all member photos"
on storage.objects
as permissive
for select
to authenticated
using (
  bucket_id = 'member-photos'
  and public.is_current_user_manager()
);

drop policy if exists "Managers can insert member photos"
on storage.objects;

create policy "Managers can insert member photos"
on storage.objects
as permissive
for insert
to authenticated
with check (
  bucket_id = 'member-photos'
  and public.is_current_user_manager()
  and lower(storage.extension(name)) = any (
    array['jpg'::text, 'jpeg'::text, 'png'::text, 'webp'::text]
  )
);

drop policy if exists "Managers can update member photos"
on storage.objects;

create policy "Managers can update member photos"
on storage.objects
as permissive
for update
to authenticated
using (
  bucket_id = 'member-photos'
  and public.is_current_user_manager()
)
with check (
  bucket_id = 'member-photos'
  and public.is_current_user_manager()
  and lower(storage.extension(name)) = any (
    array['jpg'::text, 'jpeg'::text, 'png'::text, 'webp'::text]
  )
);

drop policy if exists "Managers can delete member photos"
on storage.objects;

create policy "Managers can delete member photos"
on storage.objects
as permissive
for delete
to authenticated
using (
  bucket_id = 'member-photos'
  and public.is_current_user_manager()
);

-- --------------------------------------------------------------------------
-- 5. Expliciete tabelrechten
-- --------------------------------------------------------------------------

revoke all on table public.member_songs from public;
revoke all on table public.member_songs from anon;
revoke all on table public.member_songs from authenticated;

grant select, insert, update, delete
on table public.member_songs
to authenticated;

grant select, insert, update, delete
on table public.member_songs
to service_role;

revoke all on table public.member_song_links from public;
revoke all on table public.member_song_links from anon;
revoke all on table public.member_song_links from authenticated;

grant select, insert, update, delete
on table public.member_song_links
to authenticated;

grant select, insert, update, delete
on table public.member_song_links
to service_role;

revoke all on table public.member_directory from public;
revoke all on table public.member_directory from anon;
revoke all on table public.member_directory from authenticated;

grant select, insert, update, delete
on table public.member_directory
to authenticated;

grant select, insert, update, delete
on table public.member_directory
to service_role;

comment on table public.member_songs is
  'Beveiligde liedjes voor het ledenportaal.';

comment on table public.member_song_links is
  'Oefen- en referentielinks bij beveiligde ledenportaal-liedjes.';

comment on table public.member_directory is
  'Smoelenboekmetadata; profielidentiteit blijft uitsluitend in profiles.';

commit;
