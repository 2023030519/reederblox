-- Phase 1: profile photo + cover for every user (not only creators). Run once in the Supabase SQL editor.
alter table profiles add column if not exists banner_url text;
grant update (banner_url) on profiles to authenticated;

-- Any signed-in user may upload into their own '<uid>/profile/' folder of the 'media' bucket.
-- (media_write still restricts the rest of the bucket to creators.)
create policy media_profile_write on storage.objects for insert to authenticated
  with check (bucket_id = 'media'
              and (storage.foldername(name))[1] = auth.uid()::text
              and (storage.foldername(name))[2] = 'profile');
