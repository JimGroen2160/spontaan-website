begin;

-- --------------------------------------------------------------------------
-- B4.1g — beveiligde liedblad-PDF's voor het ledenportaal
-- --------------------------------------------------------------------------

alter table public.member_songs
  add column pdf_path text null;

alter table public.member_songs
  add constraint member_songs_pdf_path_check
  check (
    pdf_path is null
    or (
      length(pdf_path) between 1 and 500
      and pdf_path !~ '(^|/)\.\.?(/|$)'
      and pdf_path !~ '[[:cntrl:]]'
      and lower(pdf_path) ~ '\.pdf$'
    )
  );

comment on column public.member_songs.pdf_path is
  'Pad naar een private PDF in bucket member-song-sheets; geen publieke URL.';


-- --------------------------------------------------------------------------
-- Private Storage-bucket
-- --------------------------------------------------------------------------

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'member-song-sheets',
  'member-song-sheets',
  false,
  5242880,
  array['application/pdf']::text[]
);


-- --------------------------------------------------------------------------
-- Storage RLS
--
-- Actieve leden mogen uitsluitend het object lezen dat gekoppeld is aan
-- een zichtbaar lied. Managers mogen alle liedbladen lezen en beheren.
-- --------------------------------------------------------------------------

create policy "Active portal users can read visible song sheets"
on storage.objects
as permissive
for select
to authenticated
using (
  bucket_id = 'member-song-sheets'
  and public.is_current_user_active_portal_user()
  and exists (
    select 1
    from public.member_songs as song
    where song.pdf_path = storage.objects.name
      and song.is_visible
  )
);

create policy "Managers can read song sheets"
on storage.objects
as permissive
for select
to authenticated
using (
  bucket_id = 'member-song-sheets'
  and public.is_current_user_manager()
);

create policy "Managers can upload song sheets"
on storage.objects
as permissive
for insert
to authenticated
with check (
  bucket_id = 'member-song-sheets'
  and public.is_current_user_manager()
);

create policy "Managers can update song sheets"
on storage.objects
as permissive
for update
to authenticated
using (
  bucket_id = 'member-song-sheets'
  and public.is_current_user_manager()
)
with check (
  bucket_id = 'member-song-sheets'
  and public.is_current_user_manager()
);

create policy "Managers can delete song sheets"
on storage.objects
as permissive
for delete
to authenticated
using (
  bucket_id = 'member-song-sheets'
  and public.is_current_user_manager()
);

commit;