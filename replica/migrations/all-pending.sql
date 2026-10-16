-- (001 + 002 combined: paste this whole file in the Supabase SQL editor)
-- Phase 1: profile photo + cover for every user (not only creators). Run once in the Supabase SQL editor.
alter table profiles add column if not exists banner_url text;
grant update (banner_url) on profiles to authenticated;

-- Any signed-in user may upload into their own '<uid>/profile/' folder of the 'media' bucket.
-- (media_write still restricts the rest of the bucket to creators.)
create policy media_profile_write on storage.objects for insert to authenticated
  with check (bucket_id = 'media'
              and (storage.foldername(name))[1] = auth.uid()::text
              and (storage.foldername(name))[2] = 'profile');
-- Phase 9: creators can add new genres. Run once in the Supabase SQL editor.
-- genres.slug is unique, so a duplicate genre is rejected (the app shows "Ese género ya existe").
create policy genres_create on genres for insert to authenticated
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_creator));
